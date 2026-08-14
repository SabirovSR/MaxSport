import { Reveal } from "../components/Reveal";
import { PrimaryCta } from "../components/Cta";
import { Mark } from "../components/Mark";

export function Closing() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto max-w-7xl px-4 py-section-lg sm:px-6">
        <Reveal className="text-center">
          <p className="ms-display text-display-xl font-semibold text-accent">
            Fill the slot.
          </p>
          <p className="mx-auto mt-6 max-w-[34ch] text-body-lg text-content-secondary">
            Собери состав и не сорви игру.
          </p>
          <div className="mt-10 flex justify-center">
            <PrimaryCta />
          </div>
        </Reveal>
      </div>

      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-8 sm:px-6">
          <span className="flex items-center gap-2.5 text-caption text-content-muted">
            <Mark size={24} />
            MAX Sport
          </span>
        </div>
      </div>
    </footer>
  );
}
