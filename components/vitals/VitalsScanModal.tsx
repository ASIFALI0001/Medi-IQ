"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { VitalsDemographics, VitalsResult, ScanState } from "@/types/vitals";
import { useFaceLandmarker } from "./useFaceLandmarker";
import { useVitalsCapture } from "./useVitalsCapture";
import { CameraView } from "./CameraView";
import { VitalsResults } from "./VitalsResults";
import { predictVitals } from "@/lib/vitalsApi";

interface Props {
  demographics: VitalsDemographics;
  onComplete:   (vitals: VitalsResult) => void;
  onCancel:     () => void;
}

const SCAN_DURATION = 30;

export function VitalsScanModal({ demographics, onComplete, onCancel }: Props) {
  const [phase, setPhase]               = useState<ScanState>("intro");
  const [streamError, setStreamError]   = useState<string | null>(null);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [result, setResult]             = useState<VitalsResult | null>(null);

  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { landmarker, isLoading: lmLoading, error: lmError } = useFaceLandmarker();
  const capture = useVitalsCapture(videoRef, landmarker);

  // ---------------------------------------------------------------------------
  // Stream helpers
  // ---------------------------------------------------------------------------
  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // Step 1 — get the camera stream and flip phase so CameraView mounts.
  // We intentionally do NOT attach srcObject here because videoRef.current is
  // still null at this point (CameraView hasn't rendered yet).
  const startStream = async () => {
    setStreamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:      { ideal: 640 },
          height:     { ideal: 480 },
          frameRate:  { ideal: 30 },
          facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      // Phase change triggers React to render CameraView with the <video> element.
      // The useEffect below picks up from here once the DOM is committed.
      setPhase("positioning");
    } catch (e) {
      setStreamError(e instanceof Error ? e.message : "Could not access camera");
      setPhase("error");
    }
  };

  // Step 2 — runs after React commits CameraView to the DOM.
  // videoRef.current now points to the real <video> element, so we can
  // safely set srcObject and kick off the capture loop.
  useEffect(() => {
    if (phase !== "positioning") return;

    const video  = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    // Attach stream — this makes the video visible immediately
    video.srcObject = stream;
    video.play().catch(() => {
      // Autoplay blocked (very rare with muted+playsInline) — retry once
      video.muted = true;
      video.play().catch(() => {});
    });

    // Give the video element one frame to start rendering before capture starts
    const t = setTimeout(() => capture.start(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      capture.cancel();
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // React to capture state transitions
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (capture.state === "scanning") {
      setPhase("scanning");
    }

    if (capture.state === "complete" && capture.rgbSignals) {
      setPhase("processing");
      stopStream();
      predictVitals(capture.rgbSignals, demographics, capture.actualFps)
        .then(r  => { setResult(r); setPhase("done"); })
        .catch(e => {
          setPredictError(e instanceof Error ? e.message : "Prediction failed");
          setPhase("error");
        });
    }

    if (capture.state === "error") {
      setStreamError(capture.errorMessage);
      stopStream();
      setPhase("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture.state]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleClose  = () => { capture.cancel(); stopStream(); onCancel(); };
  const handleRescan = () => {
    setResult(null);
    setStreamError(null);
    setPredictError(null);
    setPhase("intro");
  };
  const handleAccept = () => {
    if (result) onComplete(result);
    stopStream();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-fade-in-up opacity-0"
        style={{ animationFillMode: "forwards" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Measure Vitals</h2>
            <p className="text-xs text-slate-500 mt-0.5">30-second camera scan</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">

          {/* Intro */}
          {phase === "intro" && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-slate-700 text-sm font-medium">Before scanning, please:</p>
              <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-600">
                <li>Sit in a well-lit room — face a window if possible</li>
                <li>Remove glasses if they cause glare</li>
                <li>Keep still and look directly at the camera</li>
                <li>The scan takes exactly 30 seconds</li>
              </ul>
              <p className="text-xs text-slate-400 italic leading-relaxed">
                This is a screening tool, not a medical measurement. Results are estimates
                to assist your doctor during the consultation.
              </p>
              <button
                onClick={startStream}
                disabled={lmLoading || !!lmError}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl py-3 transition-all duration-150 active:scale-95"
              >
                {lmLoading ? "Loading face model..." : lmError ? "Face model unavailable" : "Start scan"}
              </button>
              {lmError && (
                <p className="text-xs text-red-600 text-center">{lmError}</p>
              )}
            </div>
          )}

          {/* Camera view — rendered for both positioning and scanning phases */}
          {(phase === "positioning" || phase === "scanning") && (
            <CameraView
              videoRef={videoRef}
              faceQuality={capture.faceQuality}
              state={phase as "positioning" | "scanning"}
              countdown={capture.countdown}
              framesProcessed={capture.framesProcessed}
              scanDurationSec={SCAN_DURATION}
            />
          )}

          {/* Processing spinner */}
          {phase === "processing" && (
            <div className="py-14 text-center">
              <div className="inline-block w-10 h-10 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
              <p className="mt-5 text-slate-700 font-medium">Analysing your signal...</p>
              <p className="text-xs text-slate-400 mt-1">This usually takes 1–3 seconds</p>
            </div>
          )}

          {/* Results */}
          {phase === "done" && result && (
            <VitalsResults
              result={result}
              onAccept={handleAccept}
              onRescan={handleRescan}
            />
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="space-y-4 animate-fade-in">
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
                {streamError ?? predictError ?? "Something went wrong. Please try again."}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleRescan}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-2.5 transition-colors active:scale-95"
                >
                  Try again
                </button>
                <button
                  onClick={handleClose}
                  className="px-5 border border-slate-200 hover:bg-slate-50 rounded-xl py-2.5 text-slate-600 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
