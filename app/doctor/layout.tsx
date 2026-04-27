import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import DoctorProfile from "@/lib/models/DoctorProfile";
import Sidebar from "@/components/Sidebar";
import { LayoutDashboard, UserCircle, CalendarDays } from "lucide-react";

const navItems = [
  { href: "/doctor/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/doctor/profile", label: "My Profile", icon: <UserCircle className="w-4 h-4" /> },
  { href: "/doctor/appointments", label: "Schedule", icon: <CalendarDays className="w-4 h-4" /> },
];

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "doctor") redirect("/login");

  await connectDB();
  const dbUser = await User.findById(authUser.userId).select("name").lean() as { name: string } | null;
  const profile = await DoctorProfile.findOne({ userRef: authUser.userId }).select("userId").lean() as { userId?: string } | null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar navItems={navItems} userName={dbUser?.name ?? authUser.name} userRole="Doctor" userId={profile?.userId} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
