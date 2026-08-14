import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CalendarBlank,
  CurrencyRub,
  Lightning,
  MapPin,
  Users,
  Volleyball,
} from "@phosphor-icons/react";
import { Reveal } from "../components/Reveal";

const TOTAL_SLOTS = 12;
const SPLIT_PER_PLAYER = 350;

function Row({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 text-caption text-content-secondary">
      <span className="text-content-muted">{icon}</span>
      {children}
    </div>
  );
}

/**
 * A working miniature of the bot message, not a picture of one. Taking the
 * slot here runs the same state change the real Карточка чата performs for
 * everyone in the group chat, which is the point the section is making.
 */
export function ChatCard() {
  const [taken, setTaken] = useState(false);
  const reduce = useReducedMotion();

  const filled = taken ? TOTAL_SLOTS : TOTAL_SLOTS - 1;

  return (
    <section className="mx-auto max-w-7xl px-4 py-section sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="ms-display text-display-lg font-semibold">
          Состав собирается прямо в чате
        </h2>
        <p className="ms-measure mx-auto mt-5 text-body-lg text-content-secondary">
          Бот держит в групповом чате одно сообщение и переписывает его при
          каждой записи. Никто никуда не переходит.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-12">
        <div className="mx-auto max-w-lg">
          <div className="rounded-xl border border-hairline bg-surface-raised p-5 shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-title font-semibold tracking-tight">
                  <Volleyball size={22} weight="duotone" />
                  Волейбол
                </h3>
                <div className="mt-3 space-y-1.5">
                  <Row icon={<CalendarBlank size={16} weight="bold" />}>
                    Среда, 19:00
                  </Row>
                  <Row icon={<MapPin size={16} weight="bold" />}>
                    ФОК «Центральный»
                  </Row>
                  <Row icon={<CurrencyRub size={16} weight="bold" />}>
                    {SPLIT_PER_PLAYER} ₽ с человека
                  </Row>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-baseline gap-1 font-mono text-2xl font-semibold tabular-nums">
                  <motion.span
                    key={filled}
                    initial={reduce ? false : { y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className={taken ? "text-accent" : undefined}
                  >
                    {filled}
                  </motion.span>
                  <span className="text-content-muted">/{TOTAL_SLOTS}</span>
                </div>
                <div className="mt-1 flex items-center justify-end gap-1.5 text-micro text-content-muted">
                  <Users size={13} weight="bold" />
                  Заполнено
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
              {Array.from({ length: TOTAL_SLOTS }, (_, index) => {
                const isFilled = index < filled;
                const isNeeded = !taken && index === filled;
                return (
                  <motion.span
                    key={index}
                    initial={false}
                    animate={{
                      scale: isFilled && taken && index === TOTAL_SLOTS - 1 ? [1, 1.12, 1] : 1,
                    }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
                    }
                    className={`aspect-square rounded-xs ${
                      isFilled
                        ? "bg-accent"
                        : isNeeded
                          ? "border border-dashed border-accent"
                          : "bg-ink-700"
                    }`}
                  />
                );
              })}
            </div>

            <div className="mt-4 min-h-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={taken ? "done" : "needed"}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className={`flex items-center gap-2 text-caption font-medium ${
                    taken ? "text-accent" : "text-content-primary"
                  }`}
                >
                  {taken ? (
                    "Состав собран"
                  ) : (
                    <>
                      <Lightning size={15} weight="fill" />
                      Срочно нужен: 1 Связующий
                    </>
                  )}
                </motion.p>
              </AnimatePresence>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTaken(true)}
                disabled={taken}
                className="rounded-pill bg-accent px-4 py-2.5 text-caption font-semibold text-accent-on transition duration-(--ms-duration-base) ease-out hover:bg-accent-hover active:translate-y-px disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-content-secondary"
              >
                {taken ? "Слот занят" : "Занять слот"}
              </button>
              <span className="rounded-pill border border-hairline-strong px-4 py-2.5 text-center text-caption font-medium text-content-secondary">
                Подробнее
              </span>
            </div>
          </div>

          <div className="mt-4 flex min-h-8 items-center justify-center">
            {taken && (
              <button
                type="button"
                onClick={() => setTaken(false)}
                className="text-caption text-content-muted underline underline-offset-4 transition-colors hover:text-content-primary"
              >
                Показать снова
              </button>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
