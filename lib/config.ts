// Edit this file to change event details shown across the site.
export const EVENT = {
  name: "AWS re:Invent Party, Mysore",
  short: "re:Invent Party Mysore",
  tagline: "Watch re:Invent live with the builder community in Mysore.",
  dateLabel: "December 2026",          // TODO: exact date, e.g. "Sat, 6 December 2026"
  startISO: "",                        // TODO: e.g. "2026-12-06T09:00:00+05:30" to show a countdown
  timeLabel: "Time to be announced",   // TODO
  city: "Mysore, Karnataka",
  venue: "Venue to be announced",      // TODO: full venue name + address
  organiser: "Your organiser / chapter name", // TODO
  contactEmail: "events@example.com",  // TODO
  builderIdSignupUrl: "https://profile.aws.amazon.com/", // TODO: confirm official Builder ID signup link
  officialReinventUrl: "https://aws.amazon.com/events/reinvent/",
  heroVideo: process.env.NEXT_PUBLIC_HERO_VIDEO_URL || "/videos/hero.mp4",
};

export const STEPS = [
  { n: 1, title: "Register", body: "Verify your email with a one-time code and submit your details." },
  { n: 2, title: "Get confirmed", body: "We confirm your seat and update your status." },
  { n: 3, title: "Check your status", body: "Sign in anytime to see where your registration stands." },
];

// Timings are placeholders. Edit freely.
export const AGENDA = [
  { time: "9:00 AM", title: "Registration and welcome", detail: "Pick up your badge, grab a coffee and settle in." },
  { time: "9:45 AM", title: "Opening and community intro", detail: "Meet the organisers and the people building around you." },
  { time: "10:30 AM", title: "re:Invent keynote screening", detail: "Watch the biggest cloud and AI announcements together." },
  { time: "12:30 PM", title: "Networking lunch", detail: "Talk through what you just saw with fellow builders." },
  { time: "1:30 PM", title: "Builder challenge", detail: "A hands-on build session. Team up and make something small and real." },
  { time: "3:30 PM", title: "Live cloud trivia", detail: "Test your skills. Prizes and swag for the winners." },
  { time: "4:30 PM", title: "Lightning talks and community Q&A", detail: "Short talks from the community, then open questions." },
  { time: "5:15 PM", title: "Group photo, swag and wrap-up", detail: "Capture the day and stay connected." },
];

export const FAQS = [
  { q: "Is entry free?", a: "Yes, entry is free. Seats are limited, so register early." },
  { q: "Do I need an AWS Builder ID?", a: "Yes. You can create one for free in about two minutes using the link on the registration page." },
  { q: "How do I know my seat is confirmed?", a: "Sign in with your email on the status page." },
  { q: "Who is this for?", a: "Students, developers and anyone curious about cloud and AI." },
  { q: "Who do I contact for help?", a: `Write to ${EVENT.contactEmail} and we'll get back to you.` },
];

// Photos: drop files into public/images/ with these names. Missing files show a gradient instead.
export const IMG = {
  collage1: "/images/collage-1.jpg", collage2: "/images/collage-2.jpg", collage3: "/images/collage-3.jpg",
  collage4: "/images/collage-4.jpg", collage5: "/images/collage-5.jpg", collage6: "/images/collage-6.jpg",
  hero: "/images/hero.jpg",
  card1: "/images/card-seating.jpg",
  card2: "/images/card-community.jpg",
  card3: "/images/card-agenda.jpg",
  video: "/images/video-poster.jpg",
  dayBuild: "/images/day-build.jpg",
  dayLead: "/images/day-lead.jpg",
  bring1: "/images/bring-1.jpg",
  bring2: "/images/bring-2.jpg",
  bring3: "/images/bring-3.jpg",
  bring4: "/images/bring-4.jpg",
  interest1: "/images/interest-1.jpg",
  interest2: "/images/interest-2.jpg",
  closing: "/images/closing.jpg",
};

export const CATALOG_URL = "https://reinvent.awsevents.com/";  // TODO: confirm official session catalog link

// Only real quotes you have permission to use. Add more entries to grow the carousel.
export const TESTIMONIALS = [
  { quote: "re:Invent is the conference we look forward to most. It brings together an unmatched group of companies and executives, with the opportunity to trade notes with some of the smartest founders in the industry.", author: "2025 Attendee, Startup founder & CEO" },
];

export const BUILD_ITEMS = [
  ["Launch sessions", "Hands-on with new services the same day they're announced"],
  ["Builders' sessions", "One problem, 15 practitioners, candid discussion of what worked and what didn't"],
  ["Ask the experts", "Direct access to the experts who build, develop, and deploy these services daily. Bring your hardest questions"],
  ["500-level deep dives", "Go deeper than the documentation by digging into the science and cutting-edge research behind the technology"],
  ["Industry meetups", "Peers from different industries who solved your challenges a different way"],
  ["Between sessions", "Drop into the Expo, catch a live demo you didn't plan on, grab a coffee in a community hub"],
];
export const LEAD_ITEMS = [
  ["Keynotes", "Hear where cloud and AI are heading, straight from AWS leadership"],
  ["Customer stories", "See how real organisations made hard migration and architecture decisions"],
  ["Strategy sessions", "Working sessions to pressure-test your cloud and AI strategy"],
  ["Executive meetups", "Trade notes with peers who face the same decisions"],
  ["Expo", "Meet the partners and tools behind the platforms"],
];
