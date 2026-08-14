import { motion, useReducedMotion } from "motion/react";
import { PrimaryCta, SecondaryCta } from "../components/Cta";

export function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section
      id="top"
      className="mx-auto grid min-h-[100dvh] max-w-7xl grid-cols-1 items-center gap-10 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:pt-24"
    >
      <div className="lg:col-span-6 xl:col-span-5">
        <motion.h1
          {...rise(0)}
          className="ms-display text-display-xl font-semibold"
        >
          Игра не сорвётся <br className="hidden sm:block" />
          из-за <em className="not-italic text-accent">одного</em> человека
        </motion.h1>

        <motion.p
          {...rise(0.1)}
          className="ms-measure mt-6 text-body-lg text-content-secondary"
        >
          Лобби со Слотами и Амплуа, живая Карточка чата в MAX, Сплит аренды и
          отметка о Явке.
        </motion.p>

        <motion.div {...rise(0.2)} className="mt-9 flex flex-wrap gap-3">
          <PrimaryCta />
          <SecondaryCta href="#how">Как это работает</SecondaryCta>
        </motion.div>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-xl border border-hairline lg:col-span-6 lg:col-start-7 xl:col-span-7"
      >
        <img
          src="/hero-court.jpg"
          alt="Пустой зал ночью, один участок площадки подсвечен"
          width={1200}
          height={1600}
          fetchPriority="high"
          decoding="async"
          className="aspect-4/3 w-full object-cover lg:aspect-3/4"
        />
      </motion.div>
    </section>
  );
}
