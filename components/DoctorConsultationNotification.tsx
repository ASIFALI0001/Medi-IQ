"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, User, X } from "lucide-react";
import toast from "react-hot-toast";
import { useSocket } from "@/hooks/useSocket";
import Button from "@/components/ui/Button";

interface ActiveAppt {
  _id:          string;
  patientName:  string;
  status:       string;
  waitingRoomAt?: string;
}

export default function DoctorConsultationNotification() {
  const router    = useRouter();
  const socketRef = useSocket();
  const [appts, setAppts]         = useState<ActiveAppt[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res  = await fetch("/api/appointments?role=doctor&status=active,in_call,post_call");
      const data = await res.json();
      setAppts((data.appointments ?? []).filter((a: ActiveAppt) =>
        ["active", "in_call", "post_call"].includes(a.status)
      ));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Subscribe to waiting-room socket events
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || appts.length === 0) return;
    appts.forEach(a => socket.emit("doctor:watch", { appointmentId: a._id }));

    const handler = ({ appointmentId }: { appointmentId: string }) => {
      setAppts(prev =>
        prev.map(a => a._id === appointmentId ? { ...a, waitingRoomAt: new Date().toISOString() } : a)
      );
    };
    socket.on("patient:waiting", handler);
    return () => { socket.off("patient:waiting", handler); };
  }, [appts, socketRef]);

  const handleCancel = useCallback(async (apptId: string, patientName: string) => {
    if (!confirm(`Cancel the appointment with ${patientName}? This cannot be undone.`)) return;
    setCancelling(apptId);
    try {
      const res = await fetch(`/api/appointments/${apptId}/cancel`, { method: "POST" });
      if (!res.ok) { toast.error("Could not cancel appointment"); return; }
      // Notify patient in waiting room via socket
      socketRef.current?.emit("appointment:cancel", { appointmentId: apptId });
      toast.success("Appointment cancelled");
      setAppts(prev => prev.filter(a => a._id !== apptId));
    } catch {
      toast.error("Network error");
    } finally {
      setCancelling(null);
    }
  }, [socketRef]);

  const patientWaiting = appts.filter(a => a.status === "active" && a.waitingRoomAt);
  const inCall         = appts.filter(a => a.status === "in_call");
  const postCall       = appts.filter(a => a.status === "post_call");

  if (appts.length === 0) return null;

  return (
    <div className="space-y-3">

      {/* Patient waiting */}
      {patientWaiting.map(a => (
        <div key={a._id} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-emerald-800 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block shrink-0" />
                {a.patientName} is waiting
              </p>
              <p className="text-emerald-600 text-xs">Ready for consultation</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={() => router.push(`/doctor/consultation/${a._id}`)}>
              Connect
            </Button>
            <button
              onClick={() => handleCancel(a._id, a.patientName)}
              disabled={cancelling === a._id}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg px-3 py-1.5 font-semibold transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              {cancelling === a._id ? "..." : "Cancel"}
            </button>
          </div>
        </div>
      ))}

      {/* Active call */}
      {inCall.map(a => (
        <div key={a._id} className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-blue-600 animate-pulse shrink-0" />
            <div>
              <p className="font-bold text-blue-800 text-sm">Call with {a.patientName}</p>
              <p className="text-blue-600 text-xs">In progress</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push(`/doctor/consultation/${a._id}`)}>
            Rejoin
          </Button>
        </div>
      ))}

      {/* Post call — write prescription */}
      {postCall.map(a => (
        <div key={a._id} className="bg-violet-50 border border-violet-200 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="font-bold text-violet-800 text-sm">{a.patientName} — Write Prescription</p>
              <p className="text-violet-600 text-xs">Call ended · Patient waiting</p>
            </div>
          </div>
          <Button size="sm" onClick={() => router.push(`/doctor/post-call/${a._id}`)}>
            Write Rx
          </Button>
        </div>
      ))}
    </div>
  );
}
