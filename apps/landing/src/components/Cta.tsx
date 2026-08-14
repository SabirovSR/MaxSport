import type { ReactNode } from "react";

/**
 * "Открыть в MAX" is the single label for this intent across the whole page.
 * The href points at the API, which redirects to the bot using its own env,
 * so the static build never has to know the bot username.
 */
export const OPEN_IN_MAX = "Открыть в MAX";

export function PrimaryCta({
  children = OPEN_IN_MAX,
  href = "/open",
}: {
  children?: ReactNode;
  href?: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-pill bg-accent px-7 py-3.5 font-semibold whitespace-nowrap text-accent-on transition duration-(--ms-duration-base) ease-out hover:bg-accent-hover active:translate-y-px active:bg-accent-pressed"
    >
      {children}
    </a>
  );
}

export function SecondaryCta({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-pill border border-hairline-strong px-7 py-3.5 font-medium whitespace-nowrap text-content-primary transition duration-(--ms-duration-base) ease-out hover:border-accent hover:text-accent active:translate-y-px"
    >
      {children}
    </a>
  );
}
