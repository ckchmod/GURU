import "@testing-library/jest-dom/vitest";

class TestDOMMatrixReadOnly {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  m11 = 1;
  m12 = 0;
  m13 = 0;
  m14 = 0;
  m21 = 0;
  m22 = 1;
  m23 = 0;
  m24 = 0;
  m31 = 0;
  m32 = 0;
  m33 = 1;
  m34 = 0;
  m41 = 0;
  m42 = 0;
  m43 = 0;
  m44 = 1;
}

globalThis.DOMMatrixReadOnly = TestDOMMatrixReadOnly as unknown as typeof DOMMatrixReadOnly;

class TestResizeObserver implements ResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: DOMRectReadOnly.fromRect({ width: 240, height: 160 }),
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: []
        }
      ],
      this
    );
  }

  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = TestResizeObserver;
