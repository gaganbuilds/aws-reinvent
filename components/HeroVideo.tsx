"use client";
import { useRef, useState } from "react";
import { EVENT, IMG } from "@/lib/config";

export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  function toggle() {
    const v = ref.current; if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  }
  return (
    <>
      <video ref={ref} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline preload="auto" poster={IMG.hero}>
        <source src={EVENT.heroVideo} type="video/mp4" />
      </video>
      <button onClick={toggle} aria-label={playing ? "Pause background video" : "Play background video"}
        className="absolute bottom-6 right-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-sm backdrop-blur hover:bg-black/70">
        {playing ? "❚❚" : "▶"}
      </button>
    </>
  );
}
