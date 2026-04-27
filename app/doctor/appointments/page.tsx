import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/lib/models/Appointment";
import { redirect } from "next/navigation";
import { CalendarDays, Clock, IndianRupee } from "lucide-react";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

const statusMap: Record<string, { cls: string; label: string }> = {
  scheduled: { cls: "bg-blue-50 text-blue-700 border border-blue-100", label: "Scheduled" },
  completed: { cls: "bg-emerald-50 text-emerald-700 border border-emerald-100", label: "Completed" },
  cancelled: { cls: "bg-red-50 text-red-700 border border-red-100", label: "Cancelled" },
};

export default async function DoctorAppointmentsPage() {
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "doctor") redirect("/login");

  await connectDB();
  const raw = await Appointment.find({ doctorRef: authUser.userId }).sort({ date: -1 }).lean();
  type ApptRow = { _id: string; patientName: string; date: Date; timeSlot: string; status: string; consultationFee: number };
  const appointments = raw as unknown as ApptRow[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = appointments.filter((a) => a.status === "scheduled" && new Date(a.date) >= today);
  const past = appointments.filter((a) => a.status !== "scheduled" || new Date(a.date) < today);

  return (
    <div className="p-8 space-y-8">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-800">My Schedule</h1>
        <p className="text-slate-500 text-sm mt-0.5">{appointments.length} total appointments</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
            <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No upcoming appointments</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {upcoming.map((appt, i) => (
              <AppointmentCard key={String(appt._id)} appt={appt} delay={i * 80} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Past Appointments ({past.length})</h2>
        {past.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">No past appointments</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {past.map((appt, i) => (
              <AppointmentCard key={String(appt._id)} appt={appt} delay={i * 60} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AppointmentCard({ appt, delay }: {
  appt: { _id: string; patientName: string; date: Date; timeSlot: string; status: string; consultationFee: number };
  delay?: number;
}) {
  const s = statusMap[appt.status] ?? statusMap.scheduled;
  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-fade-in-up opacity-0"
      style={{ animationDelay: `${delay ?? 0}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
            {appt.patientName.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{appt.patientName}</p>
            <p className="text-slate-400 text-xs">Patient</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarDays className="w-3.5 h-3.5" />
          {formatDate(appt.date)}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          {appt.timeSlot}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <IndianRupee className="w-3.5 h-3.5" />
          ₹{appt.consultationFee}
        </div>
      </div>
    </div>
  );
}
