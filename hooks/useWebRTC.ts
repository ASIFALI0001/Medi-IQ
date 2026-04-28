"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

// STUN = discover public IP (works same-network)
// TURN = relay traffic (required for mobile ↔ desktop across different networks)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Free public TURN from Open Relay Project — handles NAT across mobile ↔ desktop
  { urls: "turn:openrelay.metered.ca:80",              username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443",             username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "failed";

interface UseWebRTCOptions {
  appointmentId:  string;
  role:           "doctor" | "patient";
  socketRef:      React.RefObject<Socket | null>;
  localStreamRef: React.RefObject<MediaStream | null>;
}

export function useWebRTC({
  appointmentId,
  role,
  socketRef,
  localStreamRef,
}: UseWebRTCOptions) {
  const pcRef           = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);   // lazy — never new'd on server
  const initiatedRef    = useRef(false);                      // prevent double-offer
  const [connState, setConnState]     = useState<ConnectionState>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit("call:ice", { appointmentId, candidate: candidate.toJSON() });
      }
    };

    pc.ontrack = ({ track }) => {
      if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
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

  const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
    localStreamRef.current?.getTracks().forEach(track =>
      pc.addTrack(track, localStreamRef.current!)
    );
  }, [localStreamRef]);

  // Only doctor creates an offer — guarded so it runs at most once per session
  const initiateCall = useCallback(async () => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;

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

    // ── "call:ready" handshake — fixes the race condition ────────────────────
    // Patient registers ALL listeners first, THEN emits call:ready.
    // Doctor only creates the offer after receiving call:ready, guaranteeing
    // the patient's onOffer handler is already mounted.
    //
    // Fallback: if patient was already in the room when doctor joined, the
    // server's call:peer-joined fires immediately; patient will echo call:ready
    // after their own listeners mount (usually within 1-2 render cycles).

    const onReady = () => {
      if (role === "doctor") initiateCall();
    };

    const onPeerJoined = ({ role: peerRole }: { role: string }) => {
      // Patient was already in the room — they'll emit call:ready very shortly.
      // We DON'T initiate here; wait for call:ready to avoid the race condition.
      // (If call:ready never arrives — e.g. old client — fall back after 4 s.)
      if (role === "doctor" && peerRole === "patient") {
        setTimeout(() => initiateCall(), 4000);
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
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch { /* ignore late / duplicate candidates */ }
    };

    const onPeerDisconnected = () => setConnState("disconnected");

    socket.on("call:peer-joined",       onPeerJoined);
    socket.on("call:ready",             onReady);
    socket.on("call:offer",             onOffer);
    socket.on("call:answer",            onAnswer);
    socket.on("call:ice",               onIce);
    socket.on("call:peer-disconnected", onPeerDisconnected);

    // Patient signals readiness AFTER all listeners are registered
    if (role === "patient") {
      socket.emit("call:ready", { appointmentId });
    }

    return () => {
      socket.off("call:peer-joined",       onPeerJoined);
      socket.off("call:ready",             onReady);
      socket.off("call:offer",             onOffer);
      socket.off("call:answer",            onAnswer);
      socket.off("call:ice",               onIce);
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
