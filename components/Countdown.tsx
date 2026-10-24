"use client";
import { useEffect, useState } from "react";

export default function Countdown({ iso }: { iso: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    const f = () => setLeft(t - Date.now());
    f();
    const id = setInterval(f, 30000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso || left === null || left <= 0) return null;
  const d = Math.floor(left / 864e5), h = Math.floor((left % 864e5) / 36e5), m = Math.floor((left % 36e5) / 6e4);
  return (
    <div className="mt-6 flex gap-3">
      {[["Days", d], ["Hours", h], ["Minutes", m]].map(([l, v]) => (
        <div key={l as string} className="w-20 rounded-xl bg-white/10 py-3 text-center backdrop-blur">
          <p className="text-2xl font-semibold">{v}</p><p className="text-[11px] uppercase tracking-wider text-slate-300">{l}</p>
        </div>
      ))}
    </div>
  );
}
