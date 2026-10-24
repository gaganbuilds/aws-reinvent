"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import { useSession } from "./useSession";
import { supabase } from "@/lib/supabase";

const MENU: [string, string][] = [["About", "/#about"], ["Agenda", "/#agenda"], ["Entry", "/#pass"], ["FAQ", "/#faq"], ["My status", "/status"]];

export default function SiteNav({ solid = false }: { solid?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const { session } = useSession();
  const email = session?.user?.email ?? "";

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 40);
    f(); window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  useEffect(() => {
    if (!session) { setRole(null); return; }
    supabase.rpc("my_role").then(({ data }) => setRole((data as string) ?? null));
  }, [session]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const bg = solid || scrolled ? "bg-[#0d0f14]/90 backdrop-blur-md border-b border-white/10" : "bg-transparent";
  const item = "block px-4 py-2 text-slate-200 hover:bg-white/10";
  return (
    <header className={`${solid ? "sticky" : "fixed"} inset-x-0 top-0 z-50 transition-colors duration-300 ${bg}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" aria-label="re:Invent home"><Logo /></Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-6">
          <Link href="/#plan" className="hidden text-slate-200 hover:text-white lg:block">Plan your visit</Link>
          <Link href="/#agenda" className="hidden text-slate-200 hover:text-white lg:block">Agenda</Link>
          <div className="relative">
            <button onClick={() => { setMenu(!menu); setProfile(false); }} className="flex items-center gap-1 text-slate-200 hover:text-white" aria-expanded={menu}>
              Menu <span className={`text-xs transition ${menu ? "rotate-180" : ""}`}>▾</span>
            </button>
            {menu && (
              <div className="absolute right-0 mt-3 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0d0f14] py-2 shadow-2xl">
                {MENU.map(([l, h]) => <Link key={l} href={h} onClick={() => setMenu(false)} className={item}>{l}</Link>)}
              </div>
            )}
          </div>
          {session ? (
            <div className="relative">
              <button onClick={() => { setProfile(!profile); setMenu(false); }} aria-label="Profile" aria-expanded={profile}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 font-semibold uppercase text-white ring-1 ring-white/25 hover:ring-white/60">
                {email.charAt(0) || "?"}
              </button>
              {profile && (
                <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#0d0f14] py-2 shadow-2xl">
                  <div className="border-b border-white/10 px-4 pb-3 pt-1">
                    <p className="text-xs text-slate-400">Signed in as</p>
                    <p className="truncate text-sm text-white">{email}</p>
                    {role && <p className="mt-1 text-xs capitalize text-slate-400">Role: {role}</p>}
                  </div>
                  <Link href="/status" onClick={() => setProfile(false)} className={item}>My status</Link>
                  {role === "admin" && (
                    <>
                      <Link href="/admin" onClick={() => setProfile(false)} className={item}>Admin dashboard</Link>
                      <Link href="/admin?tab=scanner" onClick={() => setProfile(false)} className={item}>📷 QR Scanner</Link>
                      <Link href="/admin?tab=records" onClick={() => setProfile(false)} className={item}>📋 Scan Records</Link>
                    </>
                  )}
                  {role === "moderator" && (
                    <>
                      <Link href="/moderator" onClick={() => setProfile(false)} className={item}>Moderator console</Link>
                      <Link href="/moderator?tab=scanner" onClick={() => setProfile(false)} className={item}>📷 QR Scanner</Link>
                      <Link href="/moderator?tab=records" onClick={() => setProfile(false)} className={item}>📋 Scan Records</Link>
                    </>
                  )}
                  <button onClick={logout} className="block w-full px-4 py-2 text-left text-red-300 hover:bg-white/10">Log out</button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/status" className="hidden text-slate-200 hover:text-white sm:block">Log in</Link>
          )}
          <Link href="/register" className="rounded-full bg-[#02040c] px-5 py-2.5 font-semibold ring-1 ring-white/25 transition hover:ring-white/60">Register now</Link>
        </nav>
      </div>
    </header>
  );
}