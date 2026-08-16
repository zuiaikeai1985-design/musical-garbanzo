/**
 * 输入管理：键盘、鼠标按键、指针锁定的鼠标增量、滚轮。
 * 支持方向键转视角（无鼠标环境备用）。
 */
export class Input {
  constructor(element) {
    this.element = element;
    this.keys = new Set();
    this.pressed = new Set(); // 本帧刚按下
    this.mouseDown = false;
    this.mouse2Down = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
    this.pointerLocked = false;
    this.enabled = true;

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.mouseDown = false;
      this.mouse2Down = false;
    });

    element.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.mouse2Down = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.mouse2Down = false;
    });
    window.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("mousemove", (e) => {
      if (this.pointerLocked && this.enabled) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.element;
      if (this.onLockChange) this.onLockChange(this.pointerLocked);
    });
    window.addEventListener(
      "wheel",
      (e) => {
        this.wheelDelta += Math.sign(e.deltaY);
      },
      { passive: true },
    );
  }

  requestLock() {
    if (!this.pointerLocked) {
      const p = this.element.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    }
  }

  releaseLock() {
    if (this.pointerLocked) document.exitPointerLock();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** 每帧末尾调用，清空瞬时状态 */
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
  }
}
