import { TILE } from "../constants";

/**
 * Uniform-bucket spatial hash rebuilt once per tick.
 *
 * Target acquisition, splash damage and collision avoidance all need "what is near this point"
 * queries; without this they degrade to O(n²) once a few hundred units are on the map.
 */
export class SpatialHash {
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: number[][];

  constructor(worldWidth: number, worldHeight: number, cellTiles = 4) {
    this.cell = cellTiles * TILE;
    this.cols = Math.max(1, Math.ceil(worldWidth / this.cell));
    this.rows = Math.max(1, Math.ceil(worldHeight / this.cell));
    this.buckets = new Array(this.cols * this.rows);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
  }

  clear(): void {
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i].length = 0;
  }

  insert(id: number, x: number, y: number): void {
    const cx = this.clampCol(Math.floor(x / this.cell));
    const cy = this.clampRow(Math.floor(y / this.cell));
    this.buckets[cy * this.cols + cx].push(id);
  }

  /** Calls `visit` for every id in buckets overlapping the circle. May include false positives. */
  query(x: number, y: number, radius: number, visit: (id: number) => void): void {
    const minX = this.clampCol(Math.floor((x - radius) / this.cell));
    const maxX = this.clampCol(Math.floor((x + radius) / this.cell));
    const minY = this.clampRow(Math.floor((y - radius) / this.cell));
    const maxY = this.clampRow(Math.floor((y + radius) / this.cell));
    for (let cy = minY; cy <= maxY; cy++) {
      const row = cy * this.cols;
      for (let cx = minX; cx <= maxX; cx++) {
        const bucket = this.buckets[row + cx];
        for (let i = 0; i < bucket.length; i++) visit(bucket[i]);
      }
    }
  }

  private clampCol(c: number): number {
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  private clampRow(r: number): number {
    return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r;
  }
}
