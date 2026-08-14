import type { ReactNode } from "react";
import { Reveal } from "../components/Reveal";

function Cell({
  className = "",
  image,
  alt,
  title,
  children,
}: {
  className?: string;
  image?: string;
  alt?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article
      className={`relative flex min-h-64 flex-col justify-end overflow-hidden rounded-lg border border-hairline p-6 sm:p-8 ${
        image ? "" : "bg-surface-raised"
      } ${className}`}
    >
      {image && (
        <>
          <img
            src={image}
            alt={alt ?? ""}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-ink-950/95 via-ink-950/70 to-ink-950/25" />
        </>
      )}
      <div className="relative">
        <h3 className="text-title font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 max-w-[42ch] text-caption leading-relaxed text-content-secondary">
          {children}
        </p>
      </div>
    </article>
  );
}

export function Problems() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-section sm:px-6">
      <Reveal>
        <h2 className="ms-display max-w-[20ch] text-display-lg font-semibold">
          Почему любительский спорт срывается
        </h2>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-12">
          <Cell
            className="md:col-span-7"
            image="/problem-formation.jpg"
            alt="Разметка позиций на полу зала, одна позиция свободна"
            title="Заболел один, не играет никто"
          >
            Замену ищут за час до старта. В общем чате это сорок сообщений и
            никакой гарантии, что кто-то придёт.
          </Cell>

          <Cell className="md:col-span-5" title="Новичок против продвинутых">
            По тексту объявления не понять, какой уровень у состава. В итоге
            некомфортно и новичку, и остальным.
          </Cell>

          <Cell className="md:col-span-5" title="Аренда висит на одном человеке">
            Организатор платит за зал сам, а потом полдня собирает переводы по
            350 рублей.
          </Cell>

          <Cell
            className="md:col-span-7"
            image="/problem-clock.jpg"
            alt="Табло обратного отсчёта в тёмном зале"
            title="Неявки никто не считает"
          >
            Кто пришёл, а кто пропал без предупреждения, в переписке не видно.
            На следующей игре история повторяется.
          </Cell>
        </div>
      </Reveal>
    </section>
  );
}
