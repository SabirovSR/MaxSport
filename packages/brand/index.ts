/**
 * MAX Sport brand values for JavaScript.
 *
 * Styling should read the CSS custom properties in `tokens.css`. This entry
 * point exists for the cases a stylesheet cannot cover: Motion transition
 * configs, canvas and map styling, and portal layering.
 *
 * The hex literals here mirror `tokens.css`; `tests/tokens.test.ts` fails the
 * build if the two ever drift.
 */

export const palette = {
  ink: {
    950: "#0e0e0e",
    900: "#1a1a1a",
    850: "#202020",
    800: "#262626",
    700: "#333333",
    600: "#474747",
    500: "#6b6b6b",
    400: "#8a8a8a",
    300: "#b0b0b0",
    200: "#d4d4d4",
    100: "#ebebeb",
    50: "#f7f7f7",
    0: "#fafafa",
  },
  lime: {
    300: "#defa8f",
    400: "#d3f76c",
    500: "#c8f54a",
    600: "#a9dc22",
    700: "#7fa818",
    800: "#4f6b12",
  },
  signal: {
    transit: "#6fc3e8",
    hot: "#e5a44b",
    danger: "#e2685f",
  },
} as const;

/** Court-lime. The only accent either surface is allowed to use. */
export const ACCENT = palette.lime[500];

/** Charcoal. The only legal text colour on an accent fill. */
export const ACCENT_ON = palette.ink[900];

export const radius = {
  xs: "0.375rem",
  sm: "0.625rem",
  md: "0.875rem",
  lg: "1.125rem",
  xl: "1.5rem",
  pill: "999px",
} as const;

export const motion = {
  duration: { fast: 0.15, base: 0.26, slow: 0.42 },
  ease: {
    out: [0.16, 1, 0.3, 1],
    inOut: [0.65, 0, 0.35, 1],
  },
  spring: { type: "spring", stiffness: 100, damping: 20 },
} as const;

export const layer = {
  sticky: 100,
  nav: 200,
  sheet: 300,
  modal: 400,
  toast: 500,
  grain: 600,
} as const;

export type InkShade = keyof typeof palette.ink;
export type LimeShade = keyof typeof palette.lime;
export type Radius = keyof typeof radius;
export type Layer = keyof typeof layer;
