"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useAgora } from "@/hooks/useAgora";
import { PatientReportPanel } from "@/components/consultation/PatientReportPanel";
import type { CallAppointment } from "@/types/consultation";

interface Props { params: Promise<{ id: string }> }

export default function DoctorConsultationPage({ params }: Props) {
  const { id }    = use(params);
  const router    = useRouter();
  const socketRef = useSocket();

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const endingRef      = useRef(false);

  const [appt, setAppt] = useState<CallAppointment | null>(null);

  const { joined, remoteUsers, micOn, camOn, toggleMic, toggleCam, leave } = useAgora({
    appointmentId: id,
    role:          "doctor",
    localVideoRef,
  });

  // Fetch appointment data
  useEffect(() => {
    fetch(`/api/appointments/${id}`)
      .then(r => r.json())
      .then(d => d.appointment && setAppt(d.appointment))
      .catch(() => {});
  }, [id]);

  // Mark appointment as in_call + notify patient via socket
  useEffect(() => {
    if (!joined) return;
    fetch(`/api/appointments/${id}/start-call`, { method: "POST" }).catch(() => {});
    socketRef.current?.emit("call:doctor-ready", { appointmentId: id });
  }, [joined, id, socketRef]);

  // Attach remote video when a remote user publishes their video track
  useEffect(() => {
    const user = remoteUsers.find(u => u.videoTrack);
    if (user?.videoTrack && remoteVideoRef.current) {
      user.videoTrack.play(remoteVideoRef.current);
    }
  }, [remoteUsers]);

  // Poll appointment status — detects when patient ends call
  useEffect(() => {
    if (endingRef.current) return;
    const poll = async () => {
      try {
        const res  = await fetch(`/api/appointments/${id}`);
        const data = await res.json();
        if (data.appointment?.status === "post_call") goToPostCall();
      } catch {}
    };
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Socket fast-path: patient ends call
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = () => goToPostCall();
    socket.on("call:ended", handler);
    return () => { socket.off("call:ended", handler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef]);

  const goToPostCall = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    console.log("[Doctor] Ending call — waiting for Whisper transcription…");
    const transcript = await leave();
    await fetch(`/api/appointments/${id}/end-call`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ transcript }),
    }).catch(() => {});
    router.replace(`/doctor/post-call/${id}`);
  }, [id, leave, router]);

  const handleEndCall = useCallback(async () => {
    socketRef.current?.emit("call:end", { appointmentId: id });
    await goToPostCall();
  }, [id, socketRef, goToPostCall]);

  const peerConnected = remoteUsers.some(u => u.videoTrack || u.audioTrack);

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

        {/* Left: Videos + Controls */}
        <div className="flex-1 flex flex-col p-4 gap-3">
          <div className="grid grid-cols-2 gap-3 flex-1">
            {/* Remote (patient) video */}
            <div className="relative rounded-2xl bg-slate-800 overflow-hidden">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {!peerConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  <p className="text-sm text-slate-300">
                    {joined ? "Waiting for patient…" : "Connecting…"}
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
