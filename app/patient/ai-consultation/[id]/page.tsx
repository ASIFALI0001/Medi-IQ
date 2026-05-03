"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, PhoneOff, Loader2, Brain } from "lucide-react";
import Vapi from "@vapi-ai/web";

interface ConsultationData {
  _id: string;
  patientName: string;
  status: string;
  preConsultation?: {
    symptoms: string; duration: string; severity: string;
    currentMedications: string; additionalNotes: string;
  };
  aiQuestions: string[];
}
interface ProfileData {
  age?: number; gender?: string; weight?: number; height?: number;
  bloodGroup?: string; knownConditions?: string[]; allergies?: string[];
  currentMedications?: string[];
}

type CallState = "idle" | "connecting" | "active" | "ending";

export default function AiConsultationRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const router  = useRouter();

  const vapiRef     = useRef<Vapi | null>(null);
  const transcriptRef = useRef<string>("");

  const [consultation, setConsultation] = useState<ConsultationData | null>(null);
  const [profile, setProfile]           = useState<ProfileData | null>(null);
  const [callState, setCallState]       = useState<CallState>("idle");
  const [isSpeaking, setIsSpeaking]     = useState(false);     // assistant speaking
  const [isMuted, setIsMuted]           = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<Array<{ role: string; text: string }>>([]);
  const [interimText, setInterimText]         = useState<{ role: string; text: string } | null>(null);

  // Load consultation data
  useEffect(() => {
    fetch(`/api/ai-consultation/${id}`)
      .then(r => r.json())
      .then(d => {
        setConsultation(d.consultation);
        setProfile(d.profile);
      });
  }, [id]);

  const endCall = useCallback(async () => {
    if (callState === "ending") return;
    setCallState("ending");
    vapiRef.current?.stop();

    // Mark generating report + send transcript
    await fetch(`/api/ai-consultation/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "generating_report", transcript: transcriptRef.current }),
    }).catch(() => {});

    router.replace(`/patient/ai-consultation/${id}/waiting`);
  }, [id, router, callState]);

  const startCall = useCallback(async () => {
    if (!consultation || callState !== "idle") return;
    setCallState("connecting");

    const pc   = consultation.preConsultation;
    const qs   = consultation.aiQuestions;

    const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);
    vapiRef.current = vapi;

    vapi.on("call-start",   () => {
      setCallState("active");
      // Mark in_consultation
      fetch(`/api/ai-consultation/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_consultation" }),
      }).catch(() => {});
    });

    vapi.on("call-end",     () => { endCall(); });
    vapi.on("speech-start", () => setIsSpeaking(true));
    vapi.on("speech-end",   () => setIsSpeaking(false));

    vapi.on("message", (msg: { type: string; role?: string; transcript?: string; transcriptType?: string }) => {
      if (msg.type !== "transcript" || !msg.transcript) return;
      const label = msg.role === "assistant" ? "Doctor" : "Patient";
      if (msg.transcriptType === "final") {
        setTranscriptLines(prev => [...prev, { role: label, text: msg.transcript! }]);
        setInterimText(null);                              // clear interim on final
        transcriptRef.current += `${label}: ${msg.transcript}\n`;
      } else if (msg.transcriptType === "partial") {
        setInterimText({ role: label, text: msg.transcript }); // show live words
      }
    });

    vapi.on("error", (e: unknown) => {
      console.error("[VAPI]", e);
      setCallState("idle");
    });

    // VAPI v2: start(assistantId, overrides)
    await vapi.start(
      process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!,
      {
        variableValues: {
          patientName:        consultation.patientName,
          age:                String(profile?.age ?? "unknown"),
          gender:             profile?.gender ?? "unknown",
          weight:             String(profile?.weight ?? "unknown"),
          height:             String(profile?.height ?? "unknown"),
          bloodGroup:         profile?.bloodGroup ?? "unknown",
          knownConditions:    profile?.knownConditions?.join(", ") || "none",
          allergies:          profile?.allergies?.join(", ") || "none",
          currentMedications: profile?.currentMedications?.join(", ") || "none",
          symptoms:           pc?.symptoms ?? "",
          duration:           pc?.duration ?? "",
          severity:           pc?.severity ?? "",
          formMedications:    pc?.currentMedications || "none",
          additionalNotes:    pc?.additionalNotes || "none",
          question1:          qs[0] ?? "",
          question2:          qs[1] ?? "",
          question3:          qs[2] ?? "",
          question4:          qs[3] ?? "",
          question5:          qs[4] ?? "",
        },
      },
    );
  }, [consultation, profile, callState, id, endCall]);

  const toggleMute = useCallback(() => {
    if (!vapiRef.current) return;
    const next = !isMuted;
    vapiRef.current.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  if (!consultation) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const lastLine = transcriptLines[transcriptLines.length - 1];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 gap-8">

      {/* Title */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Brain className="w-5 h-5 text-blue-400" />
          <span className="text-blue-400 font-semibold text-sm">AI Consultation</span>
        </div>
        <p className="text-slate-400 text-xs">Your conversation is private and secure</p>
      </div>

      {/* Two video boxes */}
      <div className="flex gap-6 w-full max-w-2xl">

        {/* Doctor box */}
        <div className={`flex-1 aspect-square rounded-3xl overflow-hidden relative transition-all duration-300 ${
          callState === "active" && isSpeaking
            ? "ring-4 ring-blue-500 shadow-2xl shadow-blue-500/30"
            : "ring-2 ring-slate-700"
        }`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/doctor.jpg" alt="Dr. MediQ AI" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
          {callState === "active" && isSpeaking && (
            <div className="absolute top-3 right-3 flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 bg-blue-400 rounded-full animate-pulse"
                  style={{ height: `${12 + i * 6}px`, animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1">
            <p className="text-xs font-semibold">Dr. MediQ AI</p>
            <p className="text-xs text-blue-300">AI Doctor</p>
          </div>
        </div>

        {/* Patient box */}
        <div className={`flex-1 aspect-square rounded-3xl overflow-hidden relative bg-slate-800 transition-all duration-300 flex items-center justify-center ${
          callState === "active" && !isSpeaking && transcriptLines.some(l => l.role === "Patient")
            ? "ring-4 ring-emerald-500 shadow-2xl shadow-emerald-500/20"
            : "ring-2 ring-slate-700"
        }`}>
          <div className="w-24 h-24 rounded-full bg-linear-to-br from-blue-500 to-violet-500 flex items-center justify-center text-4xl font-bold text-white">
            {consultation.patientName.charAt(0).toUpperCase()}
          </div>
          {isMuted && (
            <div className="absolute top-3 right-3 bg-red-600 rounded-full p-1.5">
              <MicOff className="w-3 h-3" />
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1">
            <p className="text-xs font-semibold">{consultation.patientName}</p>
            <p className="text-xs text-slate-400">You</p>
          </div>
        </div>
      </div>

      {/* Live subtitle — show interim first (real-time words), fall back to last final */}
      <div className="w-full max-w-2xl h-12 flex items-center justify-center">
        {callState === "active" && (interimText || lastLine) && (() => {
          const display = interimText ?? lastLine!;
          return (
            <p className={`text-center text-sm bg-black/40 backdrop-blur-sm rounded-full px-5 py-2 max-w-full truncate transition-opacity ${interimText ? "opacity-80" : "opacity-100"} text-slate-300`}>
              <span className={`font-semibold mr-1 ${display.role === "Doctor" ? "text-blue-400" : "text-emerald-400"}`}>
                {display.role}:
              </span>
              {display.text}
              {interimText && <span className="animate-pulse ml-1">▌</span>}
            </p>
          );
        })()}
        {callState === "connecting" && (
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Connecting to Dr. MediQ AI…
          </p>
        )}
        {callState === "idle" && (
          <p className="text-slate-500 text-sm">Click Start to begin your consultation</p>
        )}
        {callState === "ending" && (
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Ending call and generating your report…
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {callState === "idle" && (
          <button
            onClick={startCall}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-2xl transition-colors shadow-lg"
          >
            <Brain className="w-5 h-5" /> Start Consultation
          </button>
        )}
        {callState === "active" && (
          <>
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isMuted ? "bg-red-600 hover:bg-red-700" : "bg-slate-700 hover:bg-slate-600"
              }`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg transition-colors"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
