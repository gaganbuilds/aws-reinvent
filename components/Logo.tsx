// "AWS" small, "re:Invent" large, stacked like the official wordmark.
export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="inline-flex flex-col leading-none">
      <span className={`${big ? "text-2xl" : "text-sm"} font-medium tracking-wide`}>AWS</span>
      <span className={`${big ? "text-7xl sm:text-8xl" : "text-4xl"} font-extralight tracking-tight`}>re:Invent</span>
    </span>
  );
}
