"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "failed";

interface UseWebRTCOptions {
  appointmentId: string;
  role:          "doctor" | "patient";
  socketRef:     React.RefObject<Socket | null>;
  localStreamRef: React.RefObject<MediaStream | null>;
}

export function useWebRTC({
  appointmentId,
  role,
  socketRef,
  localStreamRef,
}: UseWebRTCOptions) {
  const pcRef           = useRef<RTCPeerConnection | null>(null);
  // Lazy — never initialised at module/hook level so SSR (Node.js) never sees MediaStream
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [connState, setConnState] = useState<ConnectionState>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit("call:ice", { appointmentId, candidate: candidate.toJSON() });
      }
    };

    pc.ontrack = ({ track }) => {
      // First track: create the stream in the browser (safe — this is an event handler)
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      remoteStreamRef.current.addTrack(track);
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected")    setConnState("connected");
      if (s === "disconnected") setConnState("disconnected");
      if (s === "failed")       setConnState("failed");
    };

    return pc;
  }, [appointmentId, socketRef]);

  // Attach local tracks to peer connection
  const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, [localStreamRef]);

  // Doctor initiates after patient joins
  const initiateCall = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;
    setConnState("connecting");

    const pc = createPC();
    pcRef.current = pc;
    attachLocalTracks(pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("call:offer", { appointmentId, offer });
  }, [appointmentId, socketRef, createPC, attachLocalTracks]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onPeerJoined = async ({ role: peerRole }: { role: string }) => {
      // Doctor creates offer when patient (peer) joins
      if (role === "doctor" && peerRole === "patient") {
        await initiateCall();
      }
    };

    const onOffer = async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      if (role !== "patient") return;
      setConnState("connecting");
      const pc = createPC();
      pcRef.current = pc;
      attachLocalTracks(pc);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("call:answer", { appointmentId, answer });
    };

    const onAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onIce = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      try {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* ignore late candidates */ }
    };

    const onPeerDisconnected = () => setConnState("disconnected");

    socket.on("call:peer-joined",      onPeerJoined);
    socket.on("call:offer",            onOffer);
    socket.on("call:answer",           onAnswer);
    socket.on("call:ice",              onIce);
    socket.on("call:peer-disconnected", onPeerDisconnected);

    return () => {
      socket.off("call:peer-joined",       onPeerJoined);
      socket.off("call:offer",             onOffer);
      socket.off("call:answer",            onAnswer);
      socket.off("call:ice",              onIce);
      socket.off("call:peer-disconnected", onPeerDisconnected);
    };
  }, [appointmentId, role, socketRef, createPC, attachLocalTracks, initiateCall]);

  const hangup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    setConnState("disconnected");
  }, []);

  return { connState, remoteStream, hangup };
}
