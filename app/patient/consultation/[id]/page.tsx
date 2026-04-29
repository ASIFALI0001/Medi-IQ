"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useAgora } from "@/hooks/useAgora";
import { PrescriptionView } from "@/components/consultation/PrescriptionView";

export default function PatientConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const socketRef = useSocket();

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callEnded, setCallEnded] = useState(false);

  const { joined, remoteUsers, micOn, camOn, toggleMic, toggleCam, leave } = useAgora({
    appointmentId: id,
    role:          "patient",
    localVideoRef,
  });

  // Attach remote (doctor) video when available
  useEffect(() => {
    const user = remoteUsers.find(u => u.videoTrack);
    if (user?.videoTrack && remoteVideoRef.current) {
      user.videoTrack.play(remoteVideoRef.current);
    }
  }, [remoteUsers]);

  // Poll for call end (doctor ends call / post_call status)
  useEffect(() => {
    if (callEnded) return;
    const poll = async () => {
      try {
        const res  = await fetch(`/api/appointments/${id}`);
        const data = await res.json();
        const status = data.appointment?.status;
        if (status === "post_call" || status === "completed") {
          await leave();
          setCallEnded(true);
        }
      } catch {}
    };
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [id, callEnded, leave]);

  // Socket fast-path: doctor ends call
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = async () => { await leave(); setCallEnded(true); };
    socket.on("call:ended", handler);
    return () => { socket.off("call:ended", handler); };
  }, [socketRef, leave]);

  const endCall = useCallback(async () => {
    socketRef.current?.emit("call:end", { appointmentId: id });
    await fetch(`/api/appointments/${id}/end-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: "" }),
    }).catch(() => {});
    await leave();
    setCallEnded(true);
  }, [id, socketRef, leave]);

  if (callEnded) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4">
          <h1 className="font-bold text-slate-800">Your Prescription</h1>
        </div>
        <PrescriptionView appointmentId={id} />
      </div>
    );
  }

  const peerConnected = remoteUsers.some(u => u.videoTrack || u.audioTrack);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-white">
      <div className="flex-1 grid grid-cols-2 gap-3 p-4">
        {/* Doctor video */}
        <div className="relative rounded-2xl bg-slate-800 overflow-hidden">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          {!peerConnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-sm text-slate-300">
                {joined ? "Waiting for doctor…" : "Connecting…"}
              </p>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/50 rounded-lg px-3 py-1 text-xs font-semibold">Doctor</div>
        </div>

        {/* Self view */}
        <div className="relative rounded-2xl bg-slate-800 overflow-hidden">
          <video ref={localVideoRef} autoPlay playsInline muted
            style={{ transform: "scaleX(-1)" }} className="w-full h-full object-cover" />
          <div className="absolute bottom-3 left-3 bg-black/50 rounded-lg px-3 py-1 text-xs font-semibold">You</div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 px-4 pb-6">
        <Ctrl onClick={toggleMic} active={micOn} label={micOn ? "Mute" : "Unmute"}>
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Ctrl>
        <Ctrl onClick={toggleCam} active={camOn} label={camOn ? "Stop" : "Start"}>
          {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Ctrl>
        <button onClick={endCall} className="flex flex-col items-center gap-1.5">
          <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg active:scale-95">
            <PhoneOff className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs text-slate-400">End</span>
        </button>
      </div>
    </div>
  );
}

function Ctrl({ children, onClick, active, label }: { children: React.ReactNode; onClick: () => void; active: boolean; label: string }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow ${active ? "bg-slate-700 hover:bg-slate-600" : "bg-red-900/60"}`}>
        {children}
      </div>
      <span className="text-xs text-slate-400">{label}</span>
    </button>
  );
}
