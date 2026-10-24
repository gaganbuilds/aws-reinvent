"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function ModeratorPage() {
  const { session, loading } = useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"review" | "scanner" | "records">("review");
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [previewPass, setPreviewPass] = useState<Row | null>(null);

  // Sync active tab with URL query parameter if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "scanner" || tab === "records" || tab === "review") {
      setActiveTab(tab);
    }
  }, []);

  function switchTab(t: "review" | "scanner" | "records") {
    setActiveTab(t);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", t);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Ignore if URL modification fails in test environments
    }
  }

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("applications").select("*").order("submitted_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows(data as Row[]);
  }, []);

  useEffect(() => {
    if (!session) {
      setAllowed(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("is_moderator");
        if (cancelled) return;
        if (error || !data) {
          setAllowed(false);
        } else {
          setAllowed(true);
          load();
        }
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session, load]);

  async function decide(id: string, decision: "accepted" | "rejected") {
    const { error } = await supabase.rpc("review_application", { app_id: id, new_status: decision, note: null });
    if (error) return toast.error(error.message);
    toast.success(`Marked ${decision}`);
    load();
  }

  async function generatePass(appId: string) {
    const { data, error } = await supabase.rpc("generate_missing_pass", { app_id: appId });
    if (error) return toast.error(error.message);
    toast.success(`Pass generated: ${data}`);
    load();
  }

  const shown = useMemo(() => rows.filter((r) =>
    (filter === "all" || r.status === filter) &&
    (!q || `${r.full_name} ${r.email} ${r.phone ?? ""} ${r.city ?? ""} ${r.college ?? ""} ${r.builder_id} ${r.attendee_id ?? ""}`.toLowerCase().includes(q.toLowerCase()))), [rows, filter, q]);

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Name", "Email", "Phone", "City", "College", "Year", "Branch", "Builder ID", "Attendee ID", "Checked In", "Consent", "Status", "Submitted"];
    const lines = shown.map((r) => [
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

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const passesIssued = rows.filter((r) => !!r.attendee_id).length;
  const checkedInCount = rows.filter((r) => !!r.checked_in_at).length;

  const toReview = shown.filter((r) => r.status === "pending");
  const reviewed = shown.filter((r) => r.status !== "pending");

  const renderRow = (r: Row) => (
    <tr key={r.id}>
      <td className="px-4 py-3 font-medium text-white">{r.full_name}</td>
      <td className="px-4 py-3 text-slate-300">{r.email}</td>
      <td className="px-4 py-3">{r.phone}</td>
      <td className="px-4 py-3">{r.city}</td>
      <td className="px-4 py-3">{r.college}</td>
      <td className="px-4 py-3">{r.year_of_study}</td>
      <td className="px-4 py-3">{r.branch}</td>
      <td className="px-4 py-3 font-mono text-xs">{r.builder_id}</td>
      <td className={`px-4 py-3 font-semibold capitalize ${r.status === "accepted" ? "text-green-400" : r.status === "rejected" ? "text-red-400" : "text-yellow-300"}`}>
        {r.status}
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
      <td className="px-4 py-3 whitespace-nowrap">
        {r.checked_in_at ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-400">
            ✓ In
          </span>
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}
      </td>
      <td className="space-x-2 px-4 py-3 whitespace-nowrap">
        <button disabled={r.status === "accepted"} onClick={() => decide(r.id, "accepted")} className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-30">Accept</button>
        <button disabled={r.status === "rejected"} onClick={() => decide(r.id, "rejected")} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-30">Reject</button>
      </td>
    </tr>
  );

  return (
    <>
      <SiteNav solid />
      <main className="mx-auto max-w-7xl px-5 py-10">
        {allowed ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Moderator Console</h1>
              <p className="text-xs text-slate-400">Application reviews, QR pass scanner, and check-in audit logs</p>
            </div>
            {activeTab === "review" && (
              <button onClick={exportCsv} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-white/5">
                Export Applications CSV
              </button>
            )}
          </div>
        ) : <span />}

        {loading ? <p className="mt-6 text-slate-400">Loading...</p>
          : !session ? <div className="mt-6 max-w-sm rounded-2xl border border-line bg-panel p-6"><OtpLogin title="Sign in" onDone={() => {}} /></div>
          : allowed === null ? <p className="mt-6 text-slate-400">Checking access...</p>
          : !allowed ? <p className="mt-6 text-slate-400">404 – This page could not be found.</p>
          : (
            <>
              {/* Tab Navigation */}
              <div className="mt-6 flex flex-wrap gap-2 border-b border-line pb-3">
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

              {/* TAB 1: APPLICATIONS REVIEW */}
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
                          {["Name", "Email", "Phone", "City", "College", "Year", "Branch", "Builder ID", "Status", "Pass / QR", "Checked In", "Actions"].map((h) => (
                            <th key={h} className="px-4 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {toReview.length > 0 && <tr><td colSpan={12} className="bg-panel px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">To review ({toReview.length})</td></tr>}
                        {toReview.map(renderRow)}
                        {reviewed.length > 0 && <tr><td colSpan={12} className="border-t-2 border-accent bg-panel px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Already reviewed ({reviewed.length})</td></tr>}
                        {reviewed.map(renderRow)}
                        {shown.length === 0 && <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">No applications.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: QR SCANNER */}
              {activeTab === "scanner" && (
                <div className="mt-6">
                  <QrScanner
                    staffEmail={session.user.email}
                    onScanCompleted={() => load()}
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
      </main>
    </>
  );
}