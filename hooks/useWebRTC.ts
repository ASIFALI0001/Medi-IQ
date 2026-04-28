"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80",                  username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443",                 username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp",   username: "openrelayproject", credential: "openrelayproject" },
];

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "failed";

interface Signaling {
  offer?:      { type: string; sdp: string } | null;
  answer?:     { type: string; sdp: string } | null;
  doctorIce:   object[];
  patientIce:  object[];
}

export interface UseWebRTCOptions {
  appointmentId:  string;
  role:           "doctor" | "patient";
  localStreamRef: React.RefObject<MediaStream | null>;
  streamReady:    boolean;   // must be true before creating offer / answering
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function postSignal(id: string, type: string, payload: unknown) {
  try {
    await fetch(`/api/appointments/${id}/webrtc-signal`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type, payload }),
    });
  } catch { /* ignore transient failures — polling will retry */ }
}

async function getSignaling(id: string): Promise<Signaling | null> {
  try {
    const res  = await fetch(`/api/appointments/${id}/webrtc-signal`);
    const data = await res.json() as { signaling?: Signaling | null };
    return data.signaling ?? null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useWebRTC({
  appointmentId,
  role,
  localStreamRef,
  streamReady,
}: UseWebRTCOptions) {
  const pcRef           = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const initiatedRef    = useRef(false);   // offer sent / offer processed — do once
  const answerApplied   = useRef(false);
  const appliedDocIce   = useRef(0);
  const appliedPatIce   = useRef(0);
  const pollTimer       = useRef<ReturnType<typeof setInterval> | null>(null);

  const [connState, setConnState]       = useState<ConnectionState>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // ── Peer connection factory ─────────────────────────────────────────────────

  const createPC = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      const iceType = role === "doctor" ? "ice-doctor" : "ice-patient";
      postSignal(appointmentId, iceType, candidate.toJSON());
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
  }, [appointmentId, role]);

  const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, [localStreamRef]);

  // ── Doctor: clear stale signals then post fresh offer ──────────────────────
  // Only runs when streamReady becomes true (camera + mic obtained).
  // Patient NEVER calls clear — doing so deletes the doctor's offer.

  const initiateAsDoctor = useCallback(async () => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;
    setConnState("connecting");

    // Wipe any leftover signal from a previous session
    await postSignal(appointmentId, "clear", null);

    const pc = createPC();
    pcRef.current = pc;
    attachLocalTracks(pc);      // stream is guaranteed ready here

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Store offer in DB — patient's polling loop will pick it up
    await postSignal(appointmentId, "offer", { type: offer.type, sdp: offer.sdp });
  }, [appointmentId, createPC, attachLocalTracks]);

  // ── Polling loop ───────────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollTimer.current) return;   // already running

    pollTimer.current = setInterval(async () => {
      const sig = await getSignaling(appointmentId);
      if (!sig) return;

      const pc = pcRef.current;

      if (role === "doctor") {
        // Apply answer once it arrives
        if (sig.answer && !answerApplied.current && pc) {
          answerApplied.current = true;
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription(sig.answer as RTCSessionDescriptionInit)
            );
          } catch { /* may throw if called twice */ }
        }
        // Apply new patient ICE candidates
        const newIce = (sig.patientIce ?? []).slice(appliedPatIce.current);
        for (const c of newIce) {
          try { await pc?.addIceCandidate(new RTCIceCandidate(c as RTCIceCandidateInit)); } catch {}
        }
        appliedPatIce.current += newIce.length;
      }

      if (role === "patient") {
        // Process offer: wait until OUR stream is ready so we can attach tracks
        const stream = localStreamRef.current;
        if (sig.offer && !initiatedRef.current && stream) {
          initiatedRef.current = true;
          setConnState("connecting");

          const newPc = createPC();
          pcRef.current = newPc;
          attachLocalTracks(newPc);   // stream is ready

          try {
            await newPc.setRemoteDescription(
              new RTCSessionDescription(sig.offer as RTCSessionDescriptionInit)
            );
            const answer = await newPc.createAnswer();
            await newPc.setLocalDescription(answer);
            await postSignal(appointmentId, "answer", { type: answer.type, sdp: answer.sdp });
          } catch (err) {
            console.error("Answer creation failed:", err);
          }
        }
        // Apply new doctor ICE candidates
        const newIce = (sig.doctorIce ?? []).slice(appliedDocIce.current);
        for (const c of newIce) {
          try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(c as RTCIceCandidateInit)); } catch {}
        }
        appliedDocIce.current += newIce.length;
      }
    }, 800);
  }, [appointmentId, role, createPC, attachLocalTracks, localStreamRef]);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Patient: start polling immediately to watch for the offer
  useEffect(() => {
    if (role !== "patient") return;
    startPolling();
    return () => { if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);   // only on mount

  // Doctor: wait for camera/mic, then create offer and start polling
  useEffect(() => {
    if (role !== "doctor" || !streamReady) return;
    initiateAsDoctor();
    startPolling();
    return () => { if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, streamReady]);  // re-runs once when streamReady flips to true

  // ── Hangup ─────────────────────────────────────────────────────────────────

  const hangup = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    pcRef.current?.close();
    pcRef.current = null;
    postSignal(appointmentId, "clear", null).catch(() => {});
    setConnState("disconnected");
  }, [appointmentId]);

  return { connState, remoteStream, hangup };
}
