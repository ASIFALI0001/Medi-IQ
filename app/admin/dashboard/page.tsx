import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import DoctorProfile from "@/lib/models/DoctorProfile";
import Appointment from "@/lib/models/Appointment";
import { redirect } from "next/navigation";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import { Users, UserCheck, UserX, Clock, CalendarDays, ChevronRight, Stethoscope } from "lucide-react";

export default async function AdminDashboard() {
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "admin") redirect("/login");

  await connectDB();
  const [totalPatients, totalDoctors, approved, rejected, pending, totalAppts] = await Promise.all([
    User.countDocuments({ role: "patient" }),
    User.countDocuments({ role: "doctor" }),
    DoctorProfile.countDocuments({ verificationStatus: "approved" }),
    DoctorProfile.countDocuments({ verificationStatus: "rejected" }),
    DoctorProfile.countDocuments({ verificationStatus: "pending" }),
    Appointment.countDocuments(),
  ]);

  const recentDoctors = await DoctorProfile.find({ verificationStatus: "pending" })
    .populate("userRef", "name email createdAt")
    .sort({ createdAt: -1 })
    .limit(5)
    .lean() as unknown as {
      _id: string; userId: string; specialization: string; hospital: string; city: string;
      userRef: { name: string; email: string; createdAt: Date };
    }[];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-800">Admin Overview</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform health at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Patients" value={totalPatients} icon={<Users className="w-6 h-6" />} color="text-blue-600" bgColor="bg-blue-50" delay={0} />
        <StatCard label="Total Doctors" value={totalDoctors} icon={<Stethoscope className="w-6 h-6" />} color="text-violet-600" bgColor="bg-violet-50" delay={80} />
        <StatCard label="Total Appointments" value={totalAppts} icon={<CalendarDays className="w-6 h-6" />} color="text-cyan-600" bgColor="bg-cyan-50" delay={160} />
        <StatCard label="Approved Doctors" value={approved} icon={<UserCheck className="w-6 h-6" />} color="text-emerald-600" bgColor="bg-emerald-50" delay={240} />
        <StatCard label="Pending Review" value={pending} icon={<Clock className="w-6 h-6" />} color="text-amber-600" bgColor="bg-amber-50" delay={320} />
        <StatCard label="Rejected" value={rejected} icon={<UserX className="w-6 h-6" />} color="text-red-600" bgColor="bg-red-50" delay={400} />
      </div>

      {/* Pending Approvals */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up stagger-2 opacity-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-slate-800">Pending Doctor Approvals</h2>
            {pending > 0 && <p className="text-xs text-amber-600 font-medium mt-0.5">{pending} doctor{pending !== 1 ? "s" : ""} awaiting review</p>}
          </div>
          <Link href="/admin/doctors" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
            Manage all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {recentDoctors.length === 0 ? (
          <div className="text-center py-8">
            <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No pending approvals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentDoctors.map((doc) => (
              <div key={String(doc._id)} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-violet-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {doc.userRef.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">Dr. {doc.userRef.name}</p>
                  <p className="text-slate-500 text-xs capitalize">{doc.specialization} · {doc.hospital}, {doc.city}</p>
                  <p className="text-slate-400 text-xs">{doc.userRef.email}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Pending</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
