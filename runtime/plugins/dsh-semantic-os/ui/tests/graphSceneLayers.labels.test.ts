import test from "node:test";
import assert from "node:assert/strict";

import {
  placeRegionLabel,
  truncateRegionLabel,
} from "../src/workspaces/GraphWorkspace/graphSceneLayers.ts";

test("truncateRegionLabel keeps short type names intact", () => {
  assert.equal(truncateRegionLabel("owl:Class"), "owl:Class");
  assert.equal(truncateRegionLabel("a".repeat(30)).endsWith("…"), true);
});

test("placeRegionLabel moves the cluster title off a node sitting on the centroid", () => {
  const centroid = { x: 400, y: 240 };
  const box = { width: 88, height: 22 };
  const placed = placeRegionLabel(centroid, box, [
    { x: 400, y: 240, radius: 18 },
  ]);

  assert.ok(placed, "should find a free slot");
  assert.ok(Math.abs(placed.y - centroid.y) >= box.height + 20, `label stayed on the node at y=${placed.y}`);
  const left = placed.x - box.width / 2;
  const right = placed.x + box.width / 2;
  const top = placed.y - box.height / 2;
  const bottom = placed.y + box.height / 2;
  const nearestX = Math.max(left, Math.min(400, right));
  const nearestY = Math.max(top, Math.min(240, bottom));
  const dx = 400 - nearestX;
  const dy = 240 - nearestY;
  assert.ok(dx * dx + dy * dy >= 18 * 18, "label box still overlaps the node");
});

test("placeRegionLabel keeps the first free slot when the centroid is empty", () => {
  const placed = placeRegionLabel({ x: 200, y: 200 }, { width: 80, height: 22 }, []);
  assert.ok(placed);
  assert.equal(placed.x, 200);
  assert.equal(placed.y, 200 - 22 - 28);
});

test("placeRegionLabel sits above a dense owl:Class cloud instead of on its centroid", () => {
  const bounds = { minX: 300, minY: 180, maxX: 520, maxY: 360 };
  const centroid = { x: 410, y: 270 };
  const box = { width: 88, height: 22 };
  const obstacles = [];
  for (let x = 310; x <= 510; x += 16) {
    for (let y = 190; y <= 350; y += 16) {
      obstacles.push({ x, y, radius: 10 });
    }
  }
  const placed = placeRegionLabel(centroid, box, obstacles, bounds);
  assert.ok(placed, "should escape above the cloud");
  assert.ok(placed.y <= bounds.minY - 10, `label y=${placed.y} still inside the cloud`);
});

test("placeRegionLabel returns null when every slot is blocked", () => {
  const box = { width: 80, height: 22 };
  const obstacles = [
    { x: 200, y: 200, radius: 400 },
  ];
  const placed = placeRegionLabel(
    { x: 200, y: 200 },
    box,
    obstacles,
    { minX: 160, minY: 160, maxX: 240, maxY: 240 },
  );
  assert.equal(placed, null);
});
