"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Radio, Clock, ArrowLeft, XCircle } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";

export default function WaitingRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }      = use(params);
  const router      = useRouter();
  const socketRef   = useSocket();
  const [dots, setDots]           = useState("...");
  const [cancelled, setCancelled] = useState(false);
  const enteredRef  = useRef(false);

  // Animated dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);

  // Enter waiting room
  useEffect(() => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    fetch(`/api/appointments/${id}/enter-waiting-room`, { method: "POST" }).catch(() => {});
    socketRef.current?.emit("waiting-room:enter", { appointmentId: id });
  }, [id, socketRef]);

  // Socket events
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onDoctorReady  = () => router.replace(`/patient/consultation/${id}`);
    const onCancelled    = () => setCancelled(true);

    socket.on("call:doctor-ready",     onDoctorReady);
    socket.on("appointment:cancelled", onCancelled);

    return () => {
      socket.off("call:doctor-ready",     onDoctorReady);
      socket.off("appointment:cancelled", onCancelled);
    };
  }, [id, router, socketRef]);

  // Poll as fallback
  useEffect(() => {
    const poll = async () => {
      try {
        const res    = await fetch(`/api/appointments/${id}`);
        const data   = await res.json();
        const status = data.appointment?.status;
        if (status === "in_call" || status === "post_call" || status === "completed") {
          router.replace(`/patient/consultation/${id}`);
        }
        if (status === "cancelled" || status === "rejected") {
          setCancelled(true);
        }
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [id, router]);

  // ── Cancelled state ───────────────────────────────────────────────────────
  if (cancelled) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md space-y-5">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Appointment Cancelled</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Your doctor has cancelled this appointment.<br />
              You can book another consultation at any time.
            </p>
          </div>
          <button
            onClick={() => router.replace("/patient/dashboard")}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-6 py-3 transition-all active:scale-95"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Waiting state ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-md space-y-6">
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-40" />
          <div className="absolute inset-2 rounded-full bg-blue-200 animate-ping opacity-30" />
          <div className="relative w-full h-full rounded-full bg-blue-600 flex items-center justify-center shadow-xl">
            <Radio className="w-10 h-10 text-white" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Waiting for Doctor{dots}
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Your doctor has been notified and can connect at any time.<br />
            Please stay on this page with your camera and microphone ready.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3 text-left">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">While you wait</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500 shrink-0" />
              Sit in a quiet, well-lit place
            </li>
            <li className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-500 shrink-0" />
              Check your camera and microphone work
            </li>
          </ul>
        </div>

        <button
          onClick={() => {
            socketRef.current?.emit("waiting-room:exit", { appointmentId: id });
            router.back();
          }}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 font-medium mx-auto"
        >
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    </div>
  );
}
