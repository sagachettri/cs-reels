import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom does not implement these browser features, so tests provide simple stand-ins.
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = FakeIntersectionObserver;

window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.scrollBy = vi.fn();
window.scrollTo = vi.fn();
URL.createObjectURL = vi.fn(() => 'blob:fake');
URL.revokeObjectURL = vi.fn();
window.confirm = vi.fn(() => true);
