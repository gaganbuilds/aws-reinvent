"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { formatIST, isTodayIST } from "@/lib/date";

export type ScanRecord = {
  event_id: string;
  scanned_at: string;
  scan_result: "checked_in" | "duplicate" | "invalid_qr" | "not_approved" | "error" | string;
  failure_reason: string | null;
  raw_payload_hash: string | null;
  scanner_user_id: string | null;
  scanner_email: string | null;
  attendee_id: string | null;
  applicant_id: string | null;
  full_name: string | null;
  email: string | null;
  builder_id: string | null;
  college: string | null;
  application_status: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  checked_in_by_email: string | null;
};

type CheckInStats = {
  total_registrations: number;
  accepted_count: number;
  unique_checked_in: number;
  total_scans: number;
  successful_scans: number;
  duplicate_scans: number;
  invalid_scans: number;
  not_approved_scans: number;
};

interface ScanRecordsProps {
  onGoToScanner?: () => void;
}

export default function ScanRecords({ onGoToScanner }: ScanRecordsProps) {
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [stats, setStats] = useState<CheckInStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const [checkInStatusFilter, setCheckInStatusFilter] = useState("all");
  const [scannerFilter, setScannerFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);

      const [recordsRes, statsRes] = await Promise.all([
        supabase.rpc("list_scan_events", { p_limit: 1000 }),
        supabase.rpc("get_checkin_stats"),
      ]);

      if (recordsRes.error) {
        // Fallback: If list_scan_events RPC is missing or fails, query attendee_scan_events directly
        const fallbackRes = await supabase
          .from("attendee_scan_events")
          .select("*")
          .order("scanned_at", { ascending: false })
          .limit(1000);

        if (fallbackRes.error) {
          toast.error("Could not load scan records: " + fallbackRes.error.message);
        } else {
          setRecords((fallbackRes.data as ScanRecord[]) || []);
        }
      } else {
        setRecords((recordsRes.data as ScanRecord[]) || []);
      }

      if (statsRes.data) {
        setStats(statsRes.data as CheckInStats);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load scan records";
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unique list of staff emails for dropdown
  const uniqueScanners = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.scanner_email) set.add(r.scanner_email);
    });
    return Array.from(set).sort();
  }, [records]);

  // Filtered rows
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // 1. Result filter
      if (resultFilter !== "all" && r.scan_result !== resultFilter) {
        return false;
      }

      // 2. Checked-in status filter
      if (checkInStatusFilter === "checked_in" && !r.checked_in_at) {
        return false;
      }
      if (checkInStatusFilter === "not_checked_in" && r.checked_in_at) {
        return false;
      }

      // 3. Scanner staff filter
      if (scannerFilter !== "all" && r.scanner_email !== scannerFilter) {
        return false;
      }

      // 4. Date filter (today in Asia/Kolkata)
      if (dateFilter === "today" && !isTodayIST(r.scanned_at)) {
        return false;
      }

      // 5. Search query matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const haystack = [
          r.full_name,
          r.email,
          r.attendee_id,
          r.builder_id,
          r.college,
          r.scanner_email,
          r.failure_reason,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [records, resultFilter, checkInStatusFilter, scannerFilter, dateFilter, searchQuery]);

  // Export CSV function with RFC 4180 escaping
  function exportCsv() {
    if (filteredRecords.length === 0) {
      toast.warning("No records to export.");
      return;
    }

    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "Scan Timestamp (IST)",
      "Scan Result",
      "Attendee Name",
      "Attendee ID",
      "Email Address",
      "AWS Builder ID",
      "College / Organisation",
      "Application Status",
      "Checked-In At (IST)",
      "Checked-In By Staff",
      "Scanned By Staff",
      "Failure / Warning Reason",
      "Scan Event ID",
    ];

    const rows = filteredRecords.map((r) =>
      [
        formatIST(r.scanned_at),
        r.scan_result,
        r.full_name || "—",
        r.attendee_id || "—",
        r.email || "—",
        r.builder_id || "—",
        r.college || "—",
        r.application_status || "—",
        r.checked_in_at ? formatIST(r.checked_in_at) : "No",
        r.checked_in_by_email || (r.checked_in_by ? String(r.checked_in_by) : "—"),
        r.scanner_email || (r.scanner_user_id ? String(r.scanner_user_id) : "—"),
        r.failure_reason || "—",
        r.event_id,
      ]
        .map(esc)
        .join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mysore-reinvent-scan-records-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredRecords.length} scan records to CSV`);
  }

  // Badges for scan results
  const renderResultBadge = (result: string) => {
    switch (result) {
      case "checked_in":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-semibold text-green-300 ring-1 ring-green-500/40">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Checked In
          </span>
        );
      case "duplicate":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Duplicate
          </span>
        );
      case "not_approved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-semibold text-purple-300 ring-1 ring-purple-500/40">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            Not Approved
          </span>
        );
      case "invalid_qr":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/40">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Invalid QR
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-500/20 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
            {result}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📋</span> Scan Records & Attendee Check-In History
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Audit log of all entry badge scans, duplicate warnings, and check-in verifications
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            title="Refresh scan records from database"
          >
            <span className={`text-sm ${refreshing ? "animate-spin" : ""}`}>🔄</span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredRecords.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            <span>📥</span> Export CSV ({filteredRecords.length})
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <p className="text-xs font-semibold text-green-300 uppercase tracking-wider">
            Unique Checked In
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white">
              {stats?.unique_checked_in ?? records.filter((r) => r.scan_result === "checked_in").length}
            </span>
            {stats && stats.accepted_count > 0 && (
              <span className="text-xs text-green-400">
                / {stats.accepted_count} (
                {Math.round((stats.unique_checked_in / stats.accepted_count) * 100)}%)
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Total Scans</p>
          <p className="mt-1 text-2xl font-extrabold text-white">
            {stats?.total_scans ?? records.length}
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
            Duplicate Attempts
          </p>
          <p className="mt-1 text-2xl font-extrabold text-amber-300">
            {stats?.duplicate_scans ?? records.filter((r) => r.scan_result === "duplicate").length}
          </p>
        </div>

        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
          <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
            Not Approved
          </p>
          <p className="mt-1 text-2xl font-extrabold text-purple-300">
            {stats?.not_approved_scans ?? records.filter((r) => r.scan_result === "not_approved").length}
          </p>
        </div>

        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-xs font-semibold text-red-300 uppercase tracking-wider">
            Invalid QRs
          </p>
          <p className="mt-1 text-2xl font-extrabold text-red-300">
            {stats?.invalid_scans ?? records.filter((r) => r.scan_result === "invalid_qr").length}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-line bg-panel p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          {/* Text Search */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search name, email, Attendee ID, Builder ID, college..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-line bg-ink px-3.5 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent"
            />
          </div>

          {/* Scan Result Filter */}
          <div>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-xs text-white outline-none focus:border-accent"
            >
              <option value="all">All Scan Results</option>
              <option value="checked_in">Checked In Only</option>
              <option value="duplicate">Duplicate Warnings</option>
              <option value="not_approved">Not Approved</option>
              <option value="invalid_qr">Invalid QR Codes</option>
            </select>
          </div>

          {/* Checked-In Status Filter */}
          <div>
            <select
              value={checkInStatusFilter}
              onChange={(e) => setCheckInStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-xs text-white outline-none focus:border-accent"
            >
              <option value="all">All Check-In States</option>
              <option value="checked_in">Currently Checked In</option>
              <option value="not_checked_in">Not Checked In</option>
            </select>
          </div>

          {/* Staff Scanner Filter */}
          <div>
            <select
              value={scannerFilter}
              onChange={(e) => setScannerFilter(e.target.value)}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-xs text-white outline-none focus:border-accent"
            >
              <option value="all">All Staff Scanners</option>
              {uniqueScanners.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filter Quick Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-t border-white/5 pt-3">
          <div className="flex items-center gap-2">
            <span>Date Filter:</span>
            <button
              type="button"
              onClick={() => setDateFilter("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                dateFilter === "all" ? "bg-accent text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("today")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                dateFilter === "today" ? "bg-accent text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              Today (Mysore IST)
            </button>
          </div>

          <span>
            Showing <strong className="text-white">{filteredRecords.length}</strong> of{" "}
            {records.length} records
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-xs">
          <thead className="bg-panel uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Scan Time (IST)</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Attendee ID</th>
              <th className="px-4 py-3">Attendee Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Builder ID</th>
              <th className="px-4 py-3">College / Organisation</th>
              <th className="px-4 py-3">First Check-in Time</th>
              <th className="px-4 py-3">Scanned By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    <span>Loading scan records...</span>
                  </div>
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-300">No scan records match the current filters.</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try adjusting your search query or filters above.
                  </p>
                  {onGoToScanner && (
                    <button
                      type="button"
                      onClick={onGoToScanner}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
                    >
                      📷 Open Scanner
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => (
                <tr key={r.event_id} className="transition hover:bg-white/[0.02]">
                  {/* Scanned Timestamp */}
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-300">
                    {formatIST(r.scanned_at)}
                  </td>

                  {/* Result Badge */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div>
                      {renderResultBadge(r.scan_result)}
                      {r.failure_reason && (
                        <p className="mt-1 text-[11px] text-slate-400 max-w-[200px] truncate" title={r.failure_reason}>
                          {r.failure_reason}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Attendee ID */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.attendee_id ? (
                      <span className="rounded border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 font-mono text-xs font-bold text-fuchsia-300">
                        {r.attendee_id}
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-slate-500">—</span>
                    )}
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                    {r.full_name || "—"}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {r.email || "—"}
                  </td>

                  {/* Builder ID */}
                  <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                    {r.builder_id || "—"}
                  </td>

                  {/* College */}
                  <td className="px-4 py-3 text-slate-300">
                    {r.college || "—"}
                  </td>

                  {/* Authoritative Check-In Timestamp */}
                  <td className="px-4 py-3 whitespace-nowrap font-mono">
                    {r.checked_in_at ? (
                      <span className="text-green-300" title={`Checked in by ${r.checked_in_by_email || r.checked_in_by || "staff"}`}>
                        ✓ {formatIST(r.checked_in_at)}
                      </span>
                    ) : (
                      <span className="text-slate-500">Not Checked In</span>
                    )}
                  </td>

                  {/* Scanned By Staff */}
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    <span className="truncate max-w-[150px] inline-block" title={r.scanner_email || r.scanner_user_id || ""}>
                      {r.scanner_email || (r.scanner_user_id ? r.scanner_user_id.slice(0, 8) + "..." : "Staff")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
