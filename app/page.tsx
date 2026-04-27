import Link from "next/link";
import { Activity, Shield, Calendar, Star, ArrowRight, Heart, Brain, Stethoscope } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden">
      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/40">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">MediIQ</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-5 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/register" className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 transition-all duration-200 shadow-lg shadow-blue-600/30">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-8 pt-20 pb-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-100 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold text-blue-400 animate-fade-in-up">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Trusted by 10,000+ patients
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight mb-6 animate-fade-in-up stagger-1 opacity-0">
            Healthcare at Your
            <span className="block text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-cyan-400">
              Fingertips
            </span>
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed mb-10 animate-fade-in-up stagger-2 opacity-0">
            Connect with verified doctors, book consultations, and manage your complete health profile — all in one intelligent platform.
          </p>
          <div className="flex items-center justify-center gap-4 animate-fade-in-up stagger-3 opacity-0">
            <Link href="/register" className="flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all duration-200 shadow-2xl shadow-blue-600/30 hover:-translate-y-0.5 text-sm">
              Book a Consultation
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/register?role=doctor" className="flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold border border-slate-600 hover:border-slate-400 hover:bg-slate-800/50 transition-all duration-200 text-sm">
              Join as Doctor
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-8 py-20">
        <h2 className="text-center text-3xl font-bold mb-4">Everything you need for better health</h2>
        <p className="text-center text-slate-400 mb-14">A comprehensive platform built for patients and doctors alike</p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: <Stethoscope className="w-6 h-6" />, color: "bg-blue-500/10 text-blue-400", title: "Expert Doctors", desc: "Consult verified specialists across 20+ medical disciplines." },
            { icon: <Calendar className="w-6 h-6" />, color: "bg-cyan-500/10 text-cyan-400", title: "Easy Scheduling", desc: "Book appointments instantly and get reminders on the go." },
            { icon: <Shield className="w-6 h-6" />, color: "bg-emerald-500/10 text-emerald-400", title: "Secure & Private", desc: "Your health data is encrypted and protected at every step." },
            { icon: <Heart className="w-6 h-6" />, color: "bg-rose-500/10 text-rose-400", title: "Health Profile", desc: "Maintain a complete medical history accessible by your doctors." },
            { icon: <Brain className="w-6 h-6" />, color: "bg-violet-500/10 text-violet-400", title: "Smart Matching", desc: "Get matched with doctors based on your condition and location." },
            { icon: <Star className="w-6 h-6" />, color: "bg-amber-500/10 text-amber-400", title: "Trusted Reviews", desc: "Real ratings from real patients to help you choose the best doctor." },
          ].map((f, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 hover:border-white/20 transition-all duration-200 animate-fade-in-up opacity-0" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "forwards" }}>
              <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4`}>{f.icon}</div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-8 py-20 text-center">
        <div className="bg-linear-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/20 rounded-3xl px-8 py-16">
          <h2 className="text-3xl font-bold mb-4">Ready to take control of your health?</h2>
          <p className="text-slate-400 mb-8">Join thousands of patients and doctors on MediIQ today.</p>
          <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold bg-blue-600 hover:bg-blue-500 transition-all duration-200 shadow-lg shadow-blue-600/30 text-sm">
            Create Free Account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-8 py-6 max-w-7xl mx-auto flex items-center justify-between text-slate-500 text-sm">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          <span>MediIQ © {new Date().getFullYear()}</span>
        </div>
        <p>Smart Healthcare Platform</p>
      </footer>
    </div>
  );
}
