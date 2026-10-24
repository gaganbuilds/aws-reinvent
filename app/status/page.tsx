"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import OtpLogin from "@/components/OtpLogin";
import { useSession } from "@/components/useSession";
import { supabase } from "@/lib/supabase";

import AttendeePass from "@/components/AttendeePass";

type App = {
  full_name: string;
  builder_id: string;
  college: string | null;
  status: "pending" | "accepted" | "rejected";
  submitted_at: string;
  attendee_id: string | null;
  checked_in_at?: string | null;
};

export default function StatusPage() {
  const { session, loading } = useSession();
  const [app, setApp] = useState<App | null | undefined>(undefined);
  const [wa, setWa] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("applications")
      .select("full_name,builder_id,college,status,submitted_at,attendee_id,checked_in_at")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setApp((data as App) ?? null));
    // Returns the link only when this user's application is accepted.
    supabase.rpc("get_whatsapp_link").then(({ data }) => setWa((data as string) || null));
  }, [session]);

  const label = { pending: "Awaiting confirmation", accepted: "Confirmed", rejected: "Not selected" };
  const badge = { pending: "bg-yellow-500/20 text-yellow-300", accepted: "bg-green-500/20 text-green-300", rejected: "bg-red-500/20 text-red-300" };

  return (
    <>
      <SiteNav solid />
      <main className="mx-auto max-w-2xl px-5 py-12">
        <div className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
          <div className="no-print flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <h1 className="text-2xl font-bold">Registration Status</h1>
            {app && (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${badge[app.status]}`}>
                {label[app.status]}
              </span>
            )}
          </div>

          {loading ? (
            <p className="mt-6 text-slate-400">Loading...</p>
          ) : !session ? (
            <div className="mt-4">
              <OtpLogin title="Sign in to see your status" onDone={() => {}} />
            </div>
          ) : app === undefined ? (
            <p className="mt-6 text-slate-400">Loading your details...</p>
          ) : app === null ? (
            <div className="mt-6 space-y-3">
              <p className="text-slate-300">No registration found for this account.</p>
              <Link href="/register" className="inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
                Register now
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {/* STATUS: ACCEPTED */}
              {app.status === "accepted" && (
                <>
                  {app.attendee_id ? (
                    <AttendeePass
                      app={{
                        full_name: app.full_name,
                        builder_id: app.builder_id,
                        college: app.college,
                        attendee_id: app.attendee_id,
                        status: app.status,
                        checked_in_at: app.checked_in_at,
                      }}
                    />
                  ) : (
                    <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-5 text-sm">
                      <p className="font-semibold text-yellow-300">Seat Confirmed 🎉</p>
                      <p className="mt-1 text-slate-300">
                        Your attendee pass is being generated. If it does not appear within a moment, please refresh the page.
                      </p>
                    </div>
                  )}

                  {/* WhatsApp Community Invitation */}
                  <div className="no-print rounded-xl border border-green-500/40 bg-green-500/10 p-5">
                    <p className="font-semibold text-green-300">Mysore Community Group</p>
                    <p className="mt-1 text-xs text-slate-300">
                      Join the private WhatsApp group to connect with organizers, speakers, and fellow builders.
                    </p>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
                      >
                        💬 Join the WhatsApp Group
                      </a>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">
                        WhatsApp invitation link will be available soon.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* STATUS: PENDING */}
              {app.status === "pending" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                    <p className="font-semibold text-yellow-300">Application Under Review</p>
                    <p className="mt-1 text-sm text-slate-300">
                      We're reviewing applications in batches. Once confirmed, your unique QR attendee pass will be issued here.
                    </p>
                  </div>
                  <dl className="grid gap-3 text-sm rounded-xl border border-line bg-ink/60 p-4">
                    <div>
                      <dt className="text-xs text-slate-400">Applicant Name</dt>
                      <dd className="font-semibold text-white">{app.full_name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">AWS Builder ID</dt>
                      <dd className="font-mono text-slate-300">{app.builder_id}</dd>
                    </div>
                    {app.college && (
                      <div>
                        <dt className="text-xs text-slate-400">College / Organisation</dt>
                        <dd className="text-slate-300">{app.college}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* STATUS: REJECTED */}
              {app.status === "rejected" && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm">
                  <p className="font-semibold text-red-300">Registration Update</p>
                  <p className="mt-1 text-slate-300">
                    Thank you for your interest. Due to limited venue capacity, we were unable to allocate a seat for this edition.
                  </p>
                </div>
              )}

              {/* Sign out */}
              <div className="no-print border-t border-white/10 pt-4">
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-white underline transition"
                  onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

