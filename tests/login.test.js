import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// login.js is a classic page script, so run the real file inside a small DOM mock.
const LOGIN_SRC = readFileSync(new URL("../login.js", import.meta.url), "utf8");

const makeElement = () => ({
  style: {},
  textContent: "",
  value: "",
  type: "password",
  disabled: false,
  listeners: {},
  addEventListener(type, fn) {
    this.listeners[type] = fn;
  },
  removeAttribute() {},
  setAttribute() {},
  focus() {},
});

function createPage({ search = "", me = { ok: false }, login = null }) {
  const elements = {
    loginForm: makeElement(),
    loginError: makeElement(),
    loginBtn: makeElement(),
    password: makeElement(),
    showPw: makeElement(),
    username: makeElement(),
  };
  const replaced = [];
  const calls = [];

  const page = {
    window: {
      location: {
        search,
        replace(url) {
          replaced.push(url);
        },
      },
    },
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
    },
    fetch: async (url) => {
      calls.push(String(url));
      if (String(url).includes("action=me")) {
        return { ok: Boolean(me.ok), json: async () => me };
      }
      return { ok: true, json: async () => login || { ok: false, error: "Login failed." } };
    },
  };

  const sandbox = {
    window: page.window,
    document: page.document,
    fetch: page.fetch,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(LOGIN_SRC, sandbox, { filename: "login.js" });

  return { elements, replaced, calls };
}

async function submitLogin(page, username = "admin", password = "secret") {
  page.elements.username.value = username;
  page.elements.password.value = password;
  await page.elements.loginForm.listeners.submit({ preventDefault() {} });
}

test("staff login without next lands on the SPA dashboard", async () => {
  const page = createPage({ login: { ok: true, role: "Admin", redirect: "dashboard.html" } });
  await submitLogin(page);
  assert.deepEqual(page.replaced, ["index.html#/dashboard"]);
});

test("staff login returns to the deep link instead of the server redirect", async () => {
  const page = createPage({
    search: "?next=%23%2Fdeliveries%3Fselected%3D123",
    login: { ok: true, role: "Employee", redirect: "dashboard.html" },
  });
  await submitLogin(page);
  assert.deepEqual(page.replaced, ["index.html#/deliveries?selected=123"]);
});

test("rider and driver logins ignore next and open the rider page", async () => {
  for (const role of ["Rider", "Driver"]) {
    const page = createPage({
      search: "?next=%23%2Fdeliveries",
      login: { ok: true, role, redirect: "rider.html" },
    });
    await submitLogin(page);
    assert.deepEqual(page.replaced, ["rider.html"], role);
  }
});

test("login ignores a next value that is not an in-app hash", async () => {
  const page = createPage({
    search: "?next=https%3A%2F%2Fevil.example%2F",
    login: { ok: true, role: "Admin" },
  });
  await submitLogin(page);
  assert.deepEqual(page.replaced, ["index.html#/dashboard"]);
});

test("failed login shows the error and stays on the page", async () => {
  const page = createPage({ login: { ok: false, error: "Invalid credentials." } });
  await submitLogin(page);
  assert.deepEqual(page.replaced, []);
  assert.equal(page.elements.loginError.textContent, "Invalid credentials.");
  assert.equal(page.elements.loginError.style.display, "block");
  assert.equal(page.elements.password.value, "");
  assert.equal(page.elements.loginBtn.disabled, false);
});

test("already signed-in staff go straight to their next destination", async () => {
  const page = createPage({
    search: "?next=%23%2Freports%3Ffrom%3D2026-11-01",
    me: { ok: true, user: { role: "Admin" } },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(page.replaced, ["index.html#/reports?from=2026-11-01"]);
});

test("already signed-in riders go straight to the rider page", async () => {
  const page = createPage({
    search: "?next=%23%2Freports",
    me: { ok: true, user: { role: "Driver" } },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(page.replaced, ["rider.html"]);
});
