"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useTranscription } from "@/hooks/useTranscription";
import { PrescriptionView } from "@/components/consultation/PrescriptionView";

export default function PatientConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const socketRef = useSocket();

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [streamReady, setStreamReady] = useState(false);
  const [micOn,  setMicOn]  = useState(true);
  const [camOn,  setCamOn]  = useState(true);
  const [callEnded, setCallEnded]    = useState(false);
  const [peerConnected, setPeerConn] = useState(false);

  // useWebRTC uses DB polling — streamReady gates offer processing
  const { connState, remoteStream, hangup } = useWebRTC({
    appointmentId: id,
    role:          "patient",
    localStreamRef,
    streamReady,
  });

  const { lines } = useTranscription({
    appointmentId: id,
    role:          "patient",
    socketRef,
    enabled:       streamReady && !callEnded,
  });

  // Get camera + mic
  useEffect(() => {
    let active = true;
    console.log("[Patient] Requesting camera + mic…");
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        console.log("[Patient] getUserMedia ✓ tracks:", stream.getTracks().map(t => `${t.kind}(${t.readyState})`));
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          console.log("[Patient] local video srcObject set");
        } else {
          console.warn("[Patient] localVideoRef is null when stream ready");
        }
        setStreamReady(true);
      })
      .catch(err => {
        console.error("[Patient] getUserMedia FAILED:", err.name, err.message);
      });
    return () => {
      active = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Log connState changes
  useEffect(() => {
    console.log("[Patient] connState changed →", connState);
  }, [connState]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteStream) {
      console.log("[Patient] remoteStream received, tracks:", remoteStream.getTracks().map(t => `${t.kind}(${t.readyState})`));
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      console.log("[Patient] remote video srcObject set ✓");
      setPeerConn(true);
    }
  }, [remoteStream]);

  // Poll appointment status to detect when call ends (works on Vercel without Socket.io)
  useEffect(() => {
    if (callEnded) return;
    const poll = async () => {
      try {
        const res  = await fetch(`/api/appointments/${id}`);
        const data = await res.json();
        const status = data.appointment?.status;
        if (status === "post_call" || status === "completed") {
          hangup();
          setCallEnded(true);
        }
      } catch {}
    };
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [id, callEnded, hangup]);

  // Socket fast-path: doctor ends call → immediate notification
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = () => { hangup(); setCallEnded(true); };
    socket.on("call:ended", handler);
    return () => { socket.off("call:ended", handler); };
  }, [socketRef, hangup]);

  const endCall = useCallback(async () => {
    const fullText = lines.map(l =>
      `${l.role === "doctor" ? "Doctor" : "Patient"}: ${l.text}`
    ).join("\n");
    socketRef.current?.emit("call:end", { appointmentId: id });
    await fetch(`/api/appointments/${id}/end-call`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: fullText }),
    }).catch(() => {});
    hangup();
    setCallEnded(true);
  }, [id, lines, socketRef, hangup]);

  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicOn(m => !m);
  }, []);

  const toggleCam = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOn(c => !c);
  }, []);

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
                {connState === "connecting" ? "Connecting..." : "Waiting for doctor..."}
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

      {lines.length > 0 && (
        <div className="mx-4 mb-3 max-h-28 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 space-y-1">
          {lines.map((line, i) => (
            <p key={i} className="text-xs leading-relaxed">
              <span className={`font-semibold ${line.role === "doctor" ? "text-blue-400" : "text-emerald-400"}`}>
                {line.role === "doctor" ? "Doctor" : "You"}:
              </span>{" "}
              <span className="text-slate-300">{line.text}</span>
            </p>
          ))}
        </div>
      )}

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
