import test from "node:test";
import assert from "node:assert/strict";
import { eligiblePrizes, choosePrize, historyReducer, parsePrizes, normalizeGame, textColor, wheelSlices, sliceAtPointer, effectiveProbabilities, validateWheelImport } from "../src/features.mjs";

test("retired and zero-probability prizes never enter the draw", () => {
  const prizes = [{ texto: "A", probabilidad: 80 }, { texto: "B", probabilidad: 0 }, { texto: "C", probabilidad: 20 }];
  const pool = eligiblePrizes(prizes, [0]);
  assert.deepEqual(pool.map(p => p.index), [2]);
  for (const random of [0, .1, .5, .999999, 1]) assert.equal(choosePrize(pool, random).texto, "C");
  assert.equal(choosePrize(eligiblePrizes(prizes, [0, 2])), null);
  assert.equal(choosePrize([{ probabilidad: 0 }]), null);
});

test("weighted selection handles exact boundaries and normalizes remaining weights", () => {
  const prizes = [{ texto: "A", probabilidad: 30 }, { texto: "B", probabilidad: 70 }];
  assert.equal(choosePrize(prizes, 0).texto, "A");
  assert.equal(choosePrize(prizes, .29999).texto, "A");
  assert.equal(choosePrize(prizes, .3).texto, "B");
  assert.equal(choosePrize(prizes, .999).texto, "B");
});

test("undo restores a removed prize and a new edit discards redo", () => {
  const original = { gajos: ["A", "B", "C", "D"] };
  let state = { present: original, past: [], future: [] };
  state = historyReducer(state, { type: "edit", value: { gajos: ["A", "B", "C"] } });
  state = historyReducer(state, { type: "undo" });
  assert.equal(state.present, original);
  assert.equal(state.future.length, 1);
  state = historyReducer(state, { type: "redo" });
  assert.equal(state.present.gajos.length, 3);
  state = historyReducer(state, { type: "undo" });
  state = historyReducer(state, { type: "edit", value: { gajos: ["E"] } });
  assert.equal(state.future.length, 0);
});

test("bulk import trims blank lines and refuses counts outside the supported range", () => {
  assert.deepEqual(parsePrizes(" A \r\nB\r\n\r\n C\nD "), ["A", "B", "C", "D"]);
  assert.throws(() => parsePrizes("A\nB\nC"));
  assert.throws(() => parsePrizes(Array(15).fill("A").join("\n")));
});

test("game settings default and clamp duration; palettes choose contrasting text", () => {
  assert.equal(normalizeGame().duracion, 6.2);
  assert.equal(normalizeGame({ duracion: 500 }).duracion, 12);
  assert.equal(normalizeGame({ duracion: -4 }).duracion, 2);
  assert.equal(normalizeGame({ sonido: false }).sonido, false);
  assert.equal(textColor("#ffffff"), "#111111");
  assert.equal(textColor("#000000"), "#ffffff");
});

test("proportional slices and pointer lookup agree across rotations and wraparound", () => {
  const prizes = [80, 0, 15, 5].map(probabilidad => ({ probabilidad }));
  for (const mode of ["iguales", "proporcionales"]) {
    const slices = wheelSlices(prizes, mode);
    assert.ok(Math.abs(slices.reduce((sum, p) => sum + p.span, 0) - 360) < 1e-8);
    for (const slice of slices.filter(p => p.span > 0)) {
      for (const fraction of [.02, .25, .5, .98]) {
        const target = slice.start + fraction * slice.span;
        for (const turns of [-5, 0, 5]) assert.equal(sliceAtPointer(slices, 360 * turns - target), slice.index);
      }
    }
  }
  assert.equal(wheelSlices(prizes, "proporcionales")[1].span, 0);
  assert.equal(sliceAtPointer(wheelSlices([0, 100, 0, 0].map(probabilidad => ({ probabilidad })), "proporcionales"), 180), 1);
});

test("effective probabilities redistribute only to eligible prizes", () => {
  const values = effectiveProbabilities([50, 25, 25, 0].map(probabilidad => ({ probabilidad })), [0]);
  assert.deepEqual(values.map(p => p.effective), [0, 50, 50, 0]);
  assert.equal(effectiveProbabilities([{ probabilidad: 100 }], [0])[0].effective, 0);
});

test("JSON import rejects unrelated data and supports both exported and draft copies", () => {
  const wheel = { gajos: ["A", "B", "C", "D"] };
  assert.equal(validateWheelImport(wheel), wheel);
  assert.equal(validateWheelImport({ version: 1, wheel }), wheel);
  for (const invalid of [null, {}, [], { gajos: [null, {}, false, 1] }, { gajos: ["A"] }]) assert.throws(() => validateWheelImport(invalid));
});
