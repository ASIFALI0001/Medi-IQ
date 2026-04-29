import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/lib/models/Appointment";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Clock, Stethoscope, IndianRupee, ChevronRight } from "lucide-react";
import BookAppointmentModal from "@/components/BookAppointmentModal";

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
  post_call:        { cls: "bg-orange-50 text-orange-700 border border-orange-100",  label: "Completed" },
  completed:        { cls: "bg-emerald-50 text-emerald-700 border border-emerald-100", label: "Completed" },
  rejected:         { cls: "bg-red-50 text-red-700 border border-red-100",           label: "Rejected" },
  cancelled:        { cls: "bg-slate-100 text-slate-500 border border-slate-200",    label: "Cancelled" },
};

const ACTIVE_STATUSES   = ["pending_approval", "confirmed", "active", "in_call"];
const TERMINAL_STATUSES = ["completed", "post_call", "rejected", "cancelled"];

export default async function PatientAppointmentsPage() {
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "patient") redirect("/login");

  await connectDB();
  const raw = await Appointment
    .find({ patientRef: authUser.userId })
    .sort({ consultationStartsAt: -1 })
    .lean();

  const appts = raw as unknown as Array<{
    _id: string;
    doctorName: string;
    specialization: string;
    consultationStartsAt: Date;
    status: string;
    consultationFee: number;
  }>;

  const upcoming = appts.filter(a => ACTIVE_STATUSES.includes(a.status));
  const past     = appts.filter(a => TERMINAL_STATUSES.includes(a.status));

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Appointments</h1>
          <p className="text-slate-500 text-sm mt-0.5">{appts.length} total consultations</p>
        </div>
        <BookAppointmentModal />
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
            {upcoming.map((a, i) => (
              <AppointmentCard key={String(a._id)} appt={a} delay={i * 80} highlight />
            ))}
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
            {past.map((a, i) => (
              <AppointmentCard key={String(a._id)} appt={a} delay={i * 60} linkable />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AppointmentCard({ appt, delay, highlight, linkable }: {
  appt: { _id: string; doctorName: string; specialization: string; consultationStartsAt: Date; status: string; consultationFee: number };
  delay?: number;
  highlight?: boolean;
  linkable?: boolean;
}) {
  const s = STATUS[appt.status] ?? STATUS.pending_approval;
  const inner = (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-5 animate-fade-in-up opacity-0 transition-shadow ${
        highlight ? "border-blue-100" : "border-slate-100"
      } ${linkable ? "hover:shadow-md" : ""}`}
      style={{ animationDelay: `${delay ?? 0}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Dr. {appt.doctorName}</p>
            <p className="text-slate-500 text-xs capitalize">{appt.specialization}</p>
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
          ₹{appt.consultationFee} consultation fee
        </div>
      </div>
    </div>
  );

  return linkable
    ? <Link href={`/patient/appointments/${appt._id}`} className="block">{inner}</Link>
    : inner;
}
