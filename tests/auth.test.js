import test from "node:test";
import assert from "node:assert/strict";
import { STAFF_ROLES, roleHome, canAccess, loginUrlFor, bootAuth, isRiderRole } from "../spa/auth.js";

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

function mockBoot(t, { hash = "", status = 200, body = {} }) {
  const replaced = [];
  const events = [];
  const hadWindow = "window" in globalThis;
  const hadDocument = "document" in globalThis;
  const hadFetch = "fetch" in globalThis;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;

  globalThis.window = {
    location: {
      hash,
      replace(url) {
        replaced.push(url);
      },
    },
  };
  globalThis.document = {
    dispatchEvent(event) {
      events.push(event);
      return true;
    },
  };
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  t.after(() => {
    if (hadWindow) globalThis.window = originalWindow;
    else delete globalThis.window;
    if (hadDocument) globalThis.document = originalDocument;
    else delete globalThis.document;
    if (hadFetch) globalThis.fetch = originalFetch;
    else delete globalThis.fetch;
  });

  return { replaced, events };
}

test("bootAuth returns a staff user and announces it", async (t) => {
  const user = { role: "Admin", name: "Ada" };
  const { replaced, events } = mockBoot(t, { hash: "#/dashboard", body: { ok: true, user } });

  const result = await bootAuth();

  assert.equal(result, user);
  assert.equal(globalThis.window.currentUser, user);
  assert.deepEqual(replaced, []);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "userready");
  assert.equal(events[0].detail, user);
});

test("bootAuth sends non-staff roles to the rider page", async (t) => {
  const { replaced, events } = mockBoot(t, {
    hash: "#/deliveries?selected=9",
    body: { ok: true, user: { role: "Rider" } },
  });

  await assert.rejects(bootAuth(), /Staff access only/);
  assert.deepEqual(replaced, ["rider.html"]);
  assert.equal(events.length, 0);
});

test("bootAuth sends an expired session back to login with the current hash", async (t) => {
  const { replaced } = mockBoot(t, { hash: "#/deliveries?selected=9", status: 401 });

  await assert.rejects(bootAuth(), /Not authenticated/);
  assert.deepEqual(replaced, ["login.html?next=%23%2Fdeliveries%3Fselected%3D9"]);
});

test("bootAuth treats a missing role as not authenticated", async (t) => {
  const { replaced } = mockBoot(t, { hash: "#/reports", body: { ok: true, user: {} } });

  await assert.rejects(bootAuth(), /Not authenticated/);
  assert.deepEqual(replaced, ["login.html?next=%23%2Freports"]);
});

test("isRiderRole covers Rider and Driver only", () => {
  assert.equal(isRiderRole("Rider"), true);
  assert.equal(isRiderRole("Driver"), true);
  assert.equal(isRiderRole("Employee"), false);
});
