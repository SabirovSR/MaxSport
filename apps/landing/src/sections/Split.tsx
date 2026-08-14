import { Reveal } from "../components/Reveal";

export function Split() {
  return (
    <section id="money" className="mx-auto max-w-7xl px-4 py-section sm:px-6">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <h2 className="ms-display text-display-lg font-semibold">
            Аренда делится сама
          </h2>
          <p className="ms-measure mt-5 text-body-lg text-content-secondary">
            Организатор указывает сумму за зал один раз. Каждый Игрок видит
            свою долю ещё до того, как займёт Слот.
          </p>
          <p className="ms-measure mt-4 text-body text-content-secondary">
            Залог включается галочкой. При отмене за два часа он возвращается,
            при молчаливой неявке уходит в счёт аренды.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-6 lg:col-start-7">
          <div className="rounded-xl border border-hairline bg-surface-raised p-8 sm:p-10">
            <dl className="space-y-6 font-mono tabular-nums">
              <div className="flex items-baseline justify-between gap-6">
                <dt className="text-caption text-content-muted">
                  Аренда зала
                </dt>
                <dd className="text-3xl font-semibold">4200 ₽</dd>
              </div>
              <div className="flex items-baseline justify-between gap-6">
                <dt className="text-caption text-content-muted">Слотов</dt>
                <dd className="text-3xl font-semibold">12</dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 border-t border-hairline pt-6">
                <dt className="text-caption text-content-muted">
                  С человека
                </dt>
                <dd className="text-5xl font-semibold text-accent">350 ₽</dd>
              </div>
            </dl>
            <p className="mt-8 text-micro text-content-muted">
              Пример расчёта для волейбольного Лобби на двенадцать Слотов.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
