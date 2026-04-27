import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import DoctorProfile from "@/lib/models/DoctorProfile";
import Appointment from "@/lib/models/Appointment";
import { redirect } from "next/navigation";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import GoLiveButton from "@/components/GoLiveButton";
import {
  Users, Star, IndianRupee, CalendarDays, ChevronRight,
  Clock, AlertCircle, CheckCircle2, Stethoscope,
} from "lucide-react";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function DoctorDashboard() {
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "doctor") redirect("/login");

  await connectDB();
  const dbUser = await User.findById(authUser.userId).select("name profileCompleted").lean() as { name: string; profileCompleted: boolean } | null;
  if (!dbUser?.profileCompleted) redirect("/doctor/profile");

  const profile = await DoctorProfile.findOne({ userRef: authUser.userId }).lean() as {
    _id: string; userId: string; specialization: string; qualification: string;
    experience: number; hospital: string; city: string; consultationFee: number;
    verificationStatus: string; rating: number; totalRatings: number; isLive: boolean;
  } | null;

  if (!profile) redirect("/doctor/profile");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayRaw, allRaw] = await Promise.all([
    Appointment.find({ doctorRef: authUser.userId, date: { $gte: today, $lt: tomorrow } }).sort({ date: 1 }).lean(),
    Appointment.find({ doctorRef: authUser.userId }).sort({ date: -1 }).limit(8).lean(),
  ]);

  type TodayAppt = { _id: string; patientName: string; timeSlot: string; status: string };
  type AllAppt = { _id: string; patientName: string; date: Date; timeSlot: string; status: string };
  const todayAppts = todayRaw as unknown as TodayAppt[];
  const allAppts = allRaw as unknown as AllAppt[];

  const completedCount = allAppts.filter((a) => a.status === "completed").length;

  const isPending = profile.verificationStatus === "pending";
  const isRejected = profile.verificationStatus === "rejected";
  const isApproved = profile.verificationStatus === "approved";

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Good {getGreeting()}, Dr. {dbUser.name.split(" ").slice(-1)[0]} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {profile.specialization.charAt(0).toUpperCase() + profile.specialization.slice(1)} · {profile.hospital}
          </p>
        </div>
        {isApproved && <GoLiveButton initialLive={profile.isLive} />}
      </div>

      {/* Status Banner */}
      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3 animate-fade-in">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Profile Under Review</p>
            <p className="text-amber-700 text-xs mt-0.5">Admin is reviewing your profile. You&apos;ll be notified once approved.</p>
          </div>
        </div>
      )}
      {isRejected && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Profile Not Approved</p>
            <p className="text-red-700 text-xs mt-0.5">
              Please <Link href="/doctor/profile" className="underline font-semibold">update your profile</Link> and resubmit.
            </p>
          </div>
        </div>
      )}
      {isApproved && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-800 text-sm">Profile Approved</p>
            <p className="text-emerald-700 text-xs mt-0.5">
              {profile.isLive ? "You are live and accepting consultations." : "Toggle Go Live to start accepting consultations."}
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Patients Served" value={completedCount} icon={<Users className="w-6 h-6" />} color="text-blue-600" bgColor="bg-blue-50" delay={0} />
        <StatCard label="Avg. Rating" value={profile.totalRatings > 0 ? profile.rating.toFixed(1) : "N/A"} icon={<Star className="w-6 h-6" />} color="text-amber-600" bgColor="bg-amber-50" delay={100} />
        <StatCard label="Consultation Fee" value={`₹${profile.consultationFee}`} icon={<IndianRupee className="w-6 h-6" />} color="text-emerald-600" bgColor="bg-emerald-50" delay={200} />
        <StatCard label="Today's Schedule" value={todayAppts.length} icon={<CalendarDays className="w-6 h-6" />} color="text-violet-600" bgColor="bg-violet-50" delay={300} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up stagger-2 opacity-0">
          <h2 className="font-semibold text-slate-800 mb-5">Today&apos;s Schedule</h2>
          {todayAppts.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No appointments today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppts.map((appt) => (
                <div key={String(appt._id)} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{appt.patientName}</p>
                    <p className="text-xs text-slate-500">{appt.timeSlot}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                    appt.status === "scheduled" ? "bg-blue-50 text-blue-700" :
                    appt.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}>{appt.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Consultations */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up stagger-3 opacity-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-800">Recent Consultations</h2>
            <Link href="/doctor/appointments" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {allAppts.length === 0 ? (
            <div className="text-center py-8">
              <Stethoscope className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No consultations yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allAppts.slice(0, 5).map((appt) => (
                <div key={String(appt._id)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {appt.patientName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{appt.patientName}</p>
                    <p className="text-xs text-slate-500">{formatDate(appt.date)} · {appt.timeSlot}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                    appt.status === "scheduled" ? "bg-blue-50 text-blue-700" :
                    appt.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}>{appt.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Profile Summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up stagger-4 opacity-0">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-slate-800">Professional Summary</h2>
          <Link href="/doctor/profile" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
            Edit Profile <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Specialization", value: profile.specialization },
            { label: "Qualification", value: profile.qualification.toUpperCase() },
            { label: "Experience", value: `${profile.experience} years` },
            { label: "Location", value: profile.city },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
              <p className="text-sm font-semibold text-slate-800 capitalize">{value}</p>
            </div>
          ))}
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
