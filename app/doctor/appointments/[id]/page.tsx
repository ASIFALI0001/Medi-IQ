import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/lib/models/Appointment";
import PatientProfile from "@/lib/models/PatientProfile";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, FileText, Brain, Pill, MessageSquare, Activity } from "lucide-react";

function fmt(d: Date | string | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) +
    " · " + date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default async function DoctorAppointmentDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "doctor") redirect("/login");

  await connectDB();
  const raw = await Appointment.findOne({ _id: id, doctorRef: authUser.userId }).lean();
  if (!raw) notFound();

  const appt = raw as unknown as {
    _id: string;
    patientRef: string;
    patientName: string;
    consultationStartsAt: Date;
    status: string;
    preConsultation?: {
      symptoms?: string;
      duration?: string;
      severity?: string;
      currentMedications?: string;
      additionalNotes?: string;
      vitals?: { sbp?: number; dbp?: number; hr?: number; bp_classification?: string; hr_classification?: string };
    };
    transcript?: string;
    aiReport?: { summary?: string; conditions?: string[]; questions?: string[] };
    prescription?: {
      diagnosis?: string;
      medicines?: Array<{ medicine: string; dosage: string; timing: string; frequency: string; duration: string }>;
      advice?: string;
    };
    prescriptionSentAt?: Date;
  };

  // Fetch the patient's health profile for full clinical context
  const profileRaw = await PatientProfile.findOne({ userRef: appt.patientRef }).lean();
  const profile = profileRaw as unknown as {
    age?: number;
    gender?: string;
    weight?: number;
    height?: number;
    bloodGroup?: string;
    knownConditions?: string[];
    allergies?: string[];
    currentMedications?: string[];
    emergencyContact?: { name?: string; relationship?: string; phone?: string };
  } | null;

  const pc     = appt.preConsultation;
  const vitals = pc?.vitals;
  const rx     = appt.prescription;
  const ai     = appt.aiReport;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Link href="/doctor/appointments" className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Consultation Record</h1>
          <p className="text-slate-500 text-sm">{appt.patientName} · {fmt(appt.consultationStartsAt)}</p>
        </div>
      </div>

      {/* Patient health profile */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-slate-700 text-sm">Patient Profile</h2>
        </div>

        {/* Demographics row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Info label="Name"         value={appt.patientName} />
          <Info label="Age"          value={profile?.age != null ? `${profile.age} yrs` : undefined} />
          <Info label="Gender"       value={profile?.gender}  className="capitalize" />
          <Info label="Weight"       value={profile?.weight != null ? `${profile.weight} kg` : undefined} />
          <Info label="Height"       value={profile?.height != null ? `${profile.height} cm` : undefined} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Info label="Blood Group"  value={profile?.bloodGroup} />
        </div>

        {/* Medical history */}
        {(profile?.knownConditions?.length || profile?.allergies?.length || profile?.currentMedications?.length) && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            {profile?.knownConditions?.length ? (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Known Conditions</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.knownConditions.map((c, i) => (
                    <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-100 px-2.5 py-0.5 rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {profile?.allergies?.length ? (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Allergies</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.allergies.map((a, i) => (
                    <span key={i} className="text-xs bg-red-50 text-red-700 border border-red-100 px-2.5 py-0.5 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {profile?.currentMedications?.length ? (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Ongoing Medications</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.currentMedications.map((m, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded-full">{m}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {!profile && (
          <p className="text-xs text-slate-400 mt-2">Patient has not completed their health profile.</p>
        )}
      </section>

      {/* Pre-consultation form */}
      {pc && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-slate-700 text-sm">Pre-Consultation Form</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Info label="Symptoms"  value={pc.symptoms} />
            <Info label="Duration"  value={pc.duration} />
            <Info label="Severity"  value={pc.severity} className="capitalize" />
            {pc.currentMedications && <Info label="Medications Mentioned" value={pc.currentMedications} />}
            {pc.additionalNotes    && <Info label="Additional Notes"       value={pc.additionalNotes}    className="col-span-2" />}
          </div>
          {vitals && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-rose-500" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vitals at Consultation</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <VitalChip label="Blood Pressure" value={`${vitals.sbp}/${vitals.dbp} mmHg`} sub={vitals.bp_classification} />
                <VitalChip label="Heart Rate"     value={`${vitals.hr} bpm`}                 sub={vitals.hr_classification} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* AI pre-call analysis */}
      {ai && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-violet-600" />
            <h2 className="font-semibold text-slate-700 text-sm">AI Pre-Call Analysis</h2>
          </div>
          {ai.summary && <p className="text-sm text-slate-600 mb-4 leading-relaxed">{ai.summary}</p>}
          {ai.conditions && ai.conditions.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Probable Conditions</p>
              <ul className="space-y-1">
                {ai.conditions.map((c, i) => (
                  <li key={i} className="text-sm text-slate-600 flex gap-2">
                    <span className="text-violet-400 shrink-0">•</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ai.questions && ai.questions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Suggested Questions</p>
              <ul className="space-y-1">
                {ai.questions.map((q, i) => (
                  <li key={i} className="text-sm text-slate-600 flex gap-2">
                    <span className="text-violet-400 shrink-0">{i + 1}.</span>{q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Call transcript */}
      {appt.transcript && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-slate-700 text-sm">Call Transcript</h2>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 max-h-64 overflow-y-auto">
            {appt.transcript.split("\n").map((line, i) => {
              const isDoc = line.startsWith("Doctor:");
              const isPat = line.startsWith("Patient:");
              return (
                <p key={i} className="text-sm mb-1.5 leading-relaxed">
                  {(isDoc || isPat) ? (
                    <>
                      <span className={`font-semibold ${isDoc ? "text-blue-600" : "text-emerald-600"}`}>
                        {isDoc ? "Doctor" : appt.patientName}:
                      </span>
                      <span className="text-slate-600">{line.replace(/^(Doctor|Patient):/, "")}</span>
                    </>
                  ) : (
                    <span className="text-slate-600">{line}</span>
                  )}
                </p>
              );
            })}
          </div>
        </section>
      )}

      {/* Prescription */}
      {rx && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-slate-700 text-sm">Prescription Issued</h2>
            {appt.prescriptionSentAt && (
              <span className="ml-auto text-xs text-slate-400">{fmt(appt.prescriptionSentAt)}</span>
            )}
          </div>
          {rx.diagnosis && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Diagnosis</p>
              <p className="text-sm text-blue-900">{rx.diagnosis}</p>
            </div>
          )}
          {rx.medicines && rx.medicines.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Medicines</p>
              {rx.medicines.map((m, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{m.medicine}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[m.dosage, m.timing, m.frequency, m.duration].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {rx.advice && (
            <div className="bg-emerald-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Advice</p>
              <p className="text-sm text-emerald-900 leading-relaxed">{rx.advice}</p>
            </div>
          )}
        </section>
      )}

      {!pc && !rx && !appt.transcript && !ai && (
        <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200">
          No consultation data recorded yet.
        </div>
      )}
    </div>
  );
}

function Info({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}

function VitalChip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-slate-800 text-sm">{value}</p>
      {sub && <p className="text-xs text-slate-400 capitalize">{sub}</p>}
    </div>
  );
}
