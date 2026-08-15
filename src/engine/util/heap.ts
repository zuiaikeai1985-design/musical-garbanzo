/**
 * Binary min-heap over integer node ids keyed by a float score, backed by typed arrays.
 *
 * A* is the hottest engine path when a large selection is ordered to move, so this avoids the
 * allocation churn of an array-of-objects priority queue.
 */
export class MinHeap {
  private ids: Int32Array;
  private keys: Float64Array;
  private size = 0;

  constructor(capacity: number) {
    this.ids = new Int32Array(capacity);
    this.keys = new Float64Array(capacity);
  }

  get length(): number {
    return this.size;
  }

  clear(): void {
    this.size = 0;
  }

  push(id: number, key: number): void {
    if (this.size === this.ids.length) this.grow();
    let i = this.size++;
    this.ids[i] = id;
    this.keys[i] = key;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  /** Returns the id with the smallest key, or -1 when empty. */
  pop(): number {
    if (this.size === 0) return -1;
    const top = this.ids[0];
    this.size--;
    if (this.size > 0) {
      this.ids[0] = this.ids[this.size];
      this.keys[0] = this.keys[this.size];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.size && this.keys[l] < this.keys[smallest]) smallest = l;
        if (r < this.size && this.keys[r] < this.keys[smallest]) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const id = this.ids[a];
    this.ids[a] = this.ids[b];
    this.ids[b] = id;
    const key = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = key;
  }

  private grow(): void {
    const ids = new Int32Array(this.ids.length * 2);
    ids.set(this.ids);
    this.ids = ids;
    const keys = new Float64Array(this.keys.length * 2);
    keys.set(this.keys);
    this.keys = keys;
  }
}
