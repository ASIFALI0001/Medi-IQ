import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color: string;
  bgColor: string;
  delay?: number;
  trend?: string;
}

export default function StatCard({ label, value, icon, color, bgColor, delay = 0, trend }: StatCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up opacity-0"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
          {trend && <p className="text-xs text-emerald-600 font-medium mt-1">{trend}</p>}
        </div>
        <div className={`w-14 h-14 rounded-2xl ${bgColor} flex items-center justify-center`}>
          <div className={color}>{icon}</div>
        </div>
      </div>
    </div>
  );
}
