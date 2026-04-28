"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import type { RGBSignals, RGB, FaceQuality } from "@/types/vitals";
import { extractROIsFromImageData, assessFaceQuality } from "./roiExtraction";

const TARGET_FPS          = 30;
const SCAN_DURATION       = 30;               // seconds
const FRAME_INTERVAL_MS   = 1000 / TARGET_FPS;
const STEADY_BEFORE_START = 3;                // seconds of "good" face → auto-start
const FACE_LOSS_PAUSE_MS  = 2000;             // pause countdown if face lost this long

type CaptureState = "idle" | "positioning" | "scanning" | "complete" | "error";

interface UseVitalsCaptureReturn {
  state:            CaptureState;
  faceQuality:      FaceQuality;
  countdown:        number;
  framesProcessed:  number;
  framesRejected:   number;
  rgbSignals:       RGBSignals | null;
  actualFps:        number;
  errorMessage:     string | null;
  start:            () => void;
  cancel:           () => void;
}

// Accepts a RefObject so it can read .current inside the RAF loop —
// passing videoRef.current directly would capture null at render time.
export function useVitalsCapture(
  videoRef:   RefObject<HTMLVideoElement | null>,
  landmarker: FaceLandmarker | null,
): UseVitalsCaptureReturn {
  const [state, setState]           = useState<CaptureState>("idle");
  const [faceQuality, setFQ]        = useState<FaceQuality>("none");
  const [countdown, setCountdown]   = useState(SCAN_DURATION);
  const [framesProcessed, setFP]    = useState(0);
  const [framesRejected, setFR]     = useState(0);
  const [rgbSignals, setRgbSignals] = useState<RGBSignals | null>(null);
  const [actualFps, setActualFps]   = useState(TARGET_FPS);
  const [errorMessage, setEM]       = useState<string | null>(null);

  // mutable refs (no re-render)
  const rafRef         = useRef<number | null>(null);
  const lastFrameMs    = useRef(0);
  const scanStartMs    = useRef(0);
  const goodSinceMs    = useRef<number | null>(null);
  const lastFaceMs     = useRef(performance.now());
  const stateRef       = useRef<CaptureState>("idle");
  const buffers        = useRef<{ forehead: RGB[]; left_cheek: RGB[]; right_cheek: RGB[] }>({
    forehead: [], left_cheek: [], right_cheek: [],
  });
  const canvasRef      = useRef<HTMLCanvasElement | null>(null);
  const ctxRef         = useRef<CanvasRenderingContext2D | null>(null);
  const landmarkerRef  = useRef<FaceLandmarker | null>(null);

  // Keep landmarkerRef in sync so the RAF loop always has the latest instance
  useEffect(() => { landmarkerRef.current = landmarker; }, [landmarker]);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Off-screen canvas — created once
  useEffect(() => {
    const c   = document.createElement("canvas");
    c.width   = 640;
    c.height  = 480;
    canvasRef.current = c;
    ctxRef.current    = c.getContext("2d", { willReadFrequently: true });
  }, []);

  const reset = useCallback(() => {
    buffers.current = { forehead: [], left_cheek: [], right_cheek: [] };
    setFP(0); setFR(0);
    setCountdown(SCAN_DURATION);
    setRgbSignals(null);
    setEM(null);
    goodSinceMs.current = null;
  }, []);

  const cancel = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    reset();
    setState("idle");
    setFQ("none");
  }, [reset]);

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);

    // Read videoRef.current inside the loop — it's null at hook init time
    const videoEl = videoRef.current;
    if (!videoEl || !canvasRef.current || !ctxRef.current) return;
    if (videoEl.readyState < 2) return;

    const lm = landmarkerRef.current;
    if (!lm) return;

    const now = performance.now();
    if (now - lastFrameMs.current < FRAME_INTERVAL_MS) return;
    lastFrameMs.current = now;

    const c   = canvasRef.current;
    const ctx = ctxRef.current;

    // Sync canvas to video dimensions
    if (c.width !== videoEl.videoWidth || c.height !== videoEl.videoHeight) {
      c.width  = videoEl.videoWidth  || 640;
      c.height = videoEl.videoHeight || 480;
    }

    ctx.drawImage(videoEl, 0, 0, c.width, c.height);

    // Face detection
    let landmarks: { x: number; y: number; z: number }[] | null = null;
    try {
      const res = lm.detectForVideo(c, now);
      landmarks = res?.faceLandmarks?.[0] ?? null;
    } catch { /* ignore transient WASM errors */ }

    const quality = assessFaceQuality(landmarks, c.width, c.height);
    setFQ(quality);
    if (quality !== "none") lastFaceMs.current = now;

    // ---- POSITIONING ----
    if (stateRef.current === "positioning") {
      if (quality === "good") {
        if (goodSinceMs.current === null) goodSinceMs.current = now;
        if (now - goodSinceMs.current >= STEADY_BEFORE_START * 1000) {
          scanStartMs.current = now;
          buffers.current     = { forehead: [], left_cheek: [], right_cheek: [] };
          setFP(0); setFR(0); setCountdown(SCAN_DURATION);
          setState("scanning");
        }
      } else {
        goodSinceMs.current = null;
      }
      return;
    }

    // ---- SCANNING ----
    if (stateRef.current !== "scanning") return;

    // Pause if face has been lost for too long
    if (!landmarks || now - lastFaceMs.current > FACE_LOSS_PAUSE_MS) return;

    const img  = ctx.getImageData(0, 0, c.width, c.height);
    const rois = extractROIsFromImageData(img, landmarks);

    if (rois) {
      buffers.current.forehead.push(rois.forehead);
      buffers.current.left_cheek.push(rois.left_cheek);
      buffers.current.right_cheek.push(rois.right_cheek);
      setFP(buffers.current.forehead.length);
    } else {
      setFR(prev => prev + 1);
    }

    const elapsedSec = (now - scanStartMs.current) / 1000;
    setCountdown(Math.max(0, Math.ceil(SCAN_DURATION - elapsedSec)));

    if (elapsedSec >= SCAN_DURATION) {
      const n         = buffers.current.forehead.length;
      const minNeeded = TARGET_FPS * 10;   // at least 10 valid seconds
      if (n < minNeeded) {
        setEM(`Only ${n} valid frames captured. Try again with steadier framing and better lighting.`);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        setState("error");
        return;
      }

      setActualFps(n / elapsedSec);
      setRgbSignals({
        forehead:    [...buffers.current.forehead],
        left_cheek:  [...buffers.current.left_cheek],
        right_cheek: [...buffers.current.right_cheek],
      });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setState("complete");
    }
  }, [videoRef]);   // videoRef (the object) is stable; .current is read inside

  const start = useCallback(() => {
    if (!videoRef.current || !landmarkerRef.current) {
      setEM("Camera or face model not ready — please wait a moment and try again");
      setState("error");
      return;
    }
    reset();
    setState("positioning");
    lastFrameMs.current  = 0;
    lastFaceMs.current   = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [videoRef, reset, tick]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  return {
    state, faceQuality, countdown, framesProcessed, framesRejected,
    rgbSignals, actualFps, errorMessage, start, cancel,
  };
}
