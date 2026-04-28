"use client";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Clock, CheckCircle2, AlertCircle, Stethoscope, Radio } from "lucide-react";
import Button from "@/components/ui/Button";
import { VitalsScanModal } from "@/components/vitals/VitalsScanModal";
import type { VitalsResult, VitalsDemographics } from "@/types/vitals";

interface Appointment {
  _id: string;
  doctorName: string;
  specialization: string;
  consultationFee: number;
  status: string;
  bookedAt: string;
  consultationStartsAt: string;
  approvedAt?: string;
  preConsultation?: { filledAt: string };
}

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, targetMs - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetMs]);
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return { remaining, mins, secs, expired: remaining === 0 };
}

export default function PreConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    symptoms: "",
    duration: "",
    severity: "moderate" as "mild" | "moderate" | "severe",
    currentMedications: "",
    additionalNotes: "",
  });
  const [showVitals, setShowVitals]     = useState(false);
  const [vitals, setVitals]             = useState<VitalsResult | null>(null);
  const [demographics, setDemographics] = useState<VitalsDemographics | null>(null);

  // Fetch patient profile for vitals modal demographics
  useEffect(() => {
    fetch("/api/patient/profile")
      .then(r => r.json())
      .then(d => {
        if (d.profile) {
          setDemographics({
            age:    d.profile.age,
            sex:    d.profile.gender === "Male" ? "M" : "F",
            height: d.profile.height ?? undefined,
            weight: d.profile.weight ?? undefined,
          });
        }
      })
      .catch(() => { /* vitals section will just be hidden */ });
  }, []);

  const fetchAppt = useCallback(async () => {
    const res = await fetch(`/api/appointments/${id}`);
    const data = await res.json();
    if (data.appointment) {
      setAppt(data.appointment);
      if (data.appointment.preConsultation?.filledAt) setSubmitted(true);
    }
    setLoading(false);
  }, [id]);

  // Poll every 5 seconds to track status changes
  useEffect(() => {
    fetchAppt();
    const interval = setInterval(fetchAppt, 5000);
    return () => clearInterval(interval);
  }, [fetchAppt]);

  const patientDeadlineMs = appt ? new Date(appt.bookedAt).getTime() + 5 * 60 * 1000 : Date.now();
  const consultationMs = appt ? new Date(appt.consultationStartsAt).getTime() : Date.now();

  const patientTimer = useCountdown(patientDeadlineMs);
  const consultationTimer = useCountdown(consultationMs);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.symptoms.trim() || !form.duration.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { ...form };
      if (vitals) {
        body.vitals = {
          sbp:               vitals.blood_pressure.systolic.value,
          dbp:               vitals.blood_pressure.diastolic.value,
          hr:                vitals.heart_rate.value,
          bp_classification: vitals.classification.bp,
          hr_classification: vitals.classification.hr,
          confidence:        vitals.confidence,
        };
      }
      const res = await fetch(`/api/appointments/${id}/pre-consultation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success("Details submitted! Waiting for doctor approval.");
      setSubmitted(true);
      setAppt(data.appointment);
    } catch {
      toast.error("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  if (!appt) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-slate-500">Appointment not found.</p>
    </div>
  );

  const isRejected = appt.status === "rejected" || appt.status === "cancelled";
  const isConfirmed = appt.status === "confirmed";
  const isActive = appt.status === "active";

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-6">
      <div className="w-full max-w-2xl space-y-5">

        {/* Doctor info card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4 animate-fade-in-up">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {appt.doctorName.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-800">Dr. {appt.doctorName}</p>
            <p className="text-slate-500 text-xs capitalize">{appt.specialization}</p>
          </div>
          <p className="font-bold text-slate-800">₹{appt.consultationFee}</p>
        </div>

        {/* Status + Timers */}
        <div className="grid grid-cols-2 gap-4 animate-fade-in-up stagger-1 opacity-0" style={{ animationFillMode: "forwards" }}>
          {/* Patient timer */}
          <div className={`rounded-2xl p-5 text-center ${
            submitted ? "bg-emerald-50 border border-emerald-100" :
            patientTimer.expired ? "bg-red-50 border border-red-100" :
            "bg-blue-50 border border-blue-100"
          }`}>
            {submitted ? (
              <>
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-emerald-700">Details Submitted</p>
              </>
            ) : patientTimer.expired ? (
              <>
                <AlertCircle className="w-7 h-7 text-red-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-red-700">Time Expired</p>
              </>
            ) : (
              <>
                <Clock className="w-7 h-7 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-700 tabular-nums">
                  {String(patientTimer.mins).padStart(2, "0")}:{String(patientTimer.secs).padStart(2, "0")}
                </p>
                <p className="text-xs font-semibold text-blue-600 mt-1">Fill your details</p>
              </>
            )}
          </div>

          {/* Consultation timer */}
          <div className={`rounded-2xl p-5 text-center ${
            isActive ? "bg-emerald-50 border border-emerald-100" :
            isRejected ? "bg-red-50 border border-red-100" :
            consultationTimer.expired ? "bg-emerald-50 border border-emerald-100" :
            "bg-violet-50 border border-violet-100"
          }`}>
            {isRejected ? (
              <>
                <AlertCircle className="w-7 h-7 text-red-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-red-700">Consultation Rejected</p>
              </>
            ) : isActive || consultationTimer.expired ? (
              <>
                <Radio className="w-7 h-7 text-emerald-500 mx-auto mb-2 animate-pulse" />
                <p className="text-xs font-semibold text-emerald-700">Consultation Active</p>
              </>
            ) : (
              <>
                <Stethoscope className="w-7 h-7 text-violet-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-violet-700 tabular-nums">
                  {String(consultationTimer.mins).padStart(2, "0")}:{String(consultationTimer.secs).padStart(2, "0")}
                </p>
                <p className="text-xs font-semibold text-violet-600 mt-1">
                  {isConfirmed ? "Consultation starts in" : "Waiting for approval"}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Approval status banner */}
        {!isRejected && (
          <div className={`rounded-2xl p-4 flex items-center gap-3 animate-fade-in-up stagger-2 opacity-0 ${
            isConfirmed || isActive
              ? "bg-emerald-50 border border-emerald-100"
              : "bg-amber-50 border border-amber-100"
          }`} style={{ animationFillMode: "forwards" }}>
            {isConfirmed || isActive ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
            )}
            <div>
              <p className={`text-sm font-semibold ${isConfirmed || isActive ? "text-emerald-800" : "text-amber-800"}`}>
                {isConfirmed || isActive ? "Doctor Approved Your Request" : "Waiting for Doctor Approval"}
              </p>
              <p className={`text-xs mt-0.5 ${isConfirmed || isActive ? "text-emerald-600" : "text-amber-600"}`}>
                {isConfirmed || isActive
                  ? "Your consultation has been confirmed."
                  : "The doctor has 5 minutes to accept your request."}
              </p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center animate-fade-in">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="font-semibold text-red-800">Consultation Rejected or Expired</p>
            <p className="text-red-600 text-xs mt-1 mb-4">The doctor did not accept in time, or the request was declined.</p>
            <Button onClick={() => router.push("/patient/book-appointment")} variant="outline" size="sm">
              Book Another Doctor
            </Button>
          </div>
        )}

        {/* Pre-consultation form */}
        {!submitted && !isRejected && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up stagger-3 opacity-0" style={{ animationFillMode: "forwards" }}>
            <h2 className="font-bold text-slate-800 mb-1">Pre-Consultation Details</h2>
            <p className="text-slate-500 text-xs mb-5">
              Help your doctor prepare — fill this within 5 minutes of booking.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="What are your main symptoms? *">
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Headache, fever, sore throat..."
                  value={form.symptoms}
                  onChange={(e) => setForm((p) => ({ ...p, symptoms: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="How long have you had these symptoms? *">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3 days, 1 week..."
                    value={form.duration}
                    onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </Field>

                <Field label="Severity">
                  <select
                    value={form.severity}
                    onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value as "mild" | "moderate" | "severe" }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </Field>
              </div>

              <Field label="Current medications (if any)">
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 500mg..."
                  value={form.currentMedications}
                  onChange={(e) => setForm((p) => ({ ...p, currentMedications: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </Field>

              <Field label="Anything else the doctor should know?">
                <textarea
                  rows={2}
                  placeholder="Additional context, previous diagnoses, allergies..."
                  value={form.additionalNotes}
                  onChange={(e) => setForm((p) => ({ ...p, additionalNotes: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                />
              </Field>

              {/* Vitals scan — shown only when demographics are available */}
              {demographics && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    📊 Vitals Scan <span className="font-normal text-blue-600">(optional)</span>
                  </p>
                  <p className="text-xs text-slate-600 mb-3">
                    Share a quick BP &amp; heart rate reading from your camera. Takes 30 seconds.
                  </p>

                  {!vitals ? (
                    <button
                      type="button"
                      onClick={() => setShowVitals(true)}
                      className="inline-flex items-center gap-2 bg-white hover:bg-blue-100 border border-blue-200 text-blue-800 font-medium rounded-xl px-4 py-2 text-sm transition-colors"
                    >
                      📹 Start 30-second scan
                    </button>
                  ) : (
                    <div className="bg-white rounded-xl border border-emerald-200 p-3 flex items-center justify-between">
                      <div className="text-sm">
                        <p className="font-semibold text-slate-800">
                          BP {vitals.blood_pressure.systolic.value.toFixed(0)}&nbsp;/&nbsp;
                          {vitals.blood_pressure.diastolic.value.toFixed(0)} mmHg
                          <span className="ml-2 text-slate-500 font-normal">
                            ({vitals.classification.bp})
                          </span>
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          HR {vitals.heart_rate.value.toFixed(0)} bpm
                          <span className="ml-1">({vitals.classification.hr})</span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => setShowVitals(true)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Rescan
                        </button>
                        <button
                          type="button"
                          onClick={() => setVitals(null)}
                          className="text-xs text-slate-400 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                loading={submitting}
                disabled={patientTimer.expired}
                className="w-full py-3! text-base!"
              >
                {patientTimer.expired ? "Time Expired" : "Submit Details"}
              </Button>
            </form>
          </div>
        )}

        {/* Vitals scan modal */}
        {showVitals && demographics && (
          <VitalsScanModal
            demographics={demographics}
            onComplete={(v) => { setVitals(v); setShowVitals(false); }}
            onCancel={() => setShowVitals(false)}
          />
        )}

        {/* Submitted state */}
        {submitted && !isRejected && (
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-6 text-center animate-fade-in">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h2 className="font-bold text-slate-800 mb-1">Details Submitted!</h2>
            <p className="text-slate-500 text-sm">
              {isConfirmed || isActive
                ? "Your doctor has approved. You can now connect."
                : "Your doctor can now see your details. Waiting for their approval."}
            </p>

            {/* Connect with Doctor button — shown when appointment is approved/active */}
            {(isActive || isConfirmed) && (
              <button
                onClick={() => router.push(`/patient/waiting-room/${id}`)}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl py-3 transition-all active:scale-95 shadow-md"
              >
                <Radio className="w-4 h-4" />
                Connect with Doctor
              </button>
            )}

            {/* DEV ONLY — remove before production */}
            {isConfirmed && !isActive && (
              <SkipWaitButton appointmentId={id} onSkipped={fetchAppt} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}

// DEV ONLY — remove before production
function SkipWaitButton({ appointmentId, onSkipped }: { appointmentId: string; onSkipped: () => void }) {
  const [loading, setLoading] = useState(false);

  const skip = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/skip-wait`, { method: "POST" });
      if (res.ok) { toast.success("⏩ Wait skipped — consultation is now live!"); onSkipped(); }
      else { const d = await res.json(); toast.error(d.error); }
    } catch { toast.error("Failed"); }
    finally { setLoading(false); }
  };

  return (
    <button
      onClick={skip}
      disabled={loading}
      className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
    >
      {loading ? "Skipping..." : "⏩ DEV: Skip Wait"}
    </button>
  );
}
