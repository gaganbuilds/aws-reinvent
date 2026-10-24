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
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Code sent. Check your inbox (and spam).");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return toast.error(error.message);
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
