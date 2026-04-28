"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { TranscriptLine } from "@/types/consultation";

interface UseTranscriptionOptions {
  appointmentId: string;
  role:          "doctor" | "patient";
  socketRef:     React.RefObject<Socket | null>;
  enabled:       boolean;
}

export function useTranscription({
  appointmentId,
  role,
  socketRef,
  enabled,
}: UseTranscriptionOptions) {
  const [lines, setLines]         = useState<TranscriptLine[]>([]);
  const [isListening, setListening] = useState(false);
  const recognitionRef            = useRef<SpeechRecognition | null>(null);

  const addLine = useCallback((newLine: TranscriptLine) => {
    setLines(prev => [...prev, newLine]);
  }, []);

  // Receive transcript lines from the other party via socket
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handler = ({ role: r, text }: { role: string; text: string }) => {
      addLine({ role: r as "doctor" | "patient", text, timestamp: Date.now() });
    };
    socket.on("transcript:line", handler);
    return () => { socket.off("transcript:line", handler); };
  }, [socketRef, addLine]);

  // Start / stop own speech recognition
  const start = useCallback(() => {
    const SR = window.SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition as typeof SpeechRecognition | undefined;
    if (!SR) return;

    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.continuous      = true;
    recognition.interimResults  = false;
    recognition.lang            = "en-US";

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (!text) continue;
          const line: TranscriptLine = { role, text, timestamp: Date.now() };
          addLine(line);
          socketRef.current?.emit("transcript:line", { appointmentId, role, text });
        }
      }
    };

    recognition.onend = () => {
      // Auto-restart if still enabled (recognition stops on silence)
      if (recognitionRef.current === recognition && enabled) {
        recognition.start();
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== "no-speech") console.warn("Speech recognition error:", e.error);
    };

    recognition.start();
    setListening(true);
  }, [appointmentId, role, socketRef, enabled, addLine]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => {
    if (enabled) start();
    else         stop();
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const getFullText = useCallback(() =>
    lines.map(l => `${l.role === "doctor" ? "Doctor" : "Patient"}: ${l.text}`).join("\n"),
  [lines]);

  return { lines, isListening, getFullText };
}
