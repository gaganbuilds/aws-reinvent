import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import Logo from "@/components/Logo";
import Photo from "@/components/Photo";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import Countdown from "@/components/Countdown";
import HeroVideo from "@/components/HeroVideo";
import BackToTop from "@/components/BackToTop";
import { DayTabs, FooterAccordion, InterestPicker, TestimonialCarousel } from "@/components/Interactive";
import { AGENDA, CATALOG_URL, EVENT, FAQS, IMG } from "@/lib/config";

const grad = "bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent";

export default function Home() {
  const collage = [
    ["col-span-2 row-span-2", IMG.collage1], ["col-span-2 row-span-1", IMG.collage2], ["col-span-2 row-span-1", IMG.collage3],
    ["col-span-2 row-span-1", IMG.collage4], ["col-span-2 row-span-1", IMG.collage5], ["col-span-2 row-span-1", IMG.collage6],
  ];
  return (
    <main className="bg-ink">
      <SiteNav />

      {/* HERO */}
      <section className="relative min-h-screen overflow-hidden">
        <HeroVideo />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/60 to-ink/30" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-24 pt-32 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="mb-6 text-xs text-slate-300">AWS &nbsp;›&nbsp; Events &nbsp;›&nbsp; re:Invent</p>
            <div className="rounded-3xl border border-white/10 bg-black/45 p-8 backdrop-blur-md sm:p-10">
              <Logo size="lg" />
              <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">Build what's next</h1>
              <p className="mt-4 max-w-md text-lg text-slate-200">Join us in Mysore this December for cloud and AI's biggest week.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="rounded-full bg-white/15 px-7 py-3 text-sm font-semibold transition hover:bg-white/25">Register now</Link>
                <a href={CATALOG_URL} target="_blank" rel="noreferrer" className="rounded-full border border-white/60 px-7 py-3 text-sm font-semibold transition hover:bg-white/10">Browse event catalog</a>
              </div>
            </div>
            <Countdown iso={EVENT.startISO} />
          </div>
          
        </div>
      </section>

      {/* THE LATEST */}
      <section id="plan" className="mx-auto max-w-6xl px-5 py-24">
        <Reveal><h2 className="text-3xl font-semibold sm:text-4xl">The latest on re:Invent</h2></Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {[
            ["Registration", IMG.card1, "Save your seat", "Registration is open. Reserve your spot and get ready to join us.", "/register"],
            ["Community", IMG.card2, "Meet the community", "Connect with students, developers and cloud enthusiasts, and stay in touch long after the event.", "/#about"],
            ["Agenda", IMG.card3, "Browse the agenda", "See how the day will run, from the keynote screening to hands-on building, and show up with your day already planned.", "/#agenda"],
          ].map(([tag, img, title, body, href], i) => (
            <Reveal key={title} delay={i * 100}>
              <Link href={href} className="group block h-full overflow-hidden rounded-2xl bg-panel ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:ring-fuchsia-500/40">
                <div className="relative overflow-hidden">
                  <Photo src={img} alt={title} className="h-60 w-full transition duration-700 group-hover:scale-105" />
                  <span className="absolute left-4 top-4 rounded bg-black/70 px-2 py-1 font-mono text-[11px]">{tag}</span>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{body}</p>
                  <span className="mt-6 block text-xl transition group-hover:translate-x-1">→</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* WHY THIS WEEK MATTERS */}
      <section id="about" className="mx-auto grid max-w-6xl gap-10 px-5 pb-24 lg:grid-cols-2">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl">
            <a href="https://youtu.be/1BJO_jmXDFQ" target="_blank" rel="noopener noreferrer" className="group relative block aspect-video w-full"><img src="https://img.youtube.com/vi/1BJO_jmXDFQ/hqdefault.jpg" alt="re:Invent highlights" className="h-full w-full object-cover" /><span className="absolute bottom-4 left-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white transition group-hover:scale-110">▶</span></a>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="text-3xl font-semibold sm:text-4xl">Why this week matters right now</h2>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-200">
            <p>New services are launching. Architectures are shifting. The decisions you make next matter.</p>
            <p>From startups to enterprises, AWS re:Invent is where the cloud and AI community comes together to work through what's next. Over 2,200 sessions, 70% of them interactive. Experts who share what worked and what didn't.</p>
            <p>Be part of it with a local community of builders, watching and learning together.</p>
          </div>
        </Reveal>
      </section>

      {/* SESSIONS AND TOPICS */}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-28 lg:grid-cols-2">
        <Reveal><h2 className="text-3xl font-semibold sm:text-4xl">Get a look at this year's sessions and topics</h2></Reveal>
        <Reveal delay={120}>
          <p className="text-sm leading-relaxed text-slate-200">Over 1,200 sessions are now live across AI, security, migration, developer productivity, and more. Start favoriting the ones you don't want to miss. New sessions are added continuously.</p>
          <p className="mt-6"><a className="text-sky-400 underline underline-offset-4" href={CATALOG_URL} target="_blank" rel="noreferrer">Browse event catalog</a></p>
        </Reveal>
      </section>

      {/* BY THE NUMBERS */}
      <section className="mx-auto max-w-6xl px-5 pb-28">
        <Reveal><h2 className="text-3xl font-semibold sm:text-4xl">re:Invent by the numbers</h2></Reveal>
        <div className="mt-12 grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className={`${grad} text-8xl font-bold sm:text-9xl`}><CountUp to={94} suffix="%" /></p>
            <p className="mt-4 text-2xl font-medium">of attendees recommend re:Invent to a colleague</p>
          </Reveal>
          <Reveal delay={120} className="space-y-8">
            <div className="border-b border-white/15 pb-8">
              <p className={`${grad} text-5xl font-bold`}>1,000s</p>
              <p className="mt-2 text-2xl font-medium">of opportunities to connect with AWS experts in small groups</p>
            </div>
            <div>
              <p className={`${grad} text-5xl font-bold`}><CountUp to={70} suffix="%" /></p>
              <p className="mt-2 text-2xl font-medium">of sessions are interactive</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="mx-auto max-w-6xl px-5 pb-28"><Reveal><TestimonialCarousel /></Reveal></section>

      {/* A DAY AT RE:INVENT */}
      <section className="mx-auto max-w-6xl px-5 pb-28">
        <Reveal>
          <h2 className="text-3xl font-semibold sm:text-4xl">A day at re:Invent</h2>
          <p className="mb-8 mt-3 max-w-2xl text-lg text-slate-200">Five days, 2,200+ sessions, and countless opportunities to build your network. Here's what a single day looks like.</p>
          <DayTabs />
        </Reveal>
      </section>

      {/* MYSORE AGENDA */}
      <section id="agenda" className="mx-auto max-w-4xl px-5 pb-28">
        <Reveal>
          <h2 className="text-3xl font-semibold sm:text-4xl">Your day in Mysore</h2>
          <p className="mt-3 text-slate-300">{EVENT.dateLabel} · {EVENT.venue}. Timings are tentative and may be updated.</p>
        </Reveal>
        <ol className="relative mt-10 space-y-6 border-l border-white/15 pl-8">
          {AGENDA.map((a, i) => (
            <Reveal key={a.title} delay={i * 60}>
              <li className="relative">
                <span className="absolute -left-[41px] top-1.5 h-4 w-4 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 ring-4 ring-ink" />
                <p className="text-sm font-semibold text-fuchsia-400">{a.time}</p>
                <h3 className="mt-1 text-lg font-semibold">{a.title}</h3>
                <p className="text-sm text-slate-400">{a.detail}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* WHAT YOU BRING BACK */}
      <section className="mx-auto max-w-6xl px-5 pb-28">
        <Reveal>
          <h2 className="text-3xl font-semibold sm:text-4xl">What you bring back</h2>
          <p className="mt-3 text-lg text-slate-200">Your experience is designed for you. Here's what you leave with.</p>
        </Reveal>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [IMG.bring1, "New skills you've already used to build something or applied in a working session"],
            [IMG.bring2, "Tested approaches and vetted best practices ready to put to work the week you return"],
            [IMG.bring3, "Relationships with AWS experts and cross-industry peers you can call when you're stuck"],
            [IMG.bring4, "A clear view of what's changing across cloud and AI and what it means for your next move"],
          ].map(([img, text], i) => (
            <Reveal key={i} delay={i * 80}>
              <div className="group overflow-hidden rounded-xl"><Photo src={img} alt="" className="h-48 w-full transition duration-700 group-hover:scale-105" /></div>
              <p className={`${grad} mt-4 text-2xl font-semibold`}>{i + 1}.</p>
              <p className="mt-2 text-sm text-slate-200">{text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* INTERESTED IN */}
      <section className="mx-auto max-w-6xl px-5 pb-28"><Reveal><InterestPicker /></Reveal></section>

      {/* BUILDER CENTER IN ACTION */}
      <section id="pass" className="mx-auto max-w-6xl px-5 pb-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1020] to-[#120a24] p-8 sm:p-12">
            <div className="pointer-events-none absolute -right-10 bottom-0 hidden grid-cols-6 gap-1 opacity-90 md:grid">
              {Array.from({ length: 18 }).map((_, i) => (
                <span key={i} className={`h-14 w-14 ${[0, 1, 2, 6, 7, 8, 10, 15].includes(i) ? "bg-gradient-to-br from-indigo-600 via-blue-600 to-teal-500" : [4, 9, 16].includes(i) ? "bg-gradient-to-br from-teal-500 to-indigo-500" : "bg-white/[0.03]"}`} />
              ))}
            </div>
            <div className="relative max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400">Free for builders</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Builder Center in action.</h2>
              <p className="mt-3 text-slate-300">Watch re:Invent live, learn, build and connect with the Mysore builder community.</p>
              <Link href="/register" className="mt-6 inline-block rounded-xl bg-[#3a0f8f] px-7 py-3.5 text-sm font-semibold transition hover:bg-[#4b1bb0]">Register for Free</Link>
              <div className="mt-8 grid max-w-xl grid-cols-2 gap-3">
                {[["Free Entry", "For eligible students"], ["Limited Seats", "Register early"], ["Pre-registration", "No on-site registration"], ["1 City", "Mysore"]].map(([t, s]) => (
                  <div key={t} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-fuchsia-500/40">
                    <span className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
                    <div><p className="text-sm font-semibold">{t}</p><p className="text-xs text-slate-400">{s}</p></div>
                  </div>
                ))}
              </div>
              <pre className="mt-6 max-w-xl overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-5 text-sm leading-relaxed"><span className="text-fuchsia-400">if</span> ready_to_build:{"\n"}    learn(); build(); connect(){"\n\n"}<span className="text-fuchsia-400">else</span>:{"\n"}    print("see you there anyway")</pre>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-5 pb-28">
        <Reveal><h2 className="text-3xl font-semibold sm:text-4xl">FAQ</h2></Reveal>
        <div className="mt-8 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-xl bg-panel p-5 ring-1 ring-white/5 transition open:ring-fuchsia-500/30">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{f.q}<span className="text-xl transition group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-sm text-slate-300">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CLOSING */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-24 lg:grid-cols-2">
        <Reveal>
          <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">One city. Real access. Real answers. Join us.</h2>
          <p className="mt-6 text-slate-200">{EVENT.dateLabel} | {EVENT.city}</p>
        </Reveal>
        <Reveal delay={120}><Photo src={IMG.closing} alt="Event venue" className="h-72 w-full rounded-2xl" /></Reveal>
      </section>

      <div className="mx-auto max-w-6xl px-5 pb-12">
        <FooterAccordion items={[
          { title: "About AWS", links: [["AWS re:Invent", EVENT.officialReinventUrl]] },
          { title: "Resources", links: [["Create an AWS Builder ID", EVENT.builderIdSignupUrl], ["Session catalog", CATALOG_URL]] },
          { title: "Help", links: [["Contact the organisers", `mailto:${EVENT.contactEmail}`], ["My registration status", "/status"]] },
        ]} />
      </div>
      <SiteFooter />
      <BackToTop />
    </main>
  );
}
