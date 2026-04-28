"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useTranscription } from "@/hooks/useTranscription";
import { PatientReportPanel } from "@/components/consultation/PatientReportPanel";
import type { CallAppointment } from "@/types/consultation";

interface Props { params: Promise<{ id: string }> }

export default function DoctorConsultationPage({ params }: Props) {
  const { id }    = use(params);
  const router    = useRouter();
  const socketRef = useSocket();

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [appt, setAppt]               = useState<CallAppointment | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [micOn, setMicOn]             = useState(true);
  const [camOn, setCamOn]             = useState(true);
  const [peerConnected, setPeer]      = useState(false);
  const endingRef                     = useRef(false);   // prevent double-redirect

  // useWebRTC uses DB polling now — no socketRef needed for signaling
  const { connState, remoteStream, hangup } = useWebRTC({
    appointmentId: id,
    role:          "doctor",
    localStreamRef,
  });

  const { lines, getFullText } = useTranscription({
    appointmentId: id,
    role:          "doctor",
    socketRef,
    enabled:       streamReady,
  });

  // Fetch appointment data (patient profile included)
  useEffect(() => {
    fetch(`/api/appointments/${id}`)
      .then(r => r.json())
      .then(d => d.appointment && setAppt(d.appointment))
      .catch(() => {});
  }, [id]);

  // Get camera + mic
  useEffect(() => {
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setStreamReady(true);
    }).catch(() => {});
    return () => {
      active = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Mark in_call + notify socket once stream ready
  useEffect(() => {
    if (!streamReady) return;
    fetch(`/api/appointments/${id}/start-call`, { method: "POST" }).catch(() => {});
    const socket = socketRef.current;
    if (socket) {
      socket.emit("call:join",         { appointmentId: id, role: "doctor" });
      socket.emit("call:doctor-ready", { appointmentId: id });
    }
  }, [streamReady, id, socketRef]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      setPeer(true);
    }
  }, [remoteStream]);

  // Poll appointment status — detects when patient ends call (works on Vercel)
  useEffect(() => {
    if (endingRef.current) return;
    const poll = async () => {
      try {
        const res  = await fetch(`/api/appointments/${id}`);
        const data = await res.json();
        if (data.appointment?.status === "post_call") {
          goToPostCall(getFullText());
        }
      } catch {}
    };
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Socket fast-path: patient ends call → immediate notification
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = () => goToPostCall(getFullText());
    socket.on("call:ended", handler);
    return () => { socket.off("call:ended", handler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef]);

  const goToPostCall = useCallback(async (transcript: string) => {
    if (endingRef.current) return;
    endingRef.current = true;
    hangup();
    await fetch(`/api/appointments/${id}/end-call`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ transcript }),
    }).catch(() => {});
    router.replace(`/doctor/post-call/${id}`);
  }, [id, hangup, router]);

  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicOn(m => !m);
  }, []);

  const toggleCam = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOn(c => !c);
  }, []);

  const handleEndCall = useCallback(async () => {
    socketRef.current?.emit("call:end", { appointmentId: id });
    await goToPostCall(getFullText());
  }, [id, socketRef, getFullText, goToPostCall]);

  if (!appt) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Videos + Transcript */}
        <div className="flex-1 flex flex-col p-4 gap-3">
          <div className="grid grid-cols-2 gap-3 flex-1">
            {/* Patient video */}
            <div className="relative rounded-2xl bg-slate-800 overflow-hidden">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {!peerConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  <p className="text-sm text-slate-300">
                    {connState === "connecting" ? "Connecting..." : "Waiting for patient..."}
                  </p>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/50 rounded-lg px-3 py-1 text-xs font-semibold">
                {appt.patientName}
              </div>
            </div>

            {/* Self view */}
            <div className="relative rounded-2xl bg-slate-800 overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay playsInline muted
                style={{ transform: "scaleX(-1)" }}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 bg-black/50 rounded-lg px-3 py-1 text-xs font-semibold">
                You (Doctor)
              </div>
            </div>
          </div>

          {/* Live transcript */}
          {lines.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 space-y-1 shrink-0">
              {lines.map((line, i) => (
                <p key={i} className="text-xs leading-relaxed">
                  <span className={`font-semibold ${line.role === "doctor" ? "text-blue-400" : "text-emerald-400"}`}>
                    {line.role === "doctor" ? "Doctor" : appt.patientName}:
                  </span>{" "}
                  <span className="text-slate-300">{line.text}</span>
                </p>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 shrink-0 py-2">
            <ControlButton onClick={toggleMic} active={micOn} label={micOn ? "Mute" : "Unmute"}>
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </ControlButton>
            <ControlButton onClick={toggleCam} active={camOn} label={camOn ? "Stop" : "Start"}>
              {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </ControlButton>
            <button onClick={handleEndCall} className="flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg active:scale-95">
                <PhoneOff className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-slate-400">End Call</span>
            </button>
          </div>
        </div>

        {/* Right panel: Patient report */}
        <div className="w-80 xl:w-96 shrink-0 overflow-hidden bg-white">
          <PatientReportPanel appointmentId={id} appt={appt} />
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  children, onClick, active, label,
}: { children: React.ReactNode; onClick: () => void; active: boolean; label: string }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow ${
        active ? "bg-slate-700 hover:bg-slate-600" : "bg-red-900/60 hover:bg-red-800/60"
      }`}>
        {children}
      </div>
      <span className="text-xs text-slate-400">{label}</span>
    </button>
  );
}
