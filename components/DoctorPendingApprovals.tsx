"use client";
import { useState, useEffect, useCallback } from "react";
import { Clock, CheckCircle2, XCircle, Stethoscope, Radio, FileText } from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";

interface PreConsultation {
  symptoms: string;
  duration: string;
  severity: string;
  currentMedications: string;
  additionalNotes: string;
  filledAt?: string;
}

interface Appointment {
  _id: string;
  patientName: string;
  specialization: string;
  status: string;
  bookedAt: string;
  consultationStartsAt: string;
  approvedAt?: string;
  preConsultation?: PreConsultation;
}

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const interval = setInterval(() => setRemaining(Math.max(0, targetMs - Date.now())), 1000);
    return () => clearInterval(interval);
  }, [targetMs]);
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return { remaining, mins, secs, expired: remaining === 0 };
}

function ApprovalCard({ appt, onAction }: { appt: Appointment; onAction: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  const doctorDeadlineMs = new Date(appt.bookedAt).getTime() + 5 * 60 * 1000;
  const consultMs = new Date(appt.consultationStartsAt).getTime();
  const approvalTimer = useCountdown(doctorDeadlineMs);
  const consultTimer = useCountdown(consultMs);

  const isConfirmed = appt.status === "confirmed";
  const isActive = appt.status === "active";
  const preConsFilled = !!appt.preConsultation?.filledAt;

  const handleAction = async (action: "approve" | "reject") => {
    setLoading(action);
    try {
      const res = await fetch(`/api/appointments/${appt._id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(action === "approve" ? "Appointment approved!" : "Appointment rejected.");
      onAction();
      router.refresh();
    } catch {
      toast.error("Action failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 animate-fade-in-up opacity-0 ${
      isActive ? "border-emerald-200" : isConfirmed ? "border-blue-100" : "border-amber-100"
    }`} style={{ animationFillMode: "forwards" }}>
      {/* Patient info + timer */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-violet-400 to-blue-500 flex items-center justify-center text-white font-bold shrink-0">
            {appt.patientName.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{appt.patientName}</p>
            <p className="text-slate-500 text-xs capitalize">{appt.specialization}</p>
          </div>
        </div>

        {/* Timer chip */}
        {isActive ? (
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl px-3 py-1.5 text-xs font-semibold">
            <Radio className="w-3 h-3 animate-pulse" /> Live
          </div>
        ) : isConfirmed ? (
          <div className="text-center bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
            <p className="text-xs font-semibold text-blue-600">Starts in</p>
            <p className="text-sm font-bold text-blue-700 tabular-nums">
              {String(consultTimer.mins).padStart(2, "0")}:{String(consultTimer.secs).padStart(2, "0")}
            </p>
          </div>
        ) : approvalTimer.expired ? (
          <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-1.5 text-xs font-semibold text-red-600">
            Expired
          </div>
        ) : (
          <div className="text-center bg-amber-50 border border-amber-100 rounded-xl px-3 py-1.5">
            <p className="text-xs font-semibold text-amber-600">Approve within</p>
            <p className="text-sm font-bold text-amber-700 tabular-nums">
              {String(approvalTimer.mins).padStart(2, "0")}:{String(approvalTimer.secs).padStart(2, "0")}
            </p>
          </div>
        )}
      </div>

      {/* Pre-consultation data */}
      {preConsFilled && appt.preConsultation && (
        <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Pre-Consultation Data</p>
          </div>
          <InfoRow label="Symptoms" value={appt.preConsultation.symptoms} />
          <InfoRow label="Duration" value={appt.preConsultation.duration} />
          <InfoRow label="Severity" value={appt.preConsultation.severity} capitalize />
          {appt.preConsultation.currentMedications && (
            <InfoRow label="Medications" value={appt.preConsultation.currentMedications} />
          )}
          {appt.preConsultation.additionalNotes && (
            <InfoRow label="Notes" value={appt.preConsultation.additionalNotes} />
          )}
        </div>
      )}

      {!preConsFilled && !isConfirmed && !isActive && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
          <Clock className="w-3.5 h-3.5 shrink-0 animate-pulse" />
          Patient is filling pre-consultation details...
        </div>
      )}

      {/* Actions */}
      {!isConfirmed && !isActive && !approvalTimer.expired && (
        <div className="flex gap-3 pt-1">
          <Button
            variant="success"
            size="sm"
            loading={loading === "approve"}
            onClick={() => handleAction("approve")}
            className="flex-1 gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={loading === "reject"}
            onClick={() => handleAction("reject")}
            className="flex-1 gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </Button>
        </div>
      )}

      {isConfirmed && (
        <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-xl px-3 py-2 border border-blue-100">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Approved — consultation will begin shortly.
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-400 font-semibold shrink-0 w-20">{label}</span>
      <span className={`text-slate-700 ${capitalize ? "capitalize" : ""}`}>{value}</span>
    </div>
  );
}

export default function DoctorPendingApprovals() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [checked, setChecked] = useState(false);

  const TERMINAL = ["completed", "post_call", "in_call", "rejected", "cancelled"];

  const poll = useCallback(async () => {
    const res = await fetch("/api/appointments/active");
    const data = await res.json();
    // Only show appointments that genuinely need doctor approval action
    if (data.appointment && !TERMINAL.includes(data.appointment.status)) {
      setAppointments([data.appointment]);
    } else {
      setAppointments([]);
    }
    setChecked(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [poll]);

  if (!checked) return null;

  if (appointments.length === 0) return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
      <Stethoscope className="w-8 h-8 text-slate-200 mx-auto mb-2" />
      <p className="text-slate-400 text-sm">No pending consultations</p>
      <p className="text-slate-300 text-xs mt-1">Go Live to start receiving requests</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {appointments.map((appt) => (
        <ApprovalCard key={appt._id} appt={appt} onAction={poll} />
      ))}
    </div>
  );
}
