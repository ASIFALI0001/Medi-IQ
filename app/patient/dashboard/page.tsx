import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import PatientProfile from "@/lib/models/PatientProfile";
import Appointment from "@/lib/models/Appointment";
import { redirect } from "next/navigation";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import {
  CalendarDays, Activity, Clock, UserCheck,
  ChevronRight, AlertCircle, HeartPulse, Stethoscope,
} from "lucide-react";
import BookAppointmentModal from "@/components/BookAppointmentModal";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function PatientDashboard() {
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "patient") redirect("/login");

  await connectDB();
  const dbUser = await User.findById(authUser.userId).select("name profileCompleted").lean() as { name: string; profileCompleted: boolean } | null;

  if (!dbUser?.profileCompleted) redirect("/patient/profile");

  const [profileRaw, apptRaw] = await Promise.all([
    PatientProfile.findOne({ userRef: authUser.userId }).lean(),
    Appointment.find({ patientRef: authUser.userId }).sort({ date: -1 }).limit(10).lean(),
  ]);

  type ApptRow = { _id: string; doctorName: string; specialization: string; date: Date; timeSlot: string; status: string; consultationFee: number };
  const appointments = apptRaw as unknown as ApptRow[];
  const profile = profileRaw as unknown as { knownConditions?: string[]; allergies?: string[]; currentMedications?: string[]; bloodGroup?: string; age?: number; gender?: string } | null;

  const upcoming = appointments.filter((a) => a.status === "scheduled" && new Date(a.date) >= new Date());
  const completed = appointments.filter((a) => a.status === "completed").length;
  const nextAppt = upcoming[0];

  const p = profile;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Good {getGreeting()}, {dbUser.name.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Here&apos;s your health overview</p>
        </div>
        <BookAppointmentModal />
      </div>

      {/* Next Appointment Banner */}
      {nextAppt ? (
        <div className="bg-linear-to-r from-blue-600 to-cyan-600 rounded-2xl p-6 text-white animate-fade-in-up stagger-1 opacity-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider mb-1">Next Appointment</p>
              <h2 className="text-xl font-bold">Dr. {nextAppt.doctorName}</h2>
              <p className="text-blue-100 text-sm capitalize">{nextAppt.specialization}</p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-sm">
                  <CalendarDays className="w-4 h-4" />
                  {formatDate(nextAppt.date)}
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Clock className="w-4 h-4" />
                  {nextAppt.timeSlot}
                </div>
              </div>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center animate-fade-in-up stagger-1 opacity-0">
          <CalendarDays className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No upcoming appointments</p>
          <p className="text-slate-400 text-xs mt-1">Book a consultation to get started</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Consultations" value={appointments.length} icon={<Activity className="w-6 h-6" />} color="text-blue-600" bgColor="bg-blue-50" delay={0} />
        <StatCard label="Completed" value={completed} icon={<UserCheck className="w-6 h-6" />} color="text-emerald-600" bgColor="bg-emerald-50" delay={100} />
        <StatCard label="Upcoming" value={upcoming.length} icon={<CalendarDays className="w-6 h-6" />} color="text-violet-600" bgColor="bg-violet-50" delay={200} />
        <StatCard label="Age" value={p?.age ?? "—"} icon={<HeartPulse className="w-6 h-6" />} color="text-rose-600" bgColor="bg-rose-50" delay={300} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Health Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up stagger-2 opacity-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-800">Health Summary</h2>
            <Link href="/patient/profile" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
              Update <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-4">
            <HealthRow label="Blood Group" value={p?.bloodGroup} badge="info" />
            <HealthRow label="Gender" value={p?.gender} />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Known Conditions</p>
              {p?.knownConditions?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {p.knownConditions.map((c, i) => (
                    <span key={i} className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-100">{c}</span>
                  ))}
                </div>
              ) : <p className="text-slate-400 text-xs">None recorded</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Allergies</p>
              {p?.allergies?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {p.allergies.map((a, i) => (
                    <span key={i} className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium border border-red-100">{a}</span>
                  ))}
                </div>
              ) : <p className="text-slate-400 text-xs">None recorded</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current Medications</p>
              {p?.currentMedications?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {p.currentMedications.map((m, i) => (
                    <span key={i} className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">{m}</span>
                  ))}
                </div>
              ) : <p className="text-slate-400 text-xs">None recorded</p>}
            </div>
          </div>
        </div>

        {/* Recent Appointments */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up stagger-3 opacity-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-800">Recent Appointments</h2>
            <Link href="/patient/appointments" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {appointments.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No appointments yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(appointments as { _id: string; doctorName: string; specialization: string; date: Date; timeSlot: string; status: string }[]).slice(0, 5).map((appt) => (
                <div key={String(appt._id)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">Dr. {appt.doctorName}</p>
                    <p className="text-xs text-slate-500 capitalize">{appt.specialization} · {formatDate(appt.date)}</p>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

function HealthRow({ label, value, badge }: { label: string; value?: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${badge === "info" ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-blue-50 text-blue-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-700",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${map[status] ?? "bg-slate-50 text-slate-700"}`}>
      {status}
    </span>
  );
}
