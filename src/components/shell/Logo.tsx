/** The BreatheWell mark: a B with one breath running through it. Decorative next to the wordmark. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="#0B5E7A" />
      <path d="M24 30H53" fill="none" stroke="#8ED1E3" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M30 30a8 8 0 0 0 0-16H16V51H32a10.5 10.5 0 0 0 0-21"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
