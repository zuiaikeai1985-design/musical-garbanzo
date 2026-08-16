export type MouseButton = 0 | 1 | 2;

/**
 * Keyboard/mouse state plus pointer-lock handling. Movement keys are read by
 * physical `code` so the game plays the same on non-QWERTY layouts.
 */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressedThisFrame = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private readonly mousePressedThisFrame = new Set<number>();

  mouseDX = 0;
  mouseDY = 0;
  wheelDelta = 0;
  locked = false;

  onLockChange: ((locked: boolean) => void) | null = null;

  constructor(private readonly element: HTMLElement) {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mouseup", this.handleMouseUp);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("wheel", this.handleWheel, { passive: true });
    window.addEventListener("blur", this.handleBlur);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    document.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  requestLock(): void {
    const attempt = (retriesLeft: number): void => {
      const result = this.element.requestPointerLock() as unknown as
        | Promise<void>
        | undefined;
      if (result && typeof result.catch === "function") {
        // Browsers reject re-locking for about a second after an exit.
        result.catch(() => {
          if (retriesLeft > 0) window.setTimeout(() => attempt(retriesLeft - 1), 350);
        });
      }
    };
    attempt(6);
  }

  releaseLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  isMouseDown(button: MouseButton): boolean {
    return this.mouseDown.has(button);
  }

  wasMousePressed(button: MouseButton): boolean {
    return this.mousePressedThisFrame.has(button);
  }

  /** Called at the end of every frame once all systems have polled the state. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.mousePressedThisFrame.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
  }

  private readonly handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Tab" || e.code === "Space") e.preventDefault();
    if (e.repeat) return;
    this.down.add(e.code);
    this.pressedThisFrame.add(e.code);
  };

  private readonly handleKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  private readonly handleMouseDown = (e: MouseEvent) => {
    this.mouseDown.add(e.button);
    this.mousePressedThisFrame.add(e.button);
  };

  private readonly handleMouseUp = (e: MouseEvent) => {
    this.mouseDown.delete(e.button);
  };

  private readonly handleMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private readonly handleWheel = (e: WheelEvent) => {
    this.wheelDelta += e.deltaY;
  };

  private readonly handleBlur = () => {
    this.down.clear();
    this.mouseDown.clear();
  };

  private readonly handlePointerLockChange = () => {
    this.locked = document.pointerLockElement === this.element;
    this.down.clear();
    this.mouseDown.clear();
    this.onLockChange?.(this.locked);
  };
}
