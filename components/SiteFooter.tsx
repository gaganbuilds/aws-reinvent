import { EVENT } from "@/lib/config";

export default function SiteFooter() {
  return (
    <footer className="bg-ink">
      <div className="mx-auto max-w-6xl space-y-2 px-5 py-8 text-xs text-slate-400">
        <p>{EVENT.name} · Organised by {EVENT.organiser} · <a className="underline" href={`mailto:${EVENT.contactEmail}`}>{EVENT.contactEmail}</a></p>
        <p>Your details are used only to manage this event.</p>
        <p>AWS and re:Invent are trademarks of Amazon.com, Inc. or its affiliates.</p>
      </div>
    </footer>
  );
}
