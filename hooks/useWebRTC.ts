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
  offer?:     { type: string; sdp: string } | null;
  answer?:    { type: string; sdp: string } | null;
  doctorIce:  object[];
  patientIce: object[];
}

export interface UseWebRTCOptions {
  appointmentId:  string;
  role:           "doctor" | "patient";
  localStreamRef: React.RefObject<MediaStream | null>;
  streamReady:    boolean;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function postSignal(id: string, type: string, payload: unknown): Promise<boolean> {
  try {
    const res = await fetch(`/api/appointments/${id}/webrtc-signal`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type, payload }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      console.error(`[WebRTC] postSignal ${type} failed:`, res.status, err.error);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[WebRTC] postSignal ${type} network error:`, e);
    return false;
  }
}

async function getSignaling(id: string): Promise<Signaling | null> {
  try {
    const res  = await fetch(`/api/appointments/${id}/webrtc-signal`);
    if (!res.ok) {
      console.error(`[WebRTC] getSignaling failed:`, res.status);
      return null;
    }
    const data = await res.json() as { signaling?: Signaling | null };
    return data.signaling ?? null;
  } catch (e) {
    console.error(`[WebRTC] getSignaling network error:`, e);
    return null;
  }
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
  const answerPosted    = useRef(false);   // patient: answer successfully posted
  const offerPosted     = useRef(false);   // doctor:  offer successfully posted
  const answerApplied   = useRef(false);   // doctor:  answer applied to PC
  const appliedDocIce   = useRef(0);
  const appliedPatIce   = useRef(0);
  const pollTimer       = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingOffer = useRef(false);   // prevent concurrent answer attempts

  const [connState, setConnState]       = useState<ConnectionState>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // ── PC factory ────────────────────────────────────────────────────────────

  const createPC = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      const t = role === "doctor" ? "ice-doctor" : "ice-patient";
      postSignal(appointmentId, t, candidate.toJSON()).catch(() => {});
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

  // ── Doctor: create offer (only after stream ready) ────────────────────────

  const initiateAsDoctor = useCallback(async () => {
    if (offerPosted.current) return;
    setConnState("connecting");
    console.log("[WebRTC] Doctor: clearing signaling and creating offer…");

    await postSignal(appointmentId, "clear", null);

    const pc = createPC();
    pcRef.current = pc;
    attachLocalTracks(pc);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const ok = await postSignal(appointmentId, "offer", { type: offer.type, sdp: offer.sdp });
      if (ok) {
        offerPosted.current = true;
        console.log("[WebRTC] Doctor: offer posted to DB ✓");
      } else {
        console.error("[WebRTC] Doctor: offer post failed — will retry");
        pc.close();
        pcRef.current = null;
      }
    } catch (e) {
      console.error("[WebRTC] Doctor: createOffer failed:", e);
      pc.close();
      pcRef.current = null;
    }
  }, [appointmentId, createPC, attachLocalTracks]);

  // ── Polling loop ──────────────────────────────────────────────────────────

  const tick = useCallback(async () => {
    const sig = await getSignaling(appointmentId);
    if (!sig) return;

    const pc = pcRef.current;

    // ── DOCTOR: apply answer + patient ICE ───────────────────────────────────
    if (role === "doctor") {
      if (sig.answer && !answerApplied.current && pc) {
        answerApplied.current = true;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.answer as RTCSessionDescriptionInit));
          console.log("[WebRTC] Doctor: answer applied ✓");
        } catch (e) {
          console.error("[WebRTC] Doctor: setRemoteDescription(answer) failed:", e);
          answerApplied.current = false;
        }
      }
      const newPatIce = (sig.patientIce ?? []).slice(appliedPatIce.current);
      for (const c of newPatIce) {
        try { await pc?.addIceCandidate(new RTCIceCandidate(c as RTCIceCandidateInit)); } catch {}
      }
      appliedPatIce.current += newPatIce.length;
    }

    // ── PATIENT: process offer → post answer ─────────────────────────────────
    if (role === "patient") {
      // Retry if: offer exists, answer not yet successfully posted, not mid-attempt
      if (sig.offer && !answerPosted.current && !processingOffer.current) {
        processingOffer.current = true;
        console.log("[WebRTC] Patient: offer found — creating answer…");

        // Close any previous failed PC
        pcRef.current?.close();
        const newPc = createPC();
        pcRef.current = newPc;
        attachLocalTracks(newPc);   // attach stream if available (OK if empty — call still connects)

        try {
          await newPc.setRemoteDescription(new RTCSessionDescription(sig.offer as RTCSessionDescriptionInit));
          const answer = await newPc.createAnswer();
          await newPc.setLocalDescription(answer);
          const ok = await postSignal(appointmentId, "answer", { type: answer.type, sdp: answer.sdp });
          if (ok) {
            answerPosted.current = true;
            console.log("[WebRTC] Patient: answer posted ✓");
          } else {
            console.error("[WebRTC] Patient: answer post failed — will retry");
            newPc.close();
            pcRef.current = null;
          }
        } catch (e) {
          console.error("[WebRTC] Patient: answer creation failed:", e);
          newPc.close();
          pcRef.current = null;
        } finally {
          processingOffer.current = false;  // allow retry regardless of outcome
        }
      }

      // Apply doctor ICE candidates
      const newDocIce = (sig.doctorIce ?? []).slice(appliedDocIce.current);
      for (const c of newDocIce) {
        try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(c as RTCIceCandidateInit)); } catch {}
      }
      appliedDocIce.current += newDocIce.length;
    }
  }, [appointmentId, role, createPC, attachLocalTracks]);

  const startPolling = useCallback(() => {
    if (pollTimer.current) return;
    pollTimer.current = setInterval(() => { tick().catch(() => {}); }, 800);
  }, [tick]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  }, []);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Patient: poll immediately (offer might already be there)
  useEffect(() => {
    if (role !== "patient") return;
    startPolling();
    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Doctor: wait for camera/mic before creating offer
  useEffect(() => {
    if (role !== "doctor" || !streamReady) return;
    initiateAsDoctor().then(startPolling);
    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, streamReady]);

  // (Retry loop removed — it called clear() which wiped the patient's answer)

  // ── Hangup ────────────────────────────────────────────────────────────────

  const hangup = useCallback(() => {
    stopPolling();
    pcRef.current?.close();
    pcRef.current = null;
    postSignal(appointmentId, "clear", null).catch(() => {});
    setConnState("disconnected");
  }, [appointmentId, stopPolling]);

  return { connState, remoteStream, hangup };
}
