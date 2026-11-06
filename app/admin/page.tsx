"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
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
  const [activeTab, setActiveTab] = useState<"overview" | "review" | "scanner" | "records">("overview");
  const [rows, setRows] = useState<Row[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [modEmail, setModEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [previewPass, setPreviewPass] = useState<Row | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  // Sync tab with URL search parameter if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "scanner" || tab === "records" || tab === "overview" || tab === "review") {
      setActiveTab(tab);
    }
  }, []);

  function switchTab(t: "overview" | "review" | "scanner" | "records") {
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

  async function decide(id: string, decision: "accepted" | "rejected") {
    if (decidingId) return;
    setDecidingId(id);
    try {
      console.log(`[Admin] Calling review_application: app_id=${id}, new_status=${decision}`);
      const { error } = await supabase.rpc("review_application", { app_id: id, new_status: decision, note: null });
      if (error) {
        console.error("[Admin] review_application error:", error);
        toast.error(`Action failed: ${error.message || `Failed to mark ${decision}`}`, { duration: 7000 });
        return;
      }
      toast.success(decision === "accepted" ? "Application approved & pass generated!" : "Application rejected");
      await loadRows();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error during review";
      console.error("[Admin] Unexpected error:", err);
      toast.error(msg, { duration: 7000 });
    } finally {
      setDecidingId(null);
    }
  }

  async function generatePass(appId: string) {
    const { data, error } = await supabase.rpc("generate_missing_pass", { app_id: appId });
    if (error) return toast.error(error.message);
    toast.success(`Pass generated: ${data}`);
    loadRows();
  }

  useEffect(() => {
    if (!session) {
      setRole(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("my_role");
        if (cancelled) return;
        if (error || !data) {
          setRole(null);
          return;
        }
        const userRole = (data as string) ?? null;
        setRole(userRole);
        if (userRole === "admin") {
          loadRows();
          loadMods();
        }
      } catch {
        if (!cancelled) setRole(null);
      }
    })();
    return () => { cancelled = true; };
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

  const shown = useMemo(() => rows.filter((r) =>
    (filter === "all" || r.status === filter) &&
    (!q || `${r.full_name} ${r.email} ${r.phone ?? ""} ${r.city ?? ""} ${r.college ?? ""} ${r.builder_id} ${r.attendee_id ?? ""}`.toLowerCase().includes(q.toLowerCase()))), [rows, filter, q]);

  const toReview = shown.filter((r) => r.status === "pending");
  const reviewed = shown.filter((r) => r.status !== "pending");

  const renderRow = (r: Row) => (
    <tr key={r.id} className="hover:bg-white/[0.02] transition">
      <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
        <div>{r.full_name}</div>
        <div className="text-xs text-slate-400 font-normal">{r.email}</div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold capitalize ${
          r.status === "accepted" ? "bg-green-500/20 text-green-300 border border-green-500/30"
          : r.status === "rejected" ? "bg-red-500/20 text-red-300 border border-red-500/30"
          : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
        }`}>
          {r.status}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {r.status === "accepted" ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-green-500/20 px-2 py-0.5 text-xs font-bold text-green-300 border border-green-500/30">
              ✓ Approved
            </span>
            <button
              type="button"
              disabled={decidingId === r.id}
              onClick={() => decide(r.id, "rejected")}
              className="text-xs text-red-400 hover:text-red-300 hover:underline"
              title="Change to Rejected"
            >
              Reject
            </button>
          </div>
        ) : r.status === "rejected" ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={decidingId === r.id}
              onClick={() => decide(r.id, "accepted")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-green-500 hover:brightness-110 active:scale-95 transition cursor-pointer"
            >
              {decidingId === r.id ? "Saving..." : "✓ Approve / Accept"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={decidingId === r.id}
              onClick={() => decide(r.id, "accepted")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-green-500 hover:brightness-110 active:scale-95 transition cursor-pointer"
            >
              {decidingId === r.id ? "Saving..." : "✓ Accept / Approve"}
            </button>
            <button
              type="button"
              disabled={decidingId === r.id}
              onClick={() => decide(r.id, "rejected")}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600/80 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-red-600 transition cursor-pointer"
            >
              ✕ Reject
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {r.status === "accepted" ? (
          r.attendee_id ? (
            <div className="flex items-center gap-1.5">
              <span className="rounded border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 font-mono text-xs font-bold text-fuchsia-300">
                {r.attendee_id}
              </span>
              <button
                type="button"
                onClick={() => setPreviewPass(r)}
                className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white"
                title="Preview Attendee Pass QR"
              >
                QR
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => generatePass(r.id)}
              className="rounded bg-yellow-500/20 px-2.5 py-0.5 text-xs font-semibold text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/30"
              title="Click to generate missing pass for accepted applicant"
            >
              + Generate Pass
            </button>
          )
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">{r.phone || "—"}</td>
      <td className="px-4 py-3">{r.college || "—"}</td>
      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{r.builder_id}</td>
      <td className="px-4 py-3 whitespace-nowrap">{r.year_of_study || "—"} {r.branch ? `(${r.branch})` : ""}</td>
      <td className="px-4 py-3 whitespace-nowrap">{r.city || "—"}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        {r.checked_in_at ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-400">
            ✓ In
          </span>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}
      </td>
    </tr>
  );

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
                  onClick={() => switchTab("review")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "review"
                      ? "bg-accent text-white shadow"
                      : "bg-panel text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <span>📝</span> Review Applications ({count("pending")})
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
                  {/* Action card for Application Review & Approvals */}
                  <div className="rounded-xl border border-line bg-panel p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Application Review & Approvals</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {count("pending") > 0 ? (
                          <span className="text-yellow-300 font-medium">{count("pending")} registration(s) pending review.</span>
                        ) : (
                          "All registrations have been reviewed."
                        )}{" "}
                        Review applicant details, approve admissions, and issue attendee QR passes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchTab("review")}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:brightness-110 transition shadow cursor-pointer"
                    >
                      <span>📝</span> Open Review Console {count("pending") > 0 && `(${count("pending")})`}
                    </button>
                  </div>
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

              {/* TAB 2: APPLICATIONS REVIEW */}
              {activeTab === "review" && (
                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {[
                      ["Total Applications", rows.length],
                      ["Pending Review", count("pending")],
                      ["Accepted", count("accepted")],
                      ["Passes Issued", passesIssued],
                      ["Checked In", checkedInCount],
                    ].map(([k, v]) => (
                      <div key={k as string} className="rounded-xl border border-line bg-panel p-4">
                        <p className="text-xs text-slate-400">{k}</p>
                        <p className="text-2xl font-bold">{v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <select className="rounded-lg border border-line bg-ink px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <input className="min-w-56 flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-sm" placeholder="Search name, email, phone, city, college, Builder ID, Attendee ID" value={q} onChange={(e) => setQ(e.target.value)} />
                    <button onClick={exportCsv} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-white/5">Export CSV</button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-line">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-panel text-xs uppercase text-slate-400">
                        <tr>
                          {["Applicant", "Status", "Review Actions", "Pass / QR", "Phone", "College", "Builder ID", "Year & Branch", "City", "Checked In"].map((h) => (
                            <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {toReview.length > 0 && <tr><td colSpan={10} className="bg-panel px-4 py-2 text-xs font-semibold uppercase tracking-wide text-yellow-300">To review ({toReview.length})</td></tr>}
                        {toReview.map(renderRow)}
                        {reviewed.length > 0 && <tr><td colSpan={10} className="border-t-2 border-accent bg-panel px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Already reviewed ({reviewed.length})</td></tr>}
                        {reviewed.map(renderRow)}
                        {shown.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No applications.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: QR SCANNER */}
              {activeTab === "scanner" && (
                <div className="mt-6">
                  <QrScanner
                    staffEmail={session.user.email}
                    onScanCompleted={() => loadRows()}
                  />
                </div>
              )}

              {/* TAB 4: SCAN RECORDS */}
              {activeTab === "records" && (
                <div className="mt-6">
                  <ScanRecords onGoToScanner={() => switchTab("scanner")} />
                </div>
              )}

              {/* Modal for previewing Attendee Pass & QR */}
              {previewPass && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                  <div className="w-full max-w-sm rounded-2xl border border-fuchsia-500/30 bg-[#0d0f14] p-6 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <h3 className="font-semibold text-white">Attendee Pass Preview</h3>
                        <p className="text-xs text-slate-400">{previewPass.full_name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewPass(null)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-5 flex flex-col items-center text-center">
                      <div className="rounded-xl border border-white/20 bg-white p-3.5 shadow-md">
                        <QRCodeSVG value={previewPass.attendee_id || ""} size={160} level="H" />
                      </div>
                      <div className="mt-4 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 font-mono text-base font-bold text-fuchsia-300">
                        {previewPass.attendee_id}
                      </div>
                      <div className="mt-4 space-y-1 text-xs">
                        <p className="font-semibold text-white">{previewPass.full_name}</p>
                        <p className="font-mono text-slate-400">{previewPass.builder_id}</p>
                        {previewPass.college && <p className="text-slate-400">{previewPass.college}</p>}
                        {previewPass.checked_in_at && (
                          <p className="text-green-400 font-semibold pt-1">
                            Checked In: Yes
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setPreviewPass(null)}
                        className="w-full rounded-lg bg-white/10 py-2 text-xs font-semibold text-white hover:bg-white/20"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
      </main>
    </>
  );
}