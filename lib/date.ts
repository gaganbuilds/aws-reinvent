/**
 * Date and Time utilities for Mysore re:Invent Party (Asia/Kolkata timezone)
 */

export function formatIST(dateStr: string | number | Date | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "string" || typeof dateStr === "number" ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return String(dateStr);

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(d) + " IST";
  } catch {
    return String(dateStr);
  }
}

export function formatISTDateOnly(dateStr: string | number | Date | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "string" || typeof dateStr === "number" ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return String(dateStr);

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return String(dateStr);
  }
}

export function isTodayIST(dateStr: string | number | Date | null | undefined): boolean {
  if (!dateStr) return false;
  try {
    const d = typeof dateStr === "string" || typeof dateStr === "number" ? new Date(dateStr) : dateStr;
    const now = new Date();

    const dIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
    const nowIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

    return dIST === nowIST;
  } catch {
    return false;
  }
}
