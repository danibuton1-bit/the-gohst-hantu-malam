import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom has no 2D canvas; the 3D scene paints textures at import time. Return a no-op context.
const noop = () => {};
const ctx2d: unknown = new Proxy(
  {},
  { get: (_t, p) => (p === "createLinearGradient" || p === "createRadialGradient" ? () => ({ addColorStop: noop }) : noop), set: () => true },
);
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  writable: true,
  value: () => ctx2d,
});
