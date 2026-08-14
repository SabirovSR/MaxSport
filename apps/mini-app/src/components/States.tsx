import type { ReactNode } from "react";

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

export function LineSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="skeleton skeleton-line"
          style={{ width: index % 2 ? "70%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="empty-state">
      <strong>Что-то пошло не так</strong>
      <p className="error-text">{message}</p>
      {onRetry && (
        <button type="button" className="chip" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}
