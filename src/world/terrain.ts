// Walkable surfaces: solid ground polylines, one-way platforms (branches, bridges) and climbables.

export interface Surface {
  pts: [number, number][];
  oneWay: boolean;
  kind: 'ground' | 'branch' | 'bridge' | 'rock' | 'root' | 'shallows';
}

export interface Climb {
  x: number;
  y0: number;
  y1: number;
  kind: 'vine' | 'ladder' | 'rope';
}

export class Terrain {
  surfaces: Surface[] = [];
  climbs: Climb[] = [];
  /** water volumes: [x0, x1, surfaceY, bottomY] */
  water: [number, number, number, number][] = [];

  addGround(pts: [number, number][], kind: Surface['kind'] = 'ground') {
    this.surfaces.push({ pts, oneWay: false, kind });
    return this;
  }
  addPlatform(pts: [number, number][], kind: Surface['kind'] = 'branch') {
    this.surfaces.push({ pts, oneWay: true, kind });
    return this;
  }
  addClimb(x: number, y0: number, y1: number, kind: Climb['kind'] = 'vine') {
    this.climbs.push({ x, y0: Math.min(y0, y1), y1: Math.max(y0, y1), kind });
    return this;
  }

  static yAt(s: Surface, x: number): number | null {
    const p = s.pts;
    if (x < p[0][0] || x > p[p.length - 1][0]) return null;
    for (let i = 1; i < p.length; i++) {
      if (x <= p[i][0]) {
        const t = (x - p[i - 1][0]) / Math.max(1e-6, p[i][0] - p[i - 1][0]);
        return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
      }
    }
    return null;
  }

  /** The main (lowest-index solid) ground height at x. */
  groundY(x: number): number {
    for (const s of this.surfaces) {
      if (s.oneWay) continue;
      const y = Terrain.yAt(s, x);
      if (y !== null) return y;
    }
    return 10000;
  }

  /**
   * Find the highest surface at x whose height is >= fromY - tolerance (i.e. at or below the feet).
   * One-way platforms only count when approaching from above.
   */
  surfaceBelow(x: number, fromY: number, tol = 2, ignoreOneWay = false): { y: number; s: Surface } | null {
    let best: { y: number; s: Surface } | null = null;
    for (const s of this.surfaces) {
      if (ignoreOneWay && s.oneWay) continue;
      const y = Terrain.yAt(s, x);
      if (y === null) continue;
      if (y >= fromY - tol && (!best || y < best.y)) best = { y, s };
    }
    return best;
  }

  climbAt(x: number, y: number, reach = 7): Climb | null {
    for (const c of this.climbs) {
      if (Math.abs(c.x - x) < reach && y >= c.y0 - 4 && y <= c.y1 + 6) return c;
    }
    return null;
  }

  waterAt(x: number): [number, number, number, number] | null {
    for (const w of this.water) if (x >= w[0] && x <= w[1]) return w;
    return null;
  }
}
