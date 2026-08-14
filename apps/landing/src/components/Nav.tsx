import { layer } from "@maxsport/brand";
import { Wordmark } from "./Mark";
import { OPEN_IN_MAX } from "./Cta";

export function Nav() {
  return (
    <header
      className="sticky top-0 border-b border-hairline"
      style={{
        zIndex: layer.nav,
        background: "var(--ms-glass-bg)",
        backdropFilter: "var(--ms-glass-blur)",
        WebkitBackdropFilter: "var(--ms-glass-blur)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <a href="#top" className="flex items-center" aria-label="MAX Sport">
          <Wordmark />
        </a>

        <nav className="hidden items-center gap-7 text-caption text-content-secondary md:flex">
          <a className="transition-colors hover:text-content-primary" href="#how">
            Как это работает
          </a>
          <a
            className="transition-colors hover:text-content-primary"
            href="#presence"
          >
            Явка
          </a>
          <a
            className="transition-colors hover:text-content-primary"
            href="#money"
          >
            Сплит
          </a>
        </nav>

        <a
          href="/open"
          className="rounded-pill bg-accent px-5 py-2.5 text-caption font-semibold whitespace-nowrap text-accent-on transition duration-(--ms-duration-base) ease-out hover:bg-accent-hover active:translate-y-px"
        >
          {OPEN_IN_MAX}
        </a>
      </div>
    </header>
  );
}
