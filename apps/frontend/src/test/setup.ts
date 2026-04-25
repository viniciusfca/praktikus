import '@testing-library/jest-dom';

// jsdom doesn't implement window.matchMedia; components that read it (useIsMobile,
// AppLayout, RecyclingLayout) need a working stub. Returns `matches: false` so tests
// render the desktop variant by default; override in a specific test if needed.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // deprecated but kept for old libs
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
