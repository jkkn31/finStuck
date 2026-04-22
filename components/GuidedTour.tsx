// Lightweight guided tour overlay — no external deps.
//
// Given an array of steps (each pointing at a CSS selector), renders a
// dimmed backdrop with a rounded "spotlight" cutout around the current target
// plus a floating tooltip with Back / Next / Skip controls.
//
// Positioning:
//   - Target rect is read via getBoundingClientRect() after scrolling the
//     element into view (so the spotlight always lands on what the user
//     is meant to look at).
//   - Recomputed on scroll / resize so the cutout stays glued to the element.
//   - Tooltip is placed below the target by default, flipped above if there
//     isn't enough room; horizontally centered and clamped to the viewport.
//
// Keyboard: Esc closes, ← prev, → next.
//
// Implementation notes:
//   - Rendered into document.body via createPortal so stacking is independent
//     of the caller's DOM position.
//   - Backdrop is an SVG rect with a mask that punches a hole for the target.
//     This gives us a single-surface dim + a crisp rounded cutout in one shot
//     without DOM gymnastics.

"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { TourStep } from "@/lib/tours";

type Props = {
  steps: TourStep[];
  open: boolean;
  onClose: () => void; // fires on skip, backdrop click, or Esc
  onFinish?: () => void; // fires when the user reaches the last step's "Done"
};

const TIP_WIDTH = 340;
const TIP_MARGIN = 12;
const PAD = 8; // halo around target

export default function GuidedTour({ steps, open, onClose, onFinish }: Props) {
  const [mounted, setMounted] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => setMounted(true), []);

  // Restart at step 0 each time the tour opens.
  useEffect(() => {
    if (open) {
      setI(0);
      setReady(false);
    }
  }, [open]);

  const step = steps[i];

  // Find the target element, scroll it into view, then capture its rect.
  // Retries briefly in case the element isn't yet mounted when the step
  // advances (e.g. lazy content).
  useLayoutEffect(() => {
    if (!open || !step) return;
    setReady(false);
    let cancelled = false;
    let timer = 0;
    let tries = 0;

    const attempt = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) {
        if (tries++ < 30) {
          timer = window.setTimeout(attempt, 50);
        }
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      // Let the scroll animation settle a couple of frames before measuring.
      window.setTimeout(() => {
        if (cancelled) return;
        setRect(el.getBoundingClientRect());
        setReady(true);
      }, 250);
    };
    attempt();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [open, i, step]);

  // Track scroll / resize so the spotlight follows the element.
  useEffect(() => {
    if (!open || !step) return;
    const recompute = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [open, step]);

  const next = useCallback(() => {
    if (i >= steps.length - 1) {
      onFinish?.();
      onClose();
    } else {
      setI((v) => v + 1);
    }
  }, [i, steps.length, onClose, onFinish]);

  const prev = useCallback(() => {
    setI((v) => Math.max(0, v - 1));
  }, []);

  // Keyboard nav — scoped to when the tour is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, next, prev]);

  if (!mounted || !open || !step) return null;

  const targetBox =
    rect && ready
      ? {
          top: Math.max(0, rect.top - PAD),
          left: Math.max(0, rect.left - PAD),
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
        }
      : null;

  // Tooltip position — prefer below the target, flip above if cramped,
  // clamp horizontally to stay on-screen.
  const tipStyle: CSSProperties = {
    position: "fixed",
    width: TIP_WIDTH,
    zIndex: 2,
  };
  if (targetBox) {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const TIP_H_ESTIMATE = 180;
    const spaceBelow = vh - (targetBox.top + targetBox.height);
    const forced = step.placement;
    const showBelow =
      forced === "bottom" ||
      (forced !== "top" && spaceBelow > TIP_H_ESTIMATE + TIP_MARGIN + 20);

    tipStyle.top = showBelow
      ? targetBox.top + targetBox.height + TIP_MARGIN
      : Math.max(8, targetBox.top - TIP_H_ESTIMATE - TIP_MARGIN);

    const centerLeft = targetBox.left + targetBox.width / 2 - TIP_WIDTH / 2;
    tipStyle.left = Math.min(Math.max(8, centerLeft), vw - TIP_WIDTH - 8);
  } else {
    tipStyle.top = "50%";
    tipStyle.left = "50%";
    tipStyle.transform = "translate(-50%, -50%)";
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      aria-live="polite"
      onClick={onClose}
    >
      {/* Dimmed backdrop with a cutout for the target. */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetBox && (
              <rect
                x={targetBox.left}
                y={targetBox.top}
                width={targetBox.width}
                height={targetBox.height}
                rx={10}
                ry={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-spotlight-mask)"
        />
        {targetBox && (
          <rect
            x={targetBox.left}
            y={targetBox.top}
            width={targetBox.width}
            height={targetBox.height}
            rx={10}
            ry={10}
            fill="none"
            stroke="rgb(16,185,129)"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Tooltip — stop click-through so it doesn't dismiss itself. */}
      <div
        role="dialog"
        aria-label={step.title}
        style={tipStyle}
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold">{step.title}</div>
          <div className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
            {i + 1} / {steps.length}
          </div>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          {step.body}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={i === 0}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={next}
              className="rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-3 py-1 text-xs font-medium"
            >
              {i === steps.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
