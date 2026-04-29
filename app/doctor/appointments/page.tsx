import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/lib/models/Appointment";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Clock, IndianRupee, ChevronRight } from "lucide-react";

function formatDate(d: Date | string) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

function formatTime(d: Date | string) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

const STATUS: Record<string, { cls: string; label: string }> = {
  pending_approval: { cls: "bg-yellow-50 text-yellow-700 border border-yellow-100", label: "Pending" },
  confirmed:        { cls: "bg-blue-50 text-blue-700 border border-blue-100",        label: "Confirmed" },
  active:           { cls: "bg-blue-50 text-blue-700 border border-blue-100",        label: "Active" },
  in_call:          { cls: "bg-violet-50 text-violet-700 border border-violet-100",  label: "In Call" },
  post_call:        { cls: "bg-orange-50 text-orange-700 border border-orange-100",  label: "Post Call" },
  completed:        { cls: "bg-emerald-50 text-emerald-700 border border-emerald-100", label: "Completed" },
  rejected:         { cls: "bg-red-50 text-red-700 border border-red-100",           label: "Rejected" },
  cancelled:        { cls: "bg-slate-100 text-slate-500 border border-slate-200",    label: "Cancelled" },
};

const ACTIVE_STATUSES   = ["pending_approval", "confirmed", "active", "in_call"];
const TERMINAL_STATUSES = ["completed", "post_call", "rejected", "cancelled"];

export default async function DoctorAppointmentsPage() {
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "doctor") redirect("/login");

  await connectDB();
  const raw = await Appointment
    .find({ doctorRef: authUser.userId })
    .sort({ consultationStartsAt: -1 })
    .lean();

  const appts = raw as unknown as Array<{
    _id: string;
    patientName: string;
    consultationStartsAt: Date;
    status: string;
    consultationFee: number;
  }>;

  const upcoming = appts.filter(a => ACTIVE_STATUSES.includes(a.status));
  const past     = appts.filter(a => TERMINAL_STATUSES.includes(a.status));

  return (
    <div className="p-8 space-y-8">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-800">My Schedule</h1>
        <p className="text-slate-500 text-sm mt-0.5">{appts.length} total appointments</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
            <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No upcoming appointments</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {upcoming.map((a, i) => <AppointmentCard key={String(a._id)} appt={a} delay={i * 80} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Past Appointments ({past.length})
        </h2>
        {past.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">No past appointments</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {past.map((a, i) => <AppointmentCard key={String(a._id)} appt={a} delay={i * 60} linkable />)}
          </div>
        )}
      </section>
    </div>
  );
}

function AppointmentCard({ appt, delay, linkable }: {
  appt: { _id: string; patientName: string; consultationStartsAt: Date; status: string; consultationFee: number };
  delay?: number;
  linkable?: boolean;
}) {
  const s = STATUS[appt.status] ?? STATUS.pending_approval;
  const inner = (
    <div
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-fade-in-up opacity-0 transition-shadow ${linkable ? "hover:shadow-md" : ""}`}
      style={{ animationDelay: `${delay ?? 0}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
            {appt.patientName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{appt.patientName}</p>
            <p className="text-slate-400 text-xs">Patient</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>
          {linkable && <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarDays className="w-3.5 h-3.5" />
          {formatDate(appt.consultationStartsAt)}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          {formatTime(appt.consultationStartsAt)}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <IndianRupee className="w-3.5 h-3.5" />
          ₹{appt.consultationFee}
        </div>
      </div>
    </div>
  );

  return linkable
    ? <Link href={`/doctor/appointments/${appt._id}`} className="block">{inner}</Link>
    : inner;
}
