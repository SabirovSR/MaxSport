import { useEffect, useRef, type HTMLAttributes } from "react";

function bindDragScroll(root: HTMLDivElement) {
  let pointerId: number | null = null;
  let startX = 0;
  let startScroll = 0;
  let dragged = false;

  const overflowed = () => root.scrollWidth > root.clientWidth + 1;

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (!overflowed()) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScroll = root.scrollLeft;
    dragged = false;
    root.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    if (!dragged && Math.abs(dx) < 6) return;
    dragged = true;
    root.classList.add("is-dragging");
    root.scrollLeft = startScroll - dx;
  }

  function onPointerUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    root.classList.remove("is-dragging");
    try {
      root.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    if (dragged) {
      window.setTimeout(() => {
        dragged = false;
      }, 0);
    }
  }

  function onClickCapture(event: MouseEvent) {
    if (!dragged) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onWheel(event: WheelEvent) {
    if (!overflowed()) return;
    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    if (delta === 0) return;
    root.scrollLeft += delta;
    event.preventDefault();
  }

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerUp);
  root.addEventListener("click", onClickCapture, true);
  root.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    root.removeEventListener("pointerdown", onPointerDown);
    root.removeEventListener("pointermove", onPointerMove);
    root.removeEventListener("pointerup", onPointerUp);
    root.removeEventListener("pointercancel", onPointerUp);
    root.removeEventListener("click", onClickCapture, true);
    root.removeEventListener("wheel", onWheel);
  };
}

export function Chips({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    return bindDragScroll(root);
  }, []);

  return (
    <div
      ref={ref}
      className={className ? `chips ${className}` : "chips"}
      {...props}
    />
  );
}
