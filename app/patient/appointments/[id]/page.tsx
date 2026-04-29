import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/lib/models/Appointment";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Stethoscope, CalendarDays, Pill, MessageSquare } from "lucide-react";

function fmt(d: Date | string | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) +
    " · " + date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default async function PatientAppointmentDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "patient") redirect("/login");

  await connectDB();
  const raw = await Appointment.findOne({ _id: id, patientRef: authUser.userId }).lean();
  if (!raw) notFound();

  const appt = raw as unknown as {
    _id: string;
    doctorName: string;
    specialization: string;
    consultationFee: number;
    consultationStartsAt: Date;
    status: string;
    preConsultation?: { symptoms?: string; duration?: string; severity?: string };
    transcript?: string;
    prescription?: {
      diagnosis?: string;
      medicines?: Array<{ medicine: string; dosage: string; timing: string; frequency: string; duration: string }>;
      advice?: string;
    };
    prescriptionSentAt?: Date;
  };

  const rx = appt.prescription;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Link href="/patient/appointments" className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Appointment Details</h1>
          <p className="text-slate-500 text-sm">Dr. {appt.doctorName} · {fmt(appt.consultationStartsAt)}</p>
        </div>
      </div>

      {/* Summary card */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
            <Stethoscope className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Dr. {appt.doctorName}</p>
            <p className="text-slate-500 text-sm capitalize">{appt.specialization}</p>
          </div>
          <span className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full capitalize ${
            appt.status === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
            appt.status === "cancelled" ? "bg-slate-100 text-slate-500" :
            "bg-orange-50 text-orange-700 border border-orange-100"
          }`}>{appt.status.replace("_", " ")}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <CalendarDays className="w-4 h-4" />
          {fmt(appt.consultationStartsAt)}
        </div>
        {appt.preConsultation?.symptoms && (
          <div className="mt-3 bg-slate-50 rounded-xl px-3 py-2.5">
            <p className="text-xs text-slate-400 mb-1">Reported Symptoms</p>
            <p className="text-sm text-slate-700">{appt.preConsultation.symptoms}
              {appt.preConsultation.duration && ` · ${appt.preConsultation.duration}`}
              {appt.preConsultation.severity && ` · ${appt.preConsultation.severity} severity`}
            </p>
          </div>
        )}
      </section>

      {/* Prescription */}
      {rx ? (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-slate-700 text-sm">Your Prescription</h2>
            {appt.prescriptionSentAt && (
              <span className="ml-auto text-xs text-slate-400">Issued {fmt(appt.prescriptionSentAt)}</span>
            )}
          </div>

          {rx.diagnosis && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Diagnosis</p>
              <p className="text-sm text-blue-900 font-medium">{rx.diagnosis}</p>
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
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Doctor&apos;s Advice</p>
              <p className="text-sm text-emerald-900 leading-relaxed">{rx.advice}</p>
            </div>
          )}
        </section>
      ) : (
        <section className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
          <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No prescription issued for this appointment.</p>
        </section>
      )}

      {/* Transcript (patient sees it too) */}
      {appt.transcript && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-slate-700 text-sm">Consultation Notes</h2>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 max-h-56 overflow-y-auto">
            {appt.transcript.split("\n").map((line, i) => {
              const isDoctor  = line.startsWith("Doctor:");
              const isPatient = line.startsWith("Patient:");
              return (
                <p key={i} className="text-sm mb-1.5 leading-relaxed">
                  {(isDoctor || isPatient) ? (
                    <>
                      <span className={`font-semibold ${isDoctor ? "text-blue-600" : "text-emerald-600"}`}>
                        {isDoctor ? "Doctor" : "You"}:
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
    </div>
  );
}
