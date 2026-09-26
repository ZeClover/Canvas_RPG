// jsdom implements neither the 2D canvas rendering API nor ResizeObserver.
// These lightweight stand-ins let CanvasEngine run its real render/measure
// code paths in tests without needing a browser.

function makeContext2DStub(): CanvasRenderingContext2D {
  const noop = () => undefined;
  const stub = {
    setTransform: noop,
    clearRect: noop,
    save: noop,
    restore: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    bezierCurveTo: noop,
    fill: noop,
    stroke: noop,
    roundRect: noop,
    arc: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    clip: noop,
    drawImage: noop,
    scale: noop,
    translate: noop,
    rotate: noop,
    setLineDash: noop,
    measureText: () => ({ width: 10 }) as TextMetrics,
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "left" as CanvasTextAlign,
  };
  return stub as unknown as CanvasRenderingContext2D;
}

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, type: string) {
    if (type === "2d") return makeContext2DStub();
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;

  // jsdom has no real canvas backing, so toBlob() normally just logs
  // "Not implemented" and never calls back — this is enough to test that
  // callers of exportPNG() get a real Blob without a browser.
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback, type = "image/png") {
    callback(new Blob(["stub-image-bytes"], { type }));
  };
}

export class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  private callback: ResizeObserverCallback;
  target: Element | null = null;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.target = target;
  }

  unobserve(): void {
    this.target = null;
  }

  disconnect(): void {
    MockResizeObserver.instances = MockResizeObserver.instances.filter((instance) => instance !== this);
  }

  trigger(): void {
    this.callback([] as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}

(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver;

export function setHostSize(host: HTMLElement, width: number, height: number): void {
  Object.defineProperty(host, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(host, "clientHeight", { configurable: true, value: height });
}

export function triggerResize(host: HTMLElement): void {
  const observer = MockResizeObserver.instances.find((instance) => instance.target === host);
  observer?.trigger();
}
