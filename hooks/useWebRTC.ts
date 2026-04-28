"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// STUN discovers public IP. TURN relays traffic when direct P2P fails
// (required for mobile-data ↔ home-WiFi, different NAT types, etc.)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80",                username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443",               username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "failed";

interface Signaling {
  offer?:       { type: string; sdp: string } | null;
  answer?:      { type: string; sdp: string } | null;
  doctorIce:    object[];
  patientIce:   object[];
}

interface UseWebRTCOptions {
  appointmentId:  string;
  role:           "doctor" | "patient";
  localStreamRef: React.RefObject<MediaStream | null>;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function postSignal(id: string, type: string, payload: unknown) {
  await fetch(`/api/appointments/${id}/webrtc-signal`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ type, payload }),
  });
}

async function getSignaling(id: string): Promise<Signaling | null> {
  const res  = await fetch(`/api/appointments/${id}/webrtc-signal`);
  const data = await res.json() as { signaling?: Signaling | null };
  return data.signaling ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────

export function useWebRTC({
  appointmentId,
  role,
  localStreamRef,
}: UseWebRTCOptions) {
  const pcRef           = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);   // lazy — never new'd on server
  const initiatedRef    = useRef(false);
  const answerApplied   = useRef(false);
  const appliedDocIce   = useRef(0);   // count of already-applied doctor ICE candidates
  const appliedPatIce   = useRef(0);   // count of already-applied patient ICE candidates
  const pollTimer       = useRef<ReturnType<typeof setInterval> | null>(null);

  const [connState, setConnState]       = useState<ConnectionState>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // ── Peer connection factory ─────────────────────────────────────────────────

  const createPC = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      // Store our ICE candidates in the DB so the other party can poll for them
      const iceType = role === "doctor" ? "ice-doctor" : "ice-patient";
      postSignal(appointmentId, iceType, candidate.toJSON()).catch(() => {});
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

  // ── Doctor: create offer and store in DB ────────────────────────────────────

  const initiateCall = useCallback(async () => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;
    setConnState("connecting");

    const pc = createPC();
    pcRef.current = pc;
    attachLocalTracks(pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Offer goes to MongoDB — patient will pick it up via polling
    await postSignal(appointmentId, "offer", { type: offer.type, sdp: offer.sdp });
  }, [appointmentId, createPC, attachLocalTracks]);

  // ── Polling loop — works on Vercel (no Socket.io required) ─────────────────
  // Doctor polls for: answer, patientIce
  // Patient polls for: offer, doctorIce

  const startPolling = useCallback(() => {
    if (pollTimer.current) return;

    pollTimer.current = setInterval(async () => {
      try {
        const sig = await getSignaling(appointmentId);
        if (!sig) return;

        const pc = pcRef.current;

        if (role === "doctor") {
          // Apply answer once
          if (sig.answer && !answerApplied.current && pc) {
            answerApplied.current = true;
            await pc.setRemoteDescription(new RTCSessionDescription(sig.answer as RTCSessionDescriptionInit));
          }
          // Apply any new patient ICE candidates
          const newPatIce = (sig.patientIce ?? []).slice(appliedPatIce.current);
          for (const c of newPatIce) {
            try { await pc?.addIceCandidate(new RTCIceCandidate(c as RTCIceCandidateInit)); } catch {}
          }
          appliedPatIce.current += newPatIce.length;
        }

        if (role === "patient") {
          // Process offer once (create answer)
          if (sig.offer && !initiatedRef.current) {
            initiatedRef.current = true;
            setConnState("connecting");

            const newPc = createPC();
            pcRef.current = newPc;
            attachLocalTracks(newPc);

            await newPc.setRemoteDescription(new RTCSessionDescription(sig.offer as RTCSessionDescriptionInit));
            const answer = await newPc.createAnswer();
            await newPc.setLocalDescription(answer);

            await postSignal(appointmentId, "answer", { type: answer.type, sdp: answer.sdp });
          }
          // Apply any new doctor ICE candidates
          const newDocIce = (sig.doctorIce ?? []).slice(appliedDocIce.current);
          for (const c of newDocIce) {
            try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(c as RTCIceCandidateInit)); } catch {}
          }
          appliedDocIce.current += newDocIce.length;
        }
      } catch { /* ignore transient network errors */ }
    }, 800);
  }, [appointmentId, role, createPC, attachLocalTracks]);

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  useEffect(() => {
    // Clear stale signaling from a previous call session
    postSignal(appointmentId, "clear", null).catch(() => {});

    if (role === "doctor") {
      // Doctor initiates immediately — offer stored in DB, patient will poll it
      initiateCall();
    }

    startPolling();

    return () => {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    };
  }, [appointmentId, role, initiateCall, startPolling]);

  const hangup = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    pcRef.current?.close();
    pcRef.current = null;
    // Clean up signaling data from DB
    postSignal(appointmentId, "clear", null).catch(() => {});
    setConnState("disconnected");
  }, [appointmentId]);

  return { connState, remoteStream, hangup };
}
