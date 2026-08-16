export class Input {
  readonly keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  leftHeld = false;
  rightHeld = false;
  leftPressed = false;
  rightPressed = false;
  private readonly pressed = new Set<string>();

  attach(canvas: HTMLCanvasElement): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onLock);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onLock);
    this.keys.clear();
    this.leftHeld = false;
    this.rightHeld = false;
  }

  consumeKey(code: string): boolean {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame(): void {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.leftPressed = false;
    this.rightPressed = false;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (e.code === "Tab") e.preventDefault();
    this.keys.add(e.code);
    this.pressed.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.leftHeld = true;
      this.leftPressed = true;
    }
    if (e.button === 2) {
      this.rightHeld = true;
      this.rightPressed = true;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.leftHeld = false;
    if (e.button === 2) this.rightHeld = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement) {
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    }
  };

  private onLock = (): void => {
    if (!document.pointerLockElement) {
      this.leftHeld = false;
      this.rightHeld = false;
    }
  };
}
