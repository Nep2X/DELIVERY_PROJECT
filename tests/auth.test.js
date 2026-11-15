import test from "node:test";
import assert from "node:assert/strict";
import { STAFF_ROLES, roleHome, canAccess, loginUrlFor } from "../spa/auth.js";

test("staff roles are Admin and Employee", () => {
  assert.deepEqual(STAFF_ROLES, ["Admin", "Employee"]);
});

test("roleHome sends staff to dashboard and riders to rider", () => {
  assert.equal(roleHome("Admin"), "dashboard");
  assert.equal(roleHome("Employee"), "dashboard");
  assert.equal(roleHome("Rider"), "rider");
  assert.equal(roleHome("Driver"), "rider");
});

test("Employee cannot access employees but can access settings", () => {
  assert.equal(canAccess("Employee", "employees"), false);
  assert.equal(canAccess("Employee", "settings"), true);
  assert.equal(canAccess("Employee", "deliveries"), true);
});

test("Admin can access employees", () => {
  assert.equal(canAccess("Admin", "employees"), true);
});

test("rider roles get no admin route access", () => {
  assert.equal(canAccess("Rider", "dashboard"), false);
  assert.equal(canAccess("Driver", "settings"), false);
});

test("loginUrlFor preserves a valid hash", () => {
  assert.equal(
    loginUrlFor("#/deliveries?selected=123"),
    "login.html?next=%23%2Fdeliveries%3Fselected%3D123"
  );
});

test("loginUrlFor omits next for empty/invalid hash", () => {
  assert.equal(loginUrlFor(""), "login.html");
  assert.equal(loginUrlFor("#pageContent"), "login.html");
});
