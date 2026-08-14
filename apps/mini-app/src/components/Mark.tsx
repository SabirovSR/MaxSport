/** Court frame with one filled slot. Geometry mirrors packages/brand/assets/mark.svg. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="512" height="512" rx="114" fill="var(--ms-ink-900)" />
      <g
        fill="none"
        stroke="var(--ms-ink-0)"
        strokeWidth="9"
        strokeLinecap="round"
      >
        <rect x="52" y="80" width="408" height="352" rx="19" />
        <path d="M256 80v28" />
        <path d="M256 404v28" />
        <path d="M52 230a26 26 0 0 1 0 52" />
        <path d="M460 230a26 26 0 0 0 0 52" />
      </g>
      <g fill="var(--ms-ink-600)">
        <rect x="86" y="146" width="100" height="100" rx="22" />
        <rect x="206" y="146" width="100" height="100" rx="22" />
        <rect x="326" y="146" width="100" height="100" rx="22" />
        <rect x="86" y="266" width="100" height="100" rx="22" />
        <rect x="206" y="266" width="100" height="100" rx="22" />
      </g>
      <rect
        x="326"
        y="266"
        width="100"
        height="100"
        rx="22"
        fill="var(--ms-accent)"
      />
    </svg>
  );
}
