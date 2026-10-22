import assert from "node:assert/strict";
import test from "node:test";
import { asRegistry, asShapeList, asViolations } from "../src/workspaces/OntologyWorkspace/shaclView";

test("shape list does not throw when API omits constraints", () => {
  const rows = asShapeList([
    { id: "https://ex/ThingShape", targetClass: "https://ex/Thing", label: "Thing" },
    { uri: "https://ex/OtherShape" },
    null,
    { id: "" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].target_class, "https://ex/Thing");
  assert.deepEqual(rows[0].constraints, []);
  assert.equal(rows[0].constraint_count, 0);
  assert.equal(rows[0].constraints.join(","), "");
});

test("registry and violations tolerate non-arrays", () => {
  assert.deepEqual(asRegistry({ error: "NO" }), []);
  assert.deepEqual(asViolations(undefined), []);
  assert.equal(asRegistry([{ uri: "https://ex/a", name: "A" }])[0].name, "A");
});
