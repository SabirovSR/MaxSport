import { Reveal } from "../components/Reveal";

const TIMELINE = [
  {
    at: "T-24ч",
    body: "Бот спрашивает, идёшь ли ты. Ответ в одну кнопку.",
  },
  {
    at: "T-2ч",
    body: "Последнее подтверждение. Отмена здесь ещё освобождает Слот без штрафа по Залогу.",
  },
  {
    at: "T-30мин",
    body: "Напоминание выехать вместе с адресом и маршрутом до Площадки.",
  },
  {
    at: "T-20 ... T+15",
    body: "Окно Явки. Одно касание в сообщении бота или автоматически по гео рядом с Площадкой.",
  },
  {
    at: "T+15",
    body: "Кто не отметился и не снялся заранее, получает статус «не пришёл».",
  },
];

export function Presence() {
  return (
    <section id="presence" className="py-section">
      <div className="relative">
        <img
          src="/presence-threshold.jpg"
          alt="Открытые двери в спортивный зал, порог отмечен светлой линией"
          loading="lazy"
          decoding="async"
          className="h-[42vh] min-h-72 w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-b from-surface-base via-transparent to-surface-base" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="-mt-12 max-w-3xl">
          <h2 className="ms-display text-display-lg font-semibold">
            Явка без QR и сканеров
          </h2>
          <p className="ms-measure mt-5 text-body-lg text-content-secondary">
            Люди приходят вразнобой, и Организатор не стоит на входе со
            сканером. Поэтому Явка работает фоном: бот напоминает сам, а от
            Игрока нужно одно касание.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <ol className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-5">
            {TIMELINE.map((item) => (
              <li
                key={item.at}
                className="flex flex-col gap-3 bg-surface-base p-6"
              >
                <span className="font-mono text-caption font-semibold tracking-wide text-accent">
                  {item.at}
                </span>
                <p className="text-caption leading-relaxed text-content-secondary">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
