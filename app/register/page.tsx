"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import OtpLogin from "@/components/OtpLogin";
import { useSession } from "@/components/useSession";
import { supabase } from "@/lib/supabase";
import { EVENT, STEPS } from "@/lib/config";

const input = "w-full rounded-lg border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-accent";

export default function RegisterPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const [open, setOpen] = useState(true);
  const [form, setForm] = useState({
    full_name: "", phone: "", city: "", college: "",
    year_of_study: "", branch: "", builder_id: "", consent: false,
  });
  const [busy, setBusy] = useState(false);

  // If already applied, go straight to the status page. Also check if applications are open.
  useEffect(() => {
    if (!session) return;
    supabase.from("applications").select("id").eq("user_id", session.user.id).maybeSingle().then(({ data }) => {
      if (data) router.replace("/status");
    });
  }, [session, router]);
  useEffect(() => {
    supabase.rpc("applications_open").then(({ data }) => { if (data === false) setOpen(false); });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    const phone = form.phone.replace(/\D/g, "").slice(-10);
    if (phone.length !== 10) return toast.error("Enter a valid 10-digit phone number.");
    if (!form.consent) return toast.error("Please accept the consent checkbox.");
    setBusy(true);
    const { error } = await supabase.from("applications").insert({
      user_id: session.user.id,
      email: session.user.email,
      full_name: form.full_name.trim(),
      phone,
      city: form.city.trim(),
      college: form.college.trim() || null,
      year_of_study: form.year_of_study,
      branch: form.branch.trim(),
      builder_id: form.builder_id.trim(),
      consent: form.consent,
    });
    setBusy(false);
    if (error) return toast.error(error.code === "23505" ? "You have already applied." : error.message);
    toast.success("Registration submitted!");
    router.push("/status");
  }

  return (
    <>
      <SiteNav solid />
      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-5">
        {/* LEFT: event info */}
        <aside className="space-y-8 lg:col-span-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">Registration</p>
            <h1 className="mt-2 text-3xl font-bold">{EVENT.name}</h1>
            <p className="mt-2 text-slate-400">{EVENT.tagline}</p>
          </div>
          <dl className="space-y-3 rounded-xl border border-line bg-panel p-5 text-sm">
            <div><dt className="text-slate-400">Date</dt><dd className="font-semibold">{EVENT.dateLabel} · {EVENT.timeLabel}</dd></div>
            <div><dt className="text-slate-400">Venue</dt><dd className="font-semibold">{EVENT.venue}, {EVENT.city}</dd></div>
            <div><dt className="text-slate-400">Entry</dt><dd className="font-semibold">Free · limited seats</dd></div>
          </dl>
          <ol className="space-y-3 text-sm">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">{s.n}</span>
                <span><b>{s.title}.</b> <span className="text-slate-400">{s.body}</span></span>
              </li>
            ))}
          </ol>
        </aside>

        {/* RIGHT: OTP then form */}
        <section className="lg:col-span-3">
          <div className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
            {!open ? (
              <p className="text-slate-300">Registration is currently closed. Please check back later.</p>
            ) : loading ? (
              <p className="text-slate-400">Loading...</p>
            ) : !session ? (
              <OtpLogin title="Step 1: Verify your email" onDone={() => toast.success("Email verified")} />
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <h2 className="text-lg font-semibold">Step 2: Your details</h2>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Email (verified)</label>
                  <input className={`${input} opacity-60`} value={session.user.email ?? ""} readOnly />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Full name</label>
                  <input className={input} required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Phone / WhatsApp number</label>
                  <input className={input} required type="tel" inputMode="numeric" placeholder="10-digit number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">City</label>
                  <input className={input} required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">College / organisation</label>
                  <input className={input} required value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Year of study</label>
                  <select className={input} required value={form.year_of_study} onChange={(e) => setForm({ ...form, year_of_study: e.target.value })}>
                    <option value="">Select</option>
                    <option>1st year</option><option>2nd year</option><option>3rd year</option><option>4th year</option><option>Working professional</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Branch / department</label>
                  <input className={input} required value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">AWS Builder ID</label>
                  <input className={input} required value={form.builder_id} onChange={(e) => setForm({ ...form, builder_id: e.target.value })} placeholder="Your AWS Builder ID" />
                  <p className="mt-1 text-xs text-slate-400">
                    Don't have one?{" "}
                    <a className="underline text-accent" href={EVENT.builderIdSignupUrl} target="_blank" rel="noreferrer">Create it here (about 2 minutes)</a>, then come back.
                  </p>
                </div>
                <label className="flex items-start gap-3 text-sm text-slate-300">
                  <input type="checkbox" className="mt-1" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                  I agree to share my details with the organisers.
                </label>
                <button disabled={busy} className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
                  {busy ? "Submitting..." : "Complete registration"}
                </button>
                <p className="text-xs text-slate-500">Your details are used only for this event. Questions? {EVENT.contactEmail}</p>
              </form>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}