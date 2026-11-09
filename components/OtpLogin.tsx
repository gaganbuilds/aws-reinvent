"use client";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const input = "w-full rounded-lg border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-accent";
const btn = "w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50";

export default function OtpLogin({ onDone, title = "Verify your email" }: { onDone: () => void; title?: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
      },
    });
    setBusy(false);

    if (error) {
      console.error("[Supabase Auth] signInWithOtp failed:", {
        message: error.message,
        status: error.status,
        code: (error as any).code,
        name: error.name,
      });

      const status = error.status;
      const code = (error as { code?: string }).code;

      if (
        status === 429 ||
        error.message?.toLowerCase().includes("rate limit") ||
        code === "over_email_send_rate_limit"
      ) {
        return toast.error("Too many OTP requests. Please wait a few minutes and try again.");
      }

      if (
        (status !== undefined && status >= 500) ||
        error.message?.toLowerCase().includes("sending confirmation") ||
        code === "unexpected_failure"
      ) {
        return toast.error("Email service configuration error. Please verify Supabase SMTP / email provider settings.");
      }

      return toast.error(error.message || "Unable to send verification email. Please try again.");
    }

    setSent(true);
    toast.success("Code sent. Check your inbox (and spam).");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);

    if (error) {
      console.error("[Supabase Auth] verifyOtp failed:", {
        message: error.message,
        status: error.status,
        code: (error as any).code,
        name: error.name,
      });
      return toast.error(error.message || "Invalid or expired verification code. Please try again.");
    }

    toast.success("Email verified successfully!");
    onDone();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {!sent ? (
        <form onSubmit={send} className="space-y-3">
          <input className={input} type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className={btn} disabled={busy}>{busy ? "Sending..." : "Send code"}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-slate-400">Enter the code sent to {email}</p>
          <input className={`${input} tracking-[0.4em]`} inputMode="numeric" required placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className={btn} disabled={busy}>{busy ? "Verifying..." : "Verify"}</button>
          <button type="button" className="w-full text-xs text-slate-400 underline" onClick={() => setSent(false)}>Use a different email</button>
        </form>
      )}
    </div>
  );
}
