"use client";
import { useEffect, useRef, useState } from "react";

export default function Photo({ src, alt, className = "", hideOnError = false }: { src?: string; alt: string; className?: string; hideOnError?: boolean }) {
  const [bad, setBad] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // The image may already have failed before React hydrated, so check once on mount.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setBad(true);
  }, []);
  if (!src || bad) {
    if (hideOnError) return null;
    return <div role="img" aria-label={alt} className={`bg-gradient-to-br from-indigo-950 via-purple-900 to-fuchsia-900 ${className}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={src} alt={alt} className={`object-cover ${className}`} onError={() => setBad(true)} />;
}
