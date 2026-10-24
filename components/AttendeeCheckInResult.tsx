"use client";
import { useEffect, useRef } from "react";
import { formatIST } from "@/lib/date";

export type CheckInResultData = {
  success: boolean;
  result: "checked_in" | "duplicate" | "invalid_qr" | "not_approved" | "error";
  message: string;
  failure_reason?: string;
  attendee?: {
    id?: string;
    attendee_id?: string;
    full_name?: string;
    email?: string;
    builder_id?: string;
    college?: string | null;
    status?: string;
    checked_in_at?: string | null;
    checked_in_by?: string | null;
    checked_in_by_email?: string | null;
  } | null;
};

interface AttendeeCheckInResultProps {
  data: CheckInResultData;
  onScanNext: () => void;
  onRetry?: () => void;
}

export default function AttendeeCheckInResult({
  data,
  onScanNext,
  onRetry,
}: AttendeeCheckInResultProps) {
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the "Scan Next" button so event staff can press Enter/Space
  useEffect(() => {
    nextBtnRef.current?.focus();
  }, []);

  const { result, message, failure_reason, attendee } = data;

  return (
    <div className="w-full max-w-xl animate-in fade-in zoom-in-95 duration-200">
      {/* CASE A: CHECK-IN SUCCESSFUL */}
      {result === "checked_in" && (
        <div className="overflow-hidden rounded-2xl border-2 border-green-500/60 bg-gradient-to-b from-[#092212] via-[#0b1712] to-[#0c0f17] p-6 shadow-2xl shadow-green-950/50">
          <div className="flex items-center gap-3 border-b border-green-500/20 pb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-2xl text-green-400 ring-4 ring-green-500/30">
              ✓
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-green-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-300 ring-1 ring-green-500/40">
                Verified Entry
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {message || "CHECK-IN SUCCESSFUL"}
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {/* Prominent Attendee Header */}
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-green-400">
                Attendee Name
              </span>
              <p className="text-2xl font-bold text-white">
                {attendee?.full_name || "Unknown"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/20 px-2.5 py-1 font-mono text-xs font-bold text-fuchsia-200">
                  {attendee?.attendee_id}
                </span>
                <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-xs text-slate-200">
                  ID: {attendee?.builder_id}
                </span>
              </div>
            </div>

            {/* Attendee Details Grid */}
            <dl className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-black/40 p-4 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-slate-400">Email Address</dt>
                <dd className="font-medium text-slate-200 truncate">{attendee?.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">College / Organisation</dt>
                <dd className="font-medium text-slate-200">{attendee?.college || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Check-In Timestamp</dt>
                <dd className="font-semibold text-green-300">
                  {formatIST(attendee?.checked_in_at)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Scanned By Staff</dt>
                <dd className="text-slate-200 truncate">
                  {attendee?.checked_in_by_email || "You (Authorized Staff)"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              ref={nextBtnRef}
              type="button"
              onClick={onScanNext}
              className="flex-1 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-900/40 transition hover:bg-green-500 hover:brightness-110 focus:ring-2 focus:ring-green-400 focus:outline-none"
            >
              Scan Next Attendee (Space / Enter)
            </button>
          </div>
        </div>
      )}

      {/* CASE B: ALREADY CHECKED IN (DUPLICATE SCAN) */}
      {result === "duplicate" && (
        <div className="overflow-hidden rounded-2xl border-2 border-amber-500/70 bg-gradient-to-b from-[#251506] via-[#1a110a] to-[#0c0f17] p-6 shadow-2xl shadow-amber-950/50">
          <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-2xl text-amber-400 ring-4 ring-amber-500/30">
              ⚠️
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-500/40">
                Duplicate Scan Warning
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {message || "ALREADY CHECKED IN"}
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-4 text-sm text-amber-200">
              <p className="font-semibold text-white">This pass has already been used for entry.</p>
              <p className="mt-1 text-xs text-amber-300/80">
                To prevent pass re-use and badge sharing, duplicate check-ins are recorded as scan warnings and do not overwrite the original timestamp.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Attendee Name
              </span>
              <p className="text-xl font-bold text-white">{attendee?.full_name || "—"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-fuchsia-300">
                  {attendee?.attendee_id}
                </span>
                <span className="rounded bg-white/10 px-2.5 py-0.5 font-mono text-xs text-slate-300">
                  ID: {attendee?.builder_id}
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-black/40 p-4 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-slate-400">Original Check-in Time</dt>
                <dd className="font-bold text-amber-300">
                  {formatIST(attendee?.checked_in_at)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Original Check-in Staff</dt>
                <dd className="text-slate-200 truncate">
                  {attendee?.checked_in_by_email || "Authorized Staff"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Email Address</dt>
                <dd className="text-slate-200 truncate">{attendee?.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">College / Organisation</dt>
                <dd className="text-slate-200">{attendee?.college || "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              ref={nextBtnRef}
              type="button"
              onClick={onScanNext}
              className="flex-1 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-amber-900/40 transition hover:bg-amber-500 hover:brightness-110 focus:ring-2 focus:ring-amber-400 focus:outline-none"
            >
              Continue Scanning Next (Space / Enter)
            </button>
          </div>
        </div>
      )}

      {/* CASE C: INVALID QR CODE */}
      {result === "invalid_qr" && (
        <div className="overflow-hidden rounded-2xl border-2 border-red-500/70 bg-gradient-to-b from-[#25080c] via-[#1a0a0f] to-[#0c0f17] p-6 shadow-2xl shadow-red-950/50">
          <div className="flex items-center gap-3 border-b border-red-500/20 pb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-2xl text-red-400 ring-4 ring-red-500/30">
              ✕
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300 ring-1 ring-red-500/40">
                Security Alert
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {message || "INVALID QR CODE — CHECK-IN DENIED"}
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-red-500/40 bg-red-500/15 p-4 text-sm text-red-200">
              <p className="font-semibold text-white">Unrecognized or Malformed Attendee QR</p>
              <p className="mt-1 text-xs text-red-300/80">
                {failure_reason || "This QR code does not correspond to any valid attendee pass in the registration database."}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-white">Staff Action Required:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Verify if attendee is showing the official digital pass on their phone.</li>
                <li>Check their registration status manually using their email or AWS Builder ID.</li>
                <li>Direct the person to the reception desk if their pass cannot be verified.</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              ref={nextBtnRef}
              type="button"
              onClick={onScanNext}
              className="flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 hover:brightness-110 focus:ring-2 focus:ring-red-400 focus:outline-none"
            >
              Scan Another QR (Space / Enter)
            </button>
          </div>
        </div>
      )}

      {/* CASE D: APPLICATION NOT APPROVED */}
      {result === "not_approved" && (
        <div className="overflow-hidden rounded-2xl border-2 border-purple-500/70 bg-gradient-to-b from-[#200d28] via-[#140b1c] to-[#0c0f17] p-6 shadow-2xl shadow-purple-950/50">
          <div className="flex items-center gap-3 border-b border-purple-500/20 pb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-2xl text-purple-400 ring-4 ring-purple-500/30">
              🚫
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 ring-1 ring-purple-500/40">
                Entry Ineligible
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {message || "APPLICATION NOT APPROVED"}
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-purple-500/40 bg-purple-500/15 p-4 text-sm text-purple-200">
              <p className="font-semibold text-white">Attendee Not Selected / Pending Review</p>
              <p className="mt-1 text-xs text-purple-300/80">
                {failure_reason || "This applicant's registration has not been accepted. Only accepted attendees may enter."}
              </p>
            </div>

            {attendee && (
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Applicant Name
                </span>
                <p className="text-lg font-bold text-white">{attendee.full_name || "—"}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 font-mono text-xs text-fuchsia-300">
                    {attendee.attendee_id}
                  </span>
                  <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs font-semibold uppercase text-yellow-300">
                    Status: {attendee.status || "unapproved"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              ref={nextBtnRef}
              type="button"
              onClick={onScanNext}
              className="flex-1 rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-purple-900/40 transition hover:bg-purple-500 hover:brightness-110 focus:ring-2 focus:ring-purple-400 focus:outline-none"
            >
              Scan Next Attendee (Space / Enter)
            </button>
          </div>
        </div>
      )}

      {/* CASE E: NETWORK OR UNEXPECTED ERROR */}
      {result === "error" && (
        <div className="overflow-hidden rounded-2xl border-2 border-red-500/70 bg-gradient-to-b from-[#25080c] via-[#1a0a0f] to-[#0c0f17] p-6 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-red-500/20 pb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-2xl text-red-400 ring-4 ring-red-500/30">
              ⚡
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300 ring-1 ring-red-500/40">
                {message?.includes("Migration") ? "Setup Required" : "Network Error"}
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {message || "Check-In Failed"}
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <p className="text-sm text-slate-300">
              {message || "Unable to reach database to verify check-in."}
            </p>
            {failure_reason && (
              <p className="font-mono text-xs text-red-300 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                {failure_reason}
              </p>
            )}
            <p className="text-xs text-slate-400">
              Check-in was not recorded. Retrying will not cause duplicate check-ins.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex-1 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:brightness-110"
              >
                Retry Check-In
              </button>
            )}
            <button
              ref={nextBtnRef}
              type="button"
              onClick={onScanNext}
              className="flex-1 rounded-xl border border-line bg-panel px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Scan Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
