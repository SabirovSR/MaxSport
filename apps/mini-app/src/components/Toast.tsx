import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast(message: string, kind?: ToastKind): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef(0);

  const showToast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      window.clearTimeout(timer.current);
      setToast({ message, kind });
      timer.current = window.setTimeout(() => setToast(null), 3200);
    },
    []
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast ? (
          <div className={`toast toast-${toast.kind}`}>{toast.message}</div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
