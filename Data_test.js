import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateCost, defaultModels } from "./app.js";

const TOLERANCE = 5e-5;
const findModel = (name) => defaultModels.find((m) => m.name === name);

const testCases = {
  "MiniMax M3": [
    { totalInput: 156948, cacheRead: 155898, output: 685, expected: 0.0035 },
    { totalInput: 159405, cacheRead: 159253, output: 99, expected: 0.0032 },
    { totalInput: 180960, cacheRead: 180919, output: 10107, expected: 0.0077 },
    { totalInput: 155679, cacheRead: 153179, output: 2011, expected: 0.0041 },
    { totalInput: 153193, cacheRead: 150066, output: 63, expected: 0.0033 },
    { totalInput: 157811, cacheRead: 1906, output: 1998, expected: 0.0164 }
  ],
  "GLM-5.2": [
    { totalInput: 67725, cacheRead: 59549, output: 4121, expected: 0.0451 },
    { totalInput: 59550, cacheRead: 60, output: 172, expected: 0.0841 },
    { totalInput: 70349, cacheRead: 48530, output: 7203, expected: 0.0749 },
    { totalInput: 1327, cacheRead: 25, output: 116, expected: 0.0023 }
  ]
};

describe("calculateCost", () => {
  for (const [modelName, rows] of Object.entries(testCases)) {
    describe(modelName, () => {
      rows.forEach((row, i) => {
        it(`case ${i + 1}: in=${row.totalInput} cache=${row.cacheRead} out=${row.output} -> $${row.expected}`, () => {
          const model = findModel(modelName);
          assert.ok(model, `Model "${modelName}" not found in defaultModels`);
          const input = Math.max(0, row.totalInput - row.cacheRead);
          const cost = calculateCost(model, input, row.output, row.cacheRead);
          assert.ok(
            Math.abs(cost - row.expected) <= TOLERANCE,
            `cost ${cost.toFixed(6)} != expected ${row.expected} (tol ${TOLERANCE})`
          );
        });
      });
    });
  }
});
