import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import AiConsultation from "@/lib/models/AiConsultation";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Brain, Pill, CheckCircle2, XCircle, ArrowLeft, FileText, AlertTriangle } from "lucide-react";

function fmt(d: Date | string | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) +
    " · " + date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default async function AiReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "patient") redirect("/login");

  await connectDB();
  const raw = await AiConsultation.findOne({ _id: id, patientRef: user.userId }).lean();
  if (!raw) notFound();

  const c = raw as unknown as {
    _id: string; patientName: string; status: string;
    consultationStartedAt?: Date; reportGeneratedAt?: Date;
    preConsultation?: { symptoms: string; duration: string; severity: string };
    report?: {
      summary: string; diagnosis: string;
      medicines: Array<{ medicine: string; dosage: string; timing: string; frequency: string; duration: string }>;
      advice: string; dosAndDonts: string[];
    };
  };

  if (c.status !== "report_ready" || !c.report) {
    redirect(`/patient/ai-consultation/${id}/waiting`);
  }

  const report = c.report;
  const dos    = report.dosAndDonts?.filter(d => d.toLowerCase().startsWith("do:"));
  const donts  = report.dosAndDonts?.filter(d => d.toLowerCase().startsWith("don't:") || d.toLowerCase().startsWith("dont:"));
  const emergency = report.dosAndDonts?.filter(d => d.toLowerCase().startsWith("seek"));

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Link href="/patient/appointments" className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/doctor.jpg" alt="AI Doctor" className="object-cover w-full h-full" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Your Medical Report</h1>
            <p className="text-slate-500 text-xs flex items-center gap-1">
              <Brain className="w-3 h-3" /> Dr. MediQ AI · {fmt(c.reportGeneratedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex gap-2 text-amber-800 text-xs">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>This report is AI-generated and not a substitute for professional medical advice. If symptoms worsen or persist, consult a licensed doctor immediately.</span>
      </div>

      {/* Summary */}
      {report.summary && (
        <section className="bg-linear-to-br from-blue-50 to-violet-50 rounded-2xl border border-blue-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-violet-600" />
            <h2 className="font-semibold text-slate-700 text-sm">Clinical Summary</h2>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
        </section>
      )}

      {/* Diagnosis */}
      {report.diagnosis && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-slate-700 text-sm">Diagnosis</h2>
          </div>
          <div className="bg-blue-50 rounded-xl px-4 py-3">
            <p className="text-sm text-blue-900 font-medium">{report.diagnosis}</p>
          </div>
        </section>
      )}

      {/* Medicines */}
      {report.medicines && report.medicines.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-slate-700 text-sm">Prescribed Medicines</h2>
          </div>
          <div className="space-y-3">
            {report.medicines.map((m, i) => (
              <div key={i} className="flex gap-3 bg-slate-50 rounded-xl px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
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
        </section>
      )}

      {/* Dos & Don'ts */}
      {report.dosAndDonts && report.dosAndDonts.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm">Dos &amp; Don&apos;ts</h2>
          {dos && dos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Do</p>
              <ul className="space-y-1.5">
                {dos.map((d, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {d.replace(/^do:/i, "").trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {donts && donts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Don&apos;t</p>
              <ul className="space-y-1.5">
                {donts.map((d, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    {d.replace(/^don'?t:/i, "").trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {emergency && emergency.length > 0 && (
            <div className="bg-red-50 rounded-xl px-4 py-3">
              {emergency.map((e, i) => (
                <p key={i} className="text-sm text-red-800 font-medium flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {e}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Advice */}
      {report.advice && (
        <section className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Doctor&apos;s Advice</p>
          <p className="text-sm text-emerald-900 leading-relaxed">{report.advice}</p>
        </section>
      )}

      <Link href="/patient/appointments"
        className="block text-center text-sm text-blue-600 hover:text-blue-700 font-semibold py-2">
        ← Back to My Appointments
      </Link>
    </div>
  );
}
