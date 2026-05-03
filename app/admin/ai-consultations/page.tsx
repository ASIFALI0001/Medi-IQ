import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import AiConsultation from "@/lib/models/AiConsultation";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Brain, ChevronRight, FileText } from "lucide-react";

function fmt(d: Date | string | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    " " + date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

const STATUS_STYLE: Record<string, string> = {
  pre_consultation:  "bg-slate-100 text-slate-500",
  ready_to_consult:  "bg-blue-50 text-blue-700",
  in_consultation:   "bg-violet-50 text-violet-700",
  generating_report: "bg-amber-50 text-amber-700",
  report_ready:      "bg-emerald-50 text-emerald-700",
};

export default async function AdminAiConsultationsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login");

  await connectDB();
  const raw = await AiConsultation.find({}).sort({ createdAt: -1 }).lean();

  const consultations = raw as unknown as Array<{
    _id: string;
    patientName: string;
    status: string;
    createdAt: Date;
    consultationStartedAt?: Date;
    reportGeneratedAt?: Date;
    preConsultation?: { symptoms: string; severity: string };
    report?: { diagnosis: string };
  }>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <Brain className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">AI Doctor Consultations</h1>
          <p className="text-slate-500 text-sm">{consultations.length} total consultations</p>
        </div>
      </div>

      {consultations.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <Brain className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">No AI consultations yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Patient", "Symptoms", "Diagnosis", "Status", "Date", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {consultations.map(c => (
                <tr key={String(c._id)} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">
                        {c.patientName.charAt(0)}
                      </div>
                      <span className="font-medium text-slate-800">{c.patientName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 max-w-[180px] truncate">
                    {c.preConsultation?.symptoms ?? "—"}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 max-w-[200px] truncate">
                    {c.report?.diagnosis ?? "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[c.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {c.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{fmt(c.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <Link href={`/admin/ai-consultations/${c._id}`}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-semibold">
                      <FileText className="w-3.5 h-3.5" /> View <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
