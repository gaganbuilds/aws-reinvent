"use client";
import { useState } from "react";
import Photo from "./Photo";
import { BUILD_ITEMS, IMG, LEAD_ITEMS, TESTIMONIALS } from "@/lib/config";

export function TestimonialCarousel() {
  const [i, setI] = useState(0);
  const n = TESTIMONIALS.length;
  const t = TESTIMONIALS[i];
  return (
    <div>
      <blockquote className="max-w-4xl text-2xl font-medium leading-snug sm:text-3xl">“{t.quote}”</blockquote>
      <p className="mt-6 text-sm">{t.author}</p>
      <div className="mt-8 inline-flex items-center gap-4 rounded-full bg-white/10 px-4 py-3 text-sm">
        <button aria-label="Previous" onClick={() => setI((i - 1 + n) % n)}>‹</button>
        <span className="font-semibold">{i + 1} / {n}</span>
        <button aria-label="Next" onClick={() => setI((i + 1) % n)}>›</button>
      </div>
    </div>
  );
}

export function DayTabs() {
  const [tab, setTab] = useState<"build" | "lead">("build");
  const items = tab === "build" ? BUILD_ITEMS : LEAD_ITEMS;
  return (
    <div>
      <div className="inline-flex rounded-full border border-white/20 p-1 text-sm font-medium">
        {([["build", "For those who build and implement"], ["lead", "For those who lead and strategize"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-5 py-3 ${tab === k ? "bg-gradient-to-r from-indigo-950 to-fuchsia-900" : "text-slate-300"}`}>{label}</button>
        ))}
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div>
          <h3 className="text-3xl font-semibold">{tab === "build" ? "For those who build and implement" : "For those who lead and strategize"}</h3>
          <p className="mt-6 text-sm leading-relaxed text-slate-200">
            {tab === "build"
              ? "Your day moves fast. A new service launches, and you're immediately hands-on with it. You join a debate and solve the architecture problem you've been wrestling with for weeks. You sit down with the engineers who built the services you rely on and walk away with the answers you need to move forward."
              : "Your day is about direction. You hear where cloud and AI are heading, learn how others made the hard calls, and compare notes with peers facing the same decisions."}
          </p>
          <div className="mt-6 space-y-5 text-sm">
            {items.map(([h, b]) => (
              <div key={h}><p className="font-semibold uppercase">{h}</p><p className="text-slate-300">{b}</p></div>
            ))}
          </div>
        </div>
        <Photo src={tab === "build" ? IMG.dayBuild : IMG.dayLead} alt="Attendees at a session" className="h-72 w-full rounded-xl lg:h-80" />
      </div>
    </div>
  );
}

const INTERESTS = {
  "Getting hands-on": [
    ["Deploy, test, and build", "Workshops and builders' sessions where you can work alongside experts in live environments.", IMG.interest1],
    ["Ask the experts", "Small group conversations designed to get you answers. Find chalk talks and code talks where the people who build the services answer your questions.", IMG.interest2],
  ],
  "Learning the latest": [
    ["Keynote highlights", "Catch the biggest announcements together, as they happen.", IMG.interest1],
    ["Cloud and AI topics", "Generative AI, machine learning, serverless, security and developer productivity.", IMG.interest2],
  ],
  "Meeting people": [
    ["Builder community", "Meet students, developers and cloud practitioners from across Mysore.", IMG.interest1],
    ["Stay connected", "Keep in touch with fellow attendees long after the event.", IMG.interest2],
  ],
} as const;

export function InterestPicker() {
  const keys = Object.keys(INTERESTS) as (keyof typeof INTERESTS)[];
  const [k, setK] = useState<keyof typeof INTERESTS>(keys[0]);
  return (
    <div>
      <h2 className="text-3xl font-semibold">
        I'm interested in{" "}
        <select value={k} onChange={(e) => setK(e.target.value as keyof typeof INTERESTS)}
          className="cursor-pointer rounded bg-transparent text-fuchsia-400 underline decoration-fuchsia-500 underline-offset-8 outline-none">
          {keys.map((x) => <option key={x} value={x} className="bg-ink text-white">{x}</option>)}
        </select>
      </h2>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {INTERESTS[k].map(([title, body, img]) => (
          <div key={title} className="flex overflow-hidden rounded-2xl bg-panel">
            <Photo src={img} alt={title} className="w-2/5 shrink-0" />
            <div className="p-5">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-slate-300">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FooterAccordion({ items }: { items: { title: string; links: [string, string][] }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="border-t border-white/20">
      {items.map((s) => (
        <div key={s.title} className="border-b border-white/20">
          <button className="flex w-full items-center justify-between py-5 text-left font-semibold" onClick={() => setOpen(open === s.title ? null : s.title)}>
            {s.title}<span className="text-xl">{open === s.title ? "−" : "+"}</span>
          </button>
          {open === s.title && (
            <ul className="space-y-2 pb-5 text-sm text-slate-300">
              {s.links.map(([l, h]) => <li key={l}><a className="hover:underline" href={h}>{l}</a></li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
