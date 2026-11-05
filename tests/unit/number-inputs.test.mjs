// Every <input type="number"> must carry onWheel={blurOnWheel}.
//
// A focused number input treats the scroll wheel as increment/decrement, so a
// person types a value, scrolls the page, and the number silently changes
// under the cursor (CLAUDE.md, "eats the scroll wheel"). That rule was kept by
// a count in CLAUDE.md, and the count drifted: the Round 1 candidate score on
// the admin desk arrived without the guard, so scrolling past it changed the
// score a candidate was advanced or rejected on. A test does not drift.
//
// It reads each element up to its closing "/>". A regex that stops at ">" is
// wrong here: it stops at the first "=>" inside an onChange handler and
// reports a guarded input as unguarded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync("git ls-files app components", { encoding: "utf8" })
  .split("\n")
  .filter((f) => f.endsWith(".tsx"));

function numberInputs(src) {
  const found = [];
  let i = 0;
  while ((i = src.indexOf('type="number"', i)) !== -1) {
    const start = src.lastIndexOf("<input", i);
    const end = src.indexOf("/>", i);
    found.push({ line: src.slice(0, i).split("\n").length, el: src.slice(start, end) });
    i += 1;
  }
  return found;
}

test("every number input blurs on wheel", () => {
  const missing = [];
  let total = 0;
  for (const f of files) {
    for (const { line, el } of numberInputs(readFileSync(f, "utf8"))) {
      total += 1;
      if (!/onWheel=\{blurOnWheel\}/.test(el)) missing.push(`${f}:${line}`);
    }
  }
  assert.ok(total > 0, "found no number inputs at all; the scan is broken");
  assert.deepEqual(missing, [], `number inputs without onWheel={blurOnWheel}:\n  ${missing.join("\n  ")}`);
});

test("the scan reads past arrow functions inside attributes", () => {
  // The bug in the obvious regex: it stops at the ">" of "=>".
  const src = `<input type="number" onChange={(e) => set(e.target.value)} onWheel={blurOnWheel} />`;
  const [one] = numberInputs(src);
  assert.match(one.el, /onWheel=\{blurOnWheel\}/);
});
