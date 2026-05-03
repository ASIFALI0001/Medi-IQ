import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { LayoutDashboard, UserCheck, Brain } from "lucide-react";

const navItems = [
  { href: "/admin/dashboard",         label: "Overview",           icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/admin/doctors",           label: "Doctor Approvals",   icon: <UserCheck className="w-4 h-4" /> },
  { href: "/admin/ai-consultations",  label: "AI Doctor",          icon: <Brain className="w-4 h-4" /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "admin") redirect("/login");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar navItems={navItems} userName={authUser.name} userRole="Administrator" />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
