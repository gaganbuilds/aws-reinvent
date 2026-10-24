"use client";
import { useEffect, useRef, useState } from "react";

export default function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setReady(true);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`${ready && !on ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"} transition duration-700 ease-out motion-reduce:transition-none ${className}`}>
      {children}
    </div>
  );
}
