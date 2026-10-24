"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";
import { toast } from "sonner";
import AttendeeCheckInResult, { CheckInResultData } from "./AttendeeCheckInResult";
import { supabase } from "@/lib/supabase";

interface QrScannerProps {
  onScanCompleted?: (result: CheckInResultData) => void;
  staffEmail?: string;
}

type CameraDevice = {
  id: string;
  label: string;
};

// Subtle Web Audio beep for instant staff feedback on scan
function playBeep(type: "success" | "warning" | "error") {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "warning") {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(349.23, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Ignore audio context errors if browser policy prevents audio
  }
}

export default function QrScanner({ onScanCompleted }: QrScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<CheckInResultData | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastScannedPayloadRef = useRef<string | null>(null);
  const readerElementId = "qr-reader-viewport";

  // Check available cameras when component mounts
  useEffect(() => {
    let mounted = true;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!mounted) return;
        if (devices && devices.length > 0) {
          const list = devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 5)}` }));
          setCameras(list);
          const backCam = list.find((c) => /back|rear|environment/i.test(c.label));
          setSelectedCameraId(backCam ? backCam.id : list[0].id);
        }
      })
      .catch((_err) => {
        // Normal before camera permissions granted
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Safe camera stop routine
  const stopCamera = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
    } catch {
      // Ignore if already stopped
    } finally {
      setIsScanning(false);
      isStoppingRef.current = false;
    }
  }, []);

  // Clean teardown on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        try {
          scannerRef.current.clear();
        } catch {
          // Ignore clear error
        }
      }
    };
  }, []);

  // Core Check-In verification handler calling Supabase RPC check_in_attendee
  const processQrPayload = useCallback(
    async (rawPayload: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setProcessing(true);

      // Stop camera immediately to prevent repeated triggers
      await stopCamera();

      try {
        const payload = rawPayload.trim();
        lastScannedPayloadRef.current = payload;

        const { data, error } = await supabase.rpc("check_in_attendee", {
          p_qr_payload: payload,
        });

        if (error) {
          playBeep("error");
          const isSchemaMissing =
            error.message?.includes("schema cache") ||
            error.code === "PGRST202" ||
            error.message?.includes("check_in_attendee");

          const errorResult: CheckInResultData = {
            success: false,
            result: "error",
            message: isSchemaMissing
              ? "Database Migration Required"
              : error.message || "Failed to communicate with check-in service",
            failure_reason: isSchemaMissing
              ? "The check_in_attendee function is not yet installed in your Supabase project. Please run the SQL file (supabase/migrations/20261024_qr_checkin_system.sql) in your Supabase Dashboard > SQL Editor."
              : error.details || error.hint || error.message,
          };
          setScanResult(errorResult);
          onScanCompleted?.(errorResult);
          toast.error(
            isSchemaMissing
              ? "Database migration required: run 20261024_qr_checkin_system.sql in Supabase SQL Editor"
              : "Check-in error: " + error.message
          );
          return;
        }

        const res = data as CheckInResultData;
        setScanResult(res);
        onScanCompleted?.(res);

        if (res.result === "checked_in") {
          playBeep("success");
          toast.success(`✓ Checked in: ${res.attendee?.full_name || "Attendee"}`);
        } else if (res.result === "duplicate") {
          playBeep("warning");
          toast.warning("Duplicate scan: Already checked in");
        } else if (res.result === "not_approved") {
          playBeep("warning");
          toast.error("Application not approved");
        } else {
          playBeep("error");
          toast.error("Invalid QR Code — check-in denied");
        }
      } catch (err: unknown) {
        playBeep("error");
        const msg = err instanceof Error ? err.message : "Unexpected check-in error";
        const errorResult: CheckInResultData = {
          success: false,
          result: "error",
          message: msg,
        };
        setScanResult(errorResult);
        onScanCompleted?.(errorResult);
        toast.error(msg);
      } finally {
        setProcessing(false);
        isProcessingRef.current = false;
      }
    },
    [stopCamera, onScanCompleted]
  );

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    setPermissionDenied(false);
    setScanResult(null);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerElementId, {
          verbose: false,
        });
      }

      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      const config: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      const cameraConfig = selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : { facingMode: "environment" };

      await scannerRef.current.start(
        cameraConfig,
        config,
        (decodedText) => {
          processQrPayload(decodedText);
        },
        () => {
          // Normal frame pass
        }
      );

      setIsScanning(true);

      Html5Qrcode.getCameras().then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 5)}` })));
        }
      });
    } catch (err: unknown) {
      const errStr = String(err);
      if (errStr.includes("NotAllowedError") || errStr.includes("Permission denied")) {
        setPermissionDenied(true);
        setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (errStr.includes("NotFoundError") || errStr.includes("no camera")) {
        setCameraError("No suitable camera found on this device. You can use image upload or manual ID entry below.");
      } else {
        setCameraError("Failed to initialize camera: " + errStr);
      }
      setIsScanning(false);
    }
  };

  // Continue scanning next attendee
  const handleScanNext = () => {
    setScanResult(null);
    lastScannedPayloadRef.current = null;
    startCamera();
  };

  // Fallback: Scan from image file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProcessing(true);
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerElementId, { verbose: false });
      }

      const decodedText = await scannerRef.current.scanFile(file, false);
      toast.success("QR code detected from image!");
      await processQrPayload(decodedText);
    } catch {
      toast.error("No valid QR code could be found in the uploaded image.");
    } finally {
      setProcessing(false);
      e.target.value = "";
    }
  };

  // Fallback: Manual Attendee ID entry
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = manualInput.trim();
    if (!id) return;
    setManualBusy(true);
    await processQrPayload(id);
    setManualBusy(false);
    setManualInput("");
  };

  return (
    <div className="flex flex-col items-center space-y-6 w-full">
      {/* Result Display: Shown when an attendee check-in has been processed */}
      {scanResult && (
        <AttendeeCheckInResult
          data={scanResult}
          onScanNext={handleScanNext}
          onRetry={
            scanResult.result === "error" && lastScannedPayloadRef.current
              ? () => processQrPayload(lastScannedPayloadRef.current!)
              : undefined
          }
        />
      )}

      {/* Scanner Card: Keep DOM structure stable using hidden to prevent React DOM reconciliation race conditions */}
      <div className={`w-full max-w-xl space-y-6 ${scanResult ? "hidden" : "block"}`}>
        <div className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-2xl sm:p-7">
          {/* Ambient subtle glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-fuchsia-600/10 blur-3xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>📷</span> Event Check-In Scanner
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Scan attendee QR pass or enter Attendee ID to verify entry
              </p>
            </div>

            {/* Camera status badge */}
            <div className="flex items-center gap-2">
              <span
                className={`flex h-2.5 w-2.5 rounded-full ${
                  isScanning ? "bg-green-400 animate-pulse" : processing ? "bg-amber-400 animate-spin" : "bg-slate-600"
                }`}
              />
              <span className="text-xs font-medium text-slate-300">
                {isScanning ? "Camera Live" : processing ? "Verifying..." : "Scanner Ready"}
              </span>
            </div>
          </div>

          {/* Video Viewport Area */}
          <div className="relative mt-5">
            <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-white/20 bg-black/80 aspect-square max-h-[360px] w-full flex items-center justify-center">
              {/* IMPORTANT: #qr-reader-viewport must remain completely empty in React JSX.
                  React manages NO child nodes inside it to prevent NotFoundError: removeChild conflicts. */}
              <div id={readerElementId} className="w-full h-full flex items-center justify-center overflow-hidden" />

              {/* Sibling overlay placeholder when camera is not running */}
              {!isScanning && !processing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/15 text-3xl">
                    📷
                  </div>
                  <p className="mt-4 text-sm font-semibold text-white">Camera is currently paused</p>
                  <p className="mt-1 text-xs text-slate-400 max-w-xs">
                    Click below to activate your webcam or mobile camera
                  </p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95"
                  >
                    ▶ Start Scanner
                  </button>
                </div>
              )}

              {/* Sibling processing overlay */}
              {processing && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
                  <p className="mt-3 text-sm font-bold text-white">Verifying Attendee with Supabase...</p>
                  <p className="mt-1 text-xs text-slate-400">Validating pass & checking concurrency rules</p>
                </div>
              )}
            </div>
          </div>

          {/* Camera Controls & Device Picker */}
          {isScanning && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                ⏹ Stop Camera
              </button>

              {cameras.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Switch Camera:</span>
                  <select
                    className="rounded-lg border border-line bg-ink px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent"
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      stopCamera().then(() => {
                        setTimeout(startCamera, 200);
                      });
                    }}
                  >
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Errors / Permission Guidance */}
          {cameraError && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/15 p-4 text-xs text-red-200">
              <p className="font-semibold text-white">Camera Notice</p>
              <p className="mt-1 text-red-300">{cameraError}</p>
              {permissionDenied && (
                <p className="mt-2 text-[11px] text-slate-300">
                  💡 If you previously denied permission, click the camera/lock icon in your browser address bar to reset permissions, then refresh.
                </p>
              )}
            </div>
          )}

          {/* Fallbacks section */}
          <div className="mt-6 border-t border-white/10 pt-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-300">
                Alternative Input Options
              </span>
              <span>For desk assistance</span>
            </div>

            {/* Manual ID Input */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Attendee ID (e.g. REIM-XXXXXXXX)"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="flex-1 rounded-xl border border-line bg-ink px-3.5 py-2.5 font-mono text-xs uppercase text-white placeholder:normal-case placeholder:text-slate-500 outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={manualBusy || !manualInput.trim()}
                className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-40"
              >
                {manualBusy ? "Checking..." : "Verify ID"}
              </button>
            </form>

            {/* Image file scan */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line/60 bg-white/5 p-3 text-xs">
              <div>
                <p className="font-medium text-slate-200">Scan QR from Image File</p>
                <p className="text-[11px] text-slate-400">Upload screenshot or photo of an attendee pass</p>
              </div>
              <label className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20">
                Browse Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
