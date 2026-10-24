"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import SiteNav from "@/components/SiteNav";
import OtpLogin from "@/components/OtpLogin";
import { useSession } from "@/components/useSession";
import { supabase } from "@/lib/supabase";
import QrScanner from "@/components/QrScanner";
import ScanRecords from "@/components/ScanRecords";

type Row = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  college: string | null;
  year_of_study: string | null;
  branch: string | null;
  builder_id: string;
  consent: boolean | null;
  status: string;
  submitted_at: string;
  attendee_id?: string | null;
  checked_in_at?: string | null;
};
type Mod = { user_id: string; email: string; added_at: string };

function group(rows: Row[], key: "college" | "city" | "year_of_study" | "branch"): [string, number][] {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const k = (r[key] ?? "").toString().trim() || "Not given";
    m.set(k, (m.get(k) ?? 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function perDay(rows: Row[]): [string, number][] {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const d = new Date(r.submitted_at).toLocaleDateString("en-CA");
    m.set(d, (m.get(d) ?? 0) + 1);
  });
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
}

function Bars({ title, data }: { title: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map(([, n]) => n));
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {data.length === 0 ? <p className="text-sm text-slate-400">No data yet.</p> : (
        <ul className="space-y-2">
          {data.map(([k, n]) => (
            <li key={k} className="text-sm">
              <div className="flex justify-between"><span className="truncate pr-2">{k}</span><span className="text-slate-400">{n}</span></div>
              <div className="mt-1 h-2 rounded bg-white/10"><div className="h-2 rounded bg-accent" style={{ width: `${(n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { session, loading } = useSession();
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"overview" | "scanner" | "records">("overview");
  const [rows, setRows] = useState<Row[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [modEmail, setModEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // Sync tab with URL search parameter if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "scanner" || tab === "records" || tab === "overview") {
      setActiveTab(tab);
    }
  }, []);

  function switchTab(t: "overview" | "scanner" | "records") {
    setActiveTab(t);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", t);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Ignore if URL modification fails in test environments
    }
  }

  const loadMods = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_moderators");
    if (error) return toast.error(error.message);
    setMods((data ?? []) as Mod[]);
  }, []);

  const loadRows = useCallback(async () => {
    const res = await supabase.from("applications").select("*").order("submitted_at", { ascending: false });
    if (res.error) return toast.error(res.error.message);
    setRows(res.data as Row[]);
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.rpc("my_role").then(async ({ data }) => {
      setRole((data as string) ?? null);
      if (data === "admin") {
        loadRows();
        loadMods();
      }
    });
  }, [session, loadMods, loadRows]);

  async function addMod(e: React.FormEvent) {
    e.preventDefault();
    const email = modEmail.trim();
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.rpc("add_moderator", { p_email: email });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Moderator added");
    setModEmail("");
    loadMods();
  }

  async function removeMod(id: string, email: string) {
    if (!confirm(`Remove ${email} as a moderator?`)) return;
    const { error } = await supabase.rpc("remove_moderator", { p_user_id: id });
    if (error) return toast.error(error.message);
    toast.success("Moderator removed");
    loadMods();
  }

  async function backfillPasses() {
    setBusy(true);
    const { data, error } = await supabase.rpc("backfill_attendee_passes");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Generated passes for ${data} attendee(s)`);
    loadRows();
  }

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const passesIssued = rows.filter((r) => !!r.attendee_id).length;
  const acceptedMissingPasses = rows.filter((r) => r.status === "accepted" && !r.attendee_id).length;
  const checkedInCount = rows.filter((r) => !!r.checked_in_at).length;

  const byCollege = useMemo(() => group(rows, "college"), [rows]);
  const byCity = useMemo(() => group(rows, "city"), [rows]);
  const byYear = useMemo(() => group(rows, "year_of_study"), [rows]);
  const byBranch = useMemo(() => group(rows, "branch"), [rows]);
  const days = useMemo(() => perDay(rows), [rows]);

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Name", "Email", "Phone", "City", "College", "Year", "Branch", "Builder ID", "Attendee ID", "Checked In", "Consent", "Status", "Submitted"];
    const lines = rows.map((r) => [
      r.full_name,
      r.email,
      r.phone,
      r.city,
      r.college,
      r.year_of_study,
      r.branch,
      r.builder_id,
      r.attendee_id ?? "",
      r.checked_in_at ? "Yes" : "No",
      r.consent ? "Yes" : "No",
      r.status,
      r.submitted_at,
    ].map(esc).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "applications.csv"; a.click();
  }

  return (
    <>
      <SiteNav solid />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {role === "admin" ? (
            <div>
              <h1 className="text-2xl font-bold">Admin Portal</h1>
              <p className="text-xs text-slate-400">AWS re:Invent Party Mysore Staff Console</p>
            </div>
          ) : <span />}
          {role === "admin" && activeTab === "overview" && (
            <button onClick={exportCsv} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-white/5">
              Export Registrations CSV
            </button>
          )}
        </div>

        {loading ? <p className="mt-6 text-slate-400">Loading...</p>
          : !session ? <div className="mt-6 max-w-sm rounded-2xl border border-line bg-panel p-6"><OtpLogin title="Sign in" onDone={() => {}} /></div>
          : role === undefined ? <p className="mt-6 text-slate-400">Checking access...</p>
          : role !== "admin" ? <p className="mt-6 text-slate-400">404 – This page could not be found.</p>
          : (
            <>
              {/* Tab Navigation */}
              <div className="mt-6 flex flex-wrap gap-2 border-b border-line pb-3">
                <button
                  type="button"
                  onClick={() => switchTab("overview")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "overview"
                      ? "bg-accent text-white shadow"
                      : "bg-panel text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <span>📊</span> Overview & Staff
                </button>
                <button
                  type="button"
                  onClick={() => switchTab("scanner")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "scanner"
                      ? "bg-accent text-white shadow"
                      : "bg-panel text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <span>📷</span> QR Scanner
                </button>
                <button
                  type="button"
                  onClick={() => switchTab("records")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "records"
                      ? "bg-accent text-white shadow"
                      : "bg-panel text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <span>📋</span> Scan Records
                </button>
              </div>

              {/* TAB 1: OVERVIEW & STAFF */}
              {activeTab === "overview" && (
                <div className="mt-6 space-y-6">
                  <p className="text-sm text-slate-400">Applications are view-only here. Moderators review and decide them.</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                    {[
                      ["Total registrations", rows.length],
                      ["Pending", count("pending")],
                      ["Accepted", count("accepted")],
                      ["Passes Issued", passesIssued],
                      ["Checked In", checkedInCount],
                      ["Rejected", count("rejected")],
                    ].map(([k, v]) => (
                      <div key={k as string} className="rounded-xl border border-line bg-panel p-4">
                        <p className="text-xs text-slate-400">{k}</p>
                        <p className="text-2xl font-bold">{v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Attendee Pass Management Section */}
                  <section className="rounded-xl border border-fuchsia-500/30 bg-panel/80 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-white">Attendee Pass System</h2>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Total passes generated: <span className="font-mono font-bold text-fuchsia-300">{passesIssued}</span>.
                          {acceptedMissingPasses > 0 ? (
                            <span className="ml-1 text-yellow-300">
                              ({acceptedMissingPasses} accepted applicant(s) lack an attendee pass)
                            </span>
                          ) : (
                            <span className="ml-1 text-green-400">All accepted attendees have unique passes.</span>
                          )}
                        </p>
                      </div>
                      {acceptedMissingPasses > 0 && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={backfillPasses}
                          className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                        >
                          {busy ? "Generating..." : `Backfill ${acceptedMissingPasses} Missing Pass(es)`}
                        </button>
                      )}
                    </div>
                  </section>

                  {/* Quick Action to Scanner & Records */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-line bg-panel p-5 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Event Reception Scanner</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Scan attendee badges using camera or barcode reader</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => switchTab("scanner")}
                        className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                      >
                        Open Scanner
                      </button>
                    </div>

                    <div className="rounded-xl border border-line bg-panel p-5 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Check-In Scan Records</h3>
                        <p className="text-xs text-slate-400 mt-0.5">View audit logs, duplicate scan alerts, and check-in history</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => switchTab("records")}
                        className="rounded-lg border border-line bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
                      >
                        View Records
                      </button>
                    </div>
                  </div>

                  {/* Moderators section */}
                  <section className="rounded-xl border border-line bg-panel p-4">
                    <h2 className="text-sm font-semibold">Moderators</h2>
                    <p className="mt-1 text-xs text-slate-400">The person must log in once on the registration page before you can add them.</p>
                    <form onSubmit={addMod} className="mt-3 flex flex-wrap gap-3">
                      <input type="email" required className="min-w-56 flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-sm" placeholder="moderator@email.com" value={modEmail} onChange={(e) => setModEmail(e.target.value)} />
                      <button disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Adding..." : "Add moderator"}</button>
                    </form>
                    <ul className="mt-4 divide-y divide-line text-sm">
                      {mods.map((m) => (
                        <li key={m.user_id} className="flex items-center justify-between py-2">
                          <span>{m.email}</span>
                          <button onClick={() => removeMod(m.user_id, m.email)} className="rounded border border-red-500/50 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10">Remove</button>
                        </li>
                      ))}
                      {mods.length === 0 && <li className="py-2 text-slate-400">No moderators yet.</li>}
                    </ul>
                  </section>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Bars title="Registrations per day (last 14 days)" data={days} />
                    <Bars title="Top colleges" data={byCollege} />
                    <Bars title="Top cities" data={byCity} />
                    <Bars title="Year of study" data={byYear} />
                    <Bars title="Branch" data={byBranch} />
                  </div>
                </div>
              )}

              {/* TAB 2: QR SCANNER */}
              {activeTab === "scanner" && (
                <div className="mt-6">
                  <QrScanner
                    staffEmail={session.user.email}
                    onScanCompleted={() => loadRows()}
                  />
                </div>
              )}

              {/* TAB 3: SCAN RECORDS */}
              {activeTab === "records" && (
                <div className="mt-6">
                  <ScanRecords onGoToScanner={() => switchTab("scanner")} />
                </div>
              )}
            </>
          )}
      </main>
    </>
  );
}