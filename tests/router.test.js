import test from "node:test";
import assert from "node:assert/strict";
import { ROUTES, parseHash, buildHash, normalizePath, routeFor } from "../spa/router.js";

test("parseHash reads path and query", () => {
  const out = parseHash("#/deliveries?selected=12");
  assert.equal(out.path, "deliveries");
  assert.equal(out.params.get("selected"), "12");
});

test("parseHash normalizes root and legacy hash", () => {
  assert.equal(parseHash("#/").path, "dashboard");
  assert.equal(parseHash("#dashboard").path, "dashboard");
  assert.equal(parseHash("").path, "dashboard");
});

test("buildHash writes path and query", () => {
  assert.equal(buildHash("deliveries", { selected: 12 }), "#/deliveries?selected=12");
  assert.equal(buildHash("dashboard"), "#/dashboard");
});

test("normalizePath trims hash and slashes", () => {
  assert.equal(normalizePath("#/live-map/"), "live-map");
  assert.equal(normalizePath("/reports/"), "reports");
});

test("routeFor returns known routes only", () => {
  assert.equal(routeFor("employees").title, "Employees");
  assert.equal(routeFor("nope"), null);
});

test("ROUTES contains all admin views", () => {
  assert.deepEqual(
    ROUTES.map((r) => r.path).sort(),
    ["customers", "dashboard", "deliveries", "drivers", "employees", "live-map", "reports", "settings"]
  );
});
