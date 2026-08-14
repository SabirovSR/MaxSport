import { Medal } from "@phosphor-icons/react";
import { Reveal } from "../components/Reveal";

export function Karma() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-section sm:px-6">
      <Reveal>
        <h2 className="ms-display max-w-[18ch] text-display-lg font-semibold">
          Видно, кому можно доверить Слот
        </h2>
        <p className="ms-measure mt-5 text-body-lg text-content-secondary">
          Надёжность считается из реальной Явки, а не из отзывов. Организатор
          видит её прежде, чем отдать последнее место в Горящем Лобби.
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-12">
          <article className="flex min-h-64 flex-col justify-end rounded-lg bg-accent p-7 text-accent-on sm:p-8 md:col-span-7">
            <p className="font-mono text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl">
              94%
            </p>
            <p className="mt-3 max-w-[24ch] text-caption font-medium">
              Надёжность явки в Игровом паспорте
            </p>
          </article>

          <article className="flex min-h-64 flex-col justify-end rounded-lg border border-hairline bg-surface-raised p-7 sm:p-8 md:col-span-5">
            <p className="font-mono text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl">
              38
            </p>
            <p className="mt-3 max-w-[20ch] text-caption text-content-secondary">
              Игр сыграно в составе
            </p>
          </article>

          <article className="flex items-center gap-4 rounded-lg border border-accent-line bg-accent-soft p-7 sm:p-8 md:col-span-12">
            <Medal
              size={36}
              weight="duotone"
              className="shrink-0 text-accent"
            />
            <div>
              <p className="text-title font-semibold tracking-tight">
                Спасатель матча
              </p>
              <p className="mt-1 max-w-[62ch] text-caption text-content-secondary">
                Бейдж за Горящий слот, доведённый до площадки. Остальное в
                паспорте: уровень и спортивные отметки от партнёров по составу.
              </p>
            </div>
          </article>
        </div>
        <p className="mt-4 text-micro text-content-muted">
          Пример Игрового паспорта.
        </p>
      </Reveal>
    </section>
  );
}
