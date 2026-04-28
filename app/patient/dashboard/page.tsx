import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import PatientProfile from "@/lib/models/PatientProfile";
import Appointment from "@/lib/models/Appointment";
import { redirect } from "next/navigation";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import ActiveAppointmentBanner from "@/components/ActiveAppointmentBanner";
import {
  CalendarDays, Activity, UserCheck,
  ChevronRight, AlertCircle, HeartPulse, Stethoscope, Plus,
} from "lucide-react";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

const STATUS_MAP: Record<string, string> = {
  pending_approval: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  active: "bg-emerald-50 text-emerald-700",
  completed: "bg-slate-50 text-slate-600",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-red-50 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Pending",
  confirmed: "Confirmed",
  active: "Live",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export default async function PatientDashboard() {
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "patient") redirect("/login");

  await connectDB();
  const dbUser = await User.findById(authUser.userId)
    .select("name profileCompleted")
    .lean() as { name: string; profileCompleted: boolean } | null;

  if (!dbUser?.profileCompleted) redirect("/patient/profile");

  const [profileRaw, apptRaw] = await Promise.all([
    PatientProfile.findOne({ userRef: authUser.userId }).lean(),
    Appointment.find({ patientRef: authUser.userId }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  type ApptRow = {
    _id: string; doctorName: string; specialization: string;
    bookedAt: Date; status: string; consultationFee: number;
  };
  const appointments = apptRaw as unknown as ApptRow[];
  const profile = profileRaw as unknown as {
    knownConditions?: string[]; allergies?: string[];
    currentMedications?: string[]; bloodGroup?: string; age?: number; gender?: string;
  } | null;

  const completed = appointments.filter((a) => a.status === "completed").length;
  const upcoming = appointments.filter((a) => ["pending_approval", "confirmed", "active"].includes(a.status));

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Good {getGreeting()}, {dbUser.name.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Here&apos;s your health overview</p>
        </div>
        <Link
          href="/patient/book-appointment"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all duration-200 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Book Appointment
        </Link>
      </div>

      {/* Active appointment banner (client component — polls every 5s) */}
      <ActiveAppointmentBanner />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Consultations" value={appointments.length} icon={<Activity className="w-6 h-6" />} color="text-blue-600" bgColor="bg-blue-50" delay={0} />
        <StatCard label="Completed" value={completed} icon={<UserCheck className="w-6 h-6" />} color="text-emerald-600" bgColor="bg-emerald-50" delay={100} />
        <StatCard label="Active / Upcoming" value={upcoming.length} icon={<CalendarDays className="w-6 h-6" />} color="text-violet-600" bgColor="bg-violet-50" delay={200} />
        <StatCard label="Age" value={profile?.age ?? "—"} icon={<HeartPulse className="w-6 h-6" />} color="text-rose-600" bgColor="bg-rose-50" delay={300} />
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
            <HealthRow label="Blood Group" value={profile?.bloodGroup} badge="info" />
            <HealthRow label="Gender" value={profile?.gender} />
            <TagSection label="Known Conditions" items={profile?.knownConditions} color="amber" />
            <TagSection label="Allergies" items={profile?.allergies} color="red" />
            <TagSection label="Current Medications" items={profile?.currentMedications} color="blue" />
          </div>
        </div>

        {/* Recent Appointments */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up stagger-3 opacity-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-800">Recent Consultations</h2>
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
              {appointments.slice(0, 5).map((appt) => (
                <div key={String(appt._id)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Stethoscope className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">Dr. {appt.doctorName}</p>
                    <p className="text-xs text-slate-500 capitalize">
                      {appt.specialization} · {formatDate(appt.bookedAt)}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_MAP[appt.status] ?? "bg-slate-50 text-slate-700"}`}>
                    {STATUS_LABEL[appt.status] ?? appt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

function TagSection({ label, items, color }: { label: string; items?: string[]; color: string }) {
  const colorMap: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
  };
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      {items?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span key={i} className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorMap[color]}`}>{item}</span>
          ))}
        </div>
      ) : <p className="text-slate-400 text-xs">None recorded</p>}
    </div>
  );
}
