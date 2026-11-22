/** Breezy's avatar (spec 7.7.1, design `#bz`): the two breath curves as a gust in a Monsoon circle, not a face. */
export function BreezyMark({ label }: { label?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-8 shrink-0"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="16" cy="16" r="16" fill="#3A4E9C" />
      <path
        d="M8 13.5H18a3.5 3.5 0 1 0-3.5-3.5M8 19H21.5a3.5 3.5 0 1 1-3.5 3.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 23.5h4" stroke="#8ED1E3" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
