import type { Prize } from "@/lib/campaign-options";

/** Pick a prize by weight. Pure and runtime-free so it can be checked without
 *  a Worker or a database. */
export function drawPrize(
  prizes: Array<Prize>,
  roll = Math.random(),
): Prize | null {
  const pool = prizes.filter((p) => p.weight > 0);
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  // `roll` is in [0,1); scaling by the weight total keeps each slice
  // proportional without requiring the weights to add up to anything.
  let ticket = roll * total;
  for (const p of pool) {
    ticket -= p.weight;
    if (ticket < 0) return p;
  }
  return pool[pool.length - 1]!; // float drift only; the loop covers the range
}
