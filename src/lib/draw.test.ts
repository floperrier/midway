/* Smallest thing that fails if the prize draw breaks.
   Run: pnpm test */
import assert from "node:assert/strict";
import { drawPrize } from "@/lib/draw";

const prizes = [
  { label: "10% off", code: "A", weight: 60 },
  { label: "20% off", code: "B", weight: 30 },
  { label: "Free tote", code: "C", weight: 10 },
];

// Boundaries land in the slice the weights describe.
assert.equal(drawPrize(prizes, 0)!.code, "A");
assert.equal(drawPrize(prizes, 0.59)!.code, "A");
assert.equal(drawPrize(prizes, 0.6)!.code, "B");
assert.equal(drawPrize(prizes, 0.89)!.code, "B");
assert.equal(drawPrize(prizes, 0.9)!.code, "C");
assert.equal(drawPrize(prizes, 0.999)!.code, "C");

// Weights need not sum to 100.
assert.equal(drawPrize([{ label: "x", code: "X", weight: 5 }], 0.999)!.code, "X");

// Nothing to win is a valid state, not a crash.
assert.equal(drawPrize([]), null);
assert.equal(drawPrize([{ label: "x", code: "X", weight: 0 }]), null);

// A heavy weight next to a zero weight never yields the zero.
const withZero = [
  { label: "never", code: "N", weight: 0 },
  { label: "always", code: "Y", weight: 1 },
];
for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
  assert.equal(drawPrize(withZero, roll)!.code, "Y");
}

console.log("drawPrize: ok");
