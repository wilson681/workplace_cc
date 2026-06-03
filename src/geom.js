// Small geometry helpers. The world is a torus (edges wrap around), which keeps
// creatures from getting stuck on walls and removes edge effects from learning.

const TAU = Math.PI * 2;

/** Wrap an angle into (-π, π]. */
export function normalizeAngle(a) {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
}

/** Wrap a coordinate into [0, size). */
export function wrap(v, size) {
  v %= size;
  if (v < 0) v += size;
  return v;
}

/** Shortest signed delta between two coordinates on a wrapped axis of length `size`. */
export function wrapDelta(d, size) {
  const h = size / 2;
  if (d > h) d -= size;
  else if (d < -h) d += size;
  return d;
}
