"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";

export interface UseAgoraOptions {
  appointmentId: string;
  role:          "doctor" | "patient";
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
}

async function fetchAgoraToken(appointmentId: string) {
  const res = await fetch(`/api/appointments/${appointmentId}/agora-token`);
  if (!res.ok) throw new Error("Failed to fetch Agora token");
  return res.json() as Promise<{ token: string; appId: string; channel: string; uid: number }>;
}

async function uploadForTranscription(appointmentId: string, blob: Blob): Promise<string> {
  try {
    const form = new FormData();
    form.append("audio", blob, "recording.webm");
    const res = await fetch(`/api/appointments/${appointmentId}/transcribe`, {
      method: "POST",
      body:   form,
    });
    const data = await res.json() as { transcript?: string };
    return data.transcript ?? "";
  } catch {
    return "";
  }
}

export function useAgora({ appointmentId, role, localVideoRef }: UseAgoraOptions) {
  const clientRef    = useRef<IAgoraRTCClient | null>(null);
  const micTrackRef  = useRef<IMicrophoneAudioTrack | null>(null);
  const camTrackRef  = useRef<ICameraVideoTrack | null>(null);

  // Audio recording (doctor side — mixes local + remote for Whisper)
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const recorderRef    = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const destRef        = useRef<MediaStreamAudioDestinationNode | null>(null);

  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [joined,      setJoined]      = useState(false);
  const [micOn,       setMicOnState]  = useState(true);
  const [camOn,       setCamOnState]  = useState(true);

  // ── Recording helpers ─────────────────────────────────────────────────────

  const startRecording = useCallback((micTrack: IMicrophoneAudioTrack) => {
    if (role !== "doctor") return;
    try {
      const ctx  = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      audioCtxRef.current = ctx;
      destRef.current     = dest;

      // Local mic → destination
      const localStream = new MediaStream([micTrack.getMediaStreamTrack()]);
      ctx.createMediaStreamSource(localStream).connect(dest);

      const recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(1000); // collect chunks every second
      recorderRef.current = recorder;
    } catch (e) {
      console.error("[Agora] Failed to start recording:", e);
    }
  }, [role]);

  const connectRemoteAudio = useCallback((user: IAgoraRTCRemoteUser) => {
    if (role !== "doctor" || !user.audioTrack || !audioCtxRef.current || !destRef.current) return;
    try {
      const remoteStream = new MediaStream([user.audioTrack.getMediaStreamTrack()]);
      audioCtxRef.current.createMediaStreamSource(remoteStream).connect(destRef.current);
    } catch (e) {
      console.error("[Agora] Failed to connect remote audio to recorder:", e);
    }
  }, [role]);

  // ── Join / Leave ──────────────────────────────────────────────────────────

  const join = useCallback(async () => {
    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      AgoraRTC.setLogLevel(3); // warn only — suppress verbose Agora logs

      const { token, appId, channel, uid } = await fetchAgoraToken(appointmentId);

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      // ── Remote user events ──────────────────────────────────────────────
      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "video") {
          setRemoteUsers(prev => {
            const next = prev.filter(u => u.uid !== user.uid);
            return [...next, user];
          });
        }
        if (mediaType === "audio") {
          user.audioTrack?.play();
          connectRemoteAudio(user);
          setRemoteUsers(prev => {
            const next = prev.filter(u => u.uid !== user.uid);
            return [...next, user];
          });
        }
      });

      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        }
      });

      client.on("user-left", (user) => {
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
      });

      await client.join(appId, channel, token, uid);

      // ── Local tracks ────────────────────────────────────────────────────
      const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
        {},
        { encoderConfig: "360p_7" },
      );
      micTrackRef.current = micTrack;
      camTrackRef.current = camTrack;

      await client.publish([micTrack, camTrack]);

      // Show local video (mirrored)
      if (localVideoRef.current) {
        camTrack.play(localVideoRef.current);
      }

      // Start audio recording on doctor's side
      startRecording(micTrack);

      setJoined(true);
      console.log("[Agora] Joined channel:", channel, "as uid:", uid);
    } catch (e) {
      console.error("[Agora] Join failed:", e);
    }
  }, [appointmentId, localVideoRef, startRecording, connectRemoteAudio]);

  // ── Leave — stops recording, uploads to Whisper, returns transcript ──────

  const leave = useCallback(async (): Promise<string> => {
    let transcript = "";

    // Stop recording and get transcript (doctor only)
    if (role === "doctor" && recorderRef.current && recorderRef.current.state !== "inactive") {
      transcript = await new Promise<string>((resolve) => {
        const recorder = recorderRef.current!;
        recorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          audioChunksRef.current = [];
          if (blob.size > 0) {
            console.log(`[Agora] Uploading recording (${(blob.size / 1024).toFixed(0)} KB) for transcription…`);
            const t = await uploadForTranscription(appointmentId, blob);
            console.log("[Agora] Transcript length:", t.length);
            resolve(t);
          } else {
            resolve("");
          }
        };
        recorder.stop();
      });
    }

    // Close audio context
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    destRef.current     = null;

    // Stop local tracks
    micTrackRef.current?.stop();
    micTrackRef.current?.close();
    micTrackRef.current = null;
    camTrackRef.current?.stop();
    camTrackRef.current?.close();
    camTrackRef.current = null;

    // Leave channel
    if (clientRef.current) {
      try { await clientRef.current.leave(); } catch {}
      clientRef.current = null;
    }

    setJoined(false);
    setRemoteUsers([]);
    return transcript;
  }, [appointmentId, role]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    const track = micTrackRef.current;
    if (!track) return;
    const next = !micOn;
    track.setEnabled(next);
    setMicOnState(next);
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const track = camTrackRef.current;
    if (!track) return;
    const next = !camOn;
    track.setEnabled(next);
    setCamOnState(next);
  }, [camOn]);

  // ── Auto-join on mount ────────────────────────────────────────────────────

  useEffect(() => {
    join();
    return () => { leave(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { joined, remoteUsers, micOn, camOn, toggleMic, toggleCam, leave };
}
