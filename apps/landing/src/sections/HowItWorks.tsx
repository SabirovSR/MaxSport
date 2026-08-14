import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    title: "Создать Лобби",
    body: "Вид спорта, Площадка, время и число Слотов. Нужные Амплуа отмечаются отдельно, чтобы состав не собрался без связующего.",
  },
  {
    title: "Поделиться в чат",
    body: "Бот публикует Карточку чата в групповой чат. Дальше он сам переписывает её при каждом изменении состава.",
  },
  {
    title: "Занять Слот",
    body: "Игрок нажимает кнопку прямо в переписке. Счётчик обновляется у всех участников чата сразу.",
  },
  {
    title: "Отметить Явку",
    body: "За тридцать минут до игры бот напоминает выехать. У Площадки хватает одного касания или гео.",
  },
  {
    title: "Оценить игру",
    body: "Опрос на десять секунд после матча. Из него складывается Карма и Игровой паспорт Игрока.",
  },
];

/**
 * Each card pins until the last one arrives, and the previous card shrinks
 * as the next one covers it. That is the product cycle as a physical stack,
 * not a numbered list of stages.
 */
export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || !ref.current) return;
    const ctx = gsap.context(() => {
      const cardEls = gsap.utils.toArray<HTMLElement>(".stack-card");
      cardEls.forEach((card, i) => {
        if (i === cardEls.length - 1) return;
        ScrollTrigger.create({
          trigger: card,
          start: "top top",
          endTrigger: cardEls[cardEls.length - 1],
          end: "top top",
          pin: true,
          pinSpacing: false,
        });
        gsap.to(card, {
          scale: 0.92,
          opacity: 0.55,
          ease: "none",
          scrollTrigger: {
            trigger: cardEls[i + 1],
            start: "top bottom",
            end: "top top",
            scrub: true,
          },
        });
      });
    }, ref);
    return () => ctx.revert();
  }, [reduce]);

  return (
    <section id="how">
      <div className="mx-auto max-w-7xl px-4 pt-section sm:px-6">
        <h2 className="ms-display max-w-[16ch] text-display-lg font-semibold">
          Пять шагов до игры
        </h2>
      </div>

      <div ref={ref} className="relative mt-8">
        {STEPS.map((step) => (
          <div
            key={step.title}
            className="stack-card sticky top-0 flex min-h-[100dvh] items-center"
          >
            <article className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-16 sm:px-6 md:grid-cols-12 md:items-end">
              <div className="rounded-xl border border-hairline bg-surface-raised p-7 shadow-raised sm:p-10 md:col-span-12">
                <h3 className="ms-display text-display-md font-semibold">
                  {step.title}
                </h3>
                <p className="mt-4 max-w-[65ch] text-body leading-relaxed text-content-secondary">
                  {step.body}
                </p>
              </div>
            </article>
          </div>
        ))}
      </div>
    </section>
  );
}
