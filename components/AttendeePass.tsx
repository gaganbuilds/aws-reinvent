"use client";
import { useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import { EVENT } from "@/lib/config";

export type AttendeePassData = {
  full_name: string;
  builder_id: string;
  college?: string | null;
  attendee_id: string;
  status: "accepted" | string;
  checked_in_at?: string | null;
};

export default function AttendeePass({ app }: { app: AttendeePassData }) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  function copyId() {
    navigator.clipboard.writeText(app.attendee_id);
    setCopied(true);
    toast.success("Attendee ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadQr() {
    try {
      const container = canvasRef.current;
      if (!container) return;
      const canvas = container.querySelector("canvas");
      if (!canvas) {
        toast.error("QR canvas not ready. Please try again.");
        return;
      }
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${app.attendee_id}-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("QR code downloaded");
    } catch (err) {
      toast.error("Failed to download QR code image");
    }
  }

  function printPass() {
    window.print();
  }

  return (
    <div className="space-y-4">
      {/* Printable Pass Container */}
      <div
        id="attendee-pass-card"
        className="relative overflow-hidden rounded-2xl border border-fuchsia-500/40 bg-gradient-to-br from-[#0c0f20] via-[#10142c] to-[#1c0e35] p-6 shadow-2xl transition hover:border-fuchsia-500/60 sm:p-7 print:border-2 print:border-black print:bg-white print:text-black print:p-8"
      >
        {/* Glow ambient background elements (hidden on print) */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-fuchsia-600/15 blur-3xl print:hidden" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-indigo-600/15 blur-3xl print:hidden" />

        {/* Card Header */}
        <div className="relative border-b border-white/10 pb-5 print:border-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse print:hidden" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-400 print:text-black">
                Official Attendee Pass
              </span>
            </div>
            <div className="flex items-center gap-2">
              {app.checked_in_at && (
                <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40 print:border print:border-black print:bg-transparent print:text-black">
                  ✓ Checked In
                </span>
              )}
              <span className="rounded-full bg-green-500/20 px-3 py-0.5 text-xs font-semibold text-green-300 ring-1 ring-green-500/40 print:border print:border-black print:bg-transparent print:text-black">
                Seat Confirmed
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white print:text-black sm:text-2xl">
                {EVENT.name}
              </h2>
              <p className="mt-0.5 text-xs text-slate-300 print:text-gray-700">
                {EVENT.city} · {EVENT.dateLabel}
              </p>
            </div>
            <div className="hidden shrink-0 sm:block print:block opacity-90">
              <Logo size="md" />
            </div>
          </div>
        </div>

        {/* Card Body: QR Code + Attendee Metadata */}
        <div className="relative mt-6 grid gap-6 sm:grid-cols-12 sm:items-center">
          {/* QR Code section */}
          <div className="flex flex-col items-center justify-center sm:col-span-5">
            <div className="rounded-xl border border-white/20 bg-white p-3.5 shadow-md ring-4 ring-black/30 print:border-black print:ring-0">
              {/* Visible SVG for crisp display on all screens */}
              <QRCodeSVG
                value={app.attendee_id}
                size={144}
                level="H"
                includeMargin={false}
                aria-label={`QR Code for Attendee ID ${app.attendee_id}`}
              />
            </div>
            {/* Hidden canvas used exclusively for image downloads */}
            <div ref={canvasRef} className="hidden" aria-hidden="true">
              <QRCodeCanvas
                value={app.attendee_id}
                size={512}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400 print:text-gray-600">
              Scan at reception desk
            </p>
          </div>

          {/* Attendee Details section */}
          <div className="space-y-3 sm:col-span-7">
            {/* Unique Attendee ID Badge */}
            <div className="rounded-xl border border-line bg-panel/80 p-3 print:border-black print:bg-gray-100">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 print:text-gray-600">
                Unique Attendee ID
              </span>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-extrabold tracking-wider text-fuchsia-300 print:text-black">
                  {app.attendee_id}
                </span>
                <button
                  type="button"
                  onClick={copyId}
                  className="no-print rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                  title="Copy Attendee ID"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Attendee Name */}
            <div>
              <span className="block text-[11px] text-slate-400 print:text-gray-600">Full Name</span>
              <p className="font-semibold text-white print:text-black">{app.full_name}</p>
            </div>

            {/* AWS Builder ID */}
            <div>
              <span className="block text-[11px] text-slate-400 print:text-gray-600">AWS Builder ID</span>
              <p className="font-mono text-sm text-slate-200 print:text-black">{app.builder_id}</p>
            </div>

            {/* College or Organisation */}
            {app.college && (
              <div>
                <span className="block text-[11px] text-slate-400 print:text-gray-600">
                  College / Organisation
                </span>
                <p className="text-sm text-slate-200 print:text-black">{app.college}</p>
              </div>
            )}
          </div>
        </div>

        {/* Card Footer notice */}
        <div className="mt-6 border-t border-white/10 pt-4 text-center text-[11px] text-slate-400 print:border-black/20 print:text-gray-600">
          This digital pass is personal and non-transferable. Please present this QR along with a valid ID at entry.
        </div>
      </div>

      {/* Action Buttons (Hidden when printing) */}
      <div className="no-print flex flex-wrap gap-2.5 pt-1">
        <button
          type="button"
          onClick={printPass}
          className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10"
        >
          🖨️ Print Pass
        </button>
        <button
          type="button"
          onClick={downloadQr}
          className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10"
        >
          📥 Download QR Code
        </button>
      </div>
    </div>
  );
}
