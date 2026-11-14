# Admin SPA Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gawing isang persistent SPA ang buong admin app na may grouped sidebar, topbar, page header, two-pane workspace, detail rail/insight panels, at hash routing — gamit ang existing data, themes, at APIs.

**Architecture:** Isang `index.html` shell + native ES-module view system. Hash router (`#/...`) ang navigation; bawat view ay `mount(root, ctx)` at cleanup function. Walang build step at walang backend change. Ang `login.html` at `rider.html` ay standalone pa rin.

**Tech Stack:** Static HTML, vanilla ES modules, existing `style.css` tokens, bagong `spa.css`, Leaflet/MapLibre (lazy), PHP APIs unchanged, Node built-in test runner para sa pure logic.

**Spec:** `docs/superpowers/specs/2026-11-14-admin-spa-shell-design.md`

## Global Constraints

- Admin SPA only: Dashboard, Deliveries, Live Map, Drivers, Customers, Employees, Reports, Settings. `login.html` at `rider.html` standalone.
- No backend/API/database changes. Existing endpoints at response shapes lang.
- Hash routing (`#/...`); walang `.htaccess` rewrite o server fallback.
- Existing tokens/themes at DM Sans lang; walang reference colors, bagong font, o bagong palette.
- Maps sa Live Map at Deliveries lang. Exception: existing Customer address-picker map sa Add/Edit modal.
- Bottom chart/insight panels sa Dashboard at Live Map lang.
- Walang invented ETA, truck, route geometry, o global search. Existing data lang.
- Preserve existing IDs kung praktikal (`dashboardButton`, `deliveriesButton`, `liveAccountButton`, etc.).
- Mobile: no page-level horizontal scroll at 390px; touch targets ≥44px.
- Test data only for destructive checks; no live-record deletion/editing.
- No commit/push/upload without explicit permission. Every commit step is a stop-and-ask checkpoint.
- Never print credentials/API keys.
- UI tasks use manual browser checks because the repo has no DOM test runner. Pure logic uses `node --test`.
- Do not add a build step, bundler, or runtime dependency. `package.json` is dev-only for Node tests.

## Review Focus

1. **Employee opens Settings:** dapat Profile/Security/Appearance lang; walang `api/users.php` call, user table, search, CTA, o detail rail. Test: Task 3 (`canAccess`) + Task 10 manual Employee check.
2. **Logged-out deep link:** `#/deliveries?selected=123` → login → same route after staff login; rider role goes to `rider.html`. Test: Task 3 (`loginUrlFor`) + Task 14 manual round-trip.
3. **Repeated route switching:** walang duplicate intervals/listeners/maps o `Map container is already initialized`; auto-refresh stops after unmount. Test: Task 11 at Task 12 repeated-navigation checks.
4. **Deliveries without coordinates:** selected delivery still shows details; map shows honest "No map location" message; walang fake pin/route. Test: Task 11 manual check.
5. **390px long content:** long names/emails/addresses/status labels wrap; no horizontal page scroll; chips scroll only inside their container. Test: Task 15 final viewport check.

---

## File Structure

### New files

- `package.json` — dev-only `"type": "module"` at `node --test` script; no dependencies.
- `spa.html` — temporary SPA entry during migration; cutover to `index.html`.
- `spa.css` — new shell/view layout, responsive, print; reuses `style.css` tokens.
- `spa/main.js` — boot auth, create shell, start router, mount/unmount views.
- `spa/router.js` — route table, hash parse/build, navigate, hashchange.
- `spa/auth.js` — `me`, role home, access guard, login URL, logout, 401 wrapper.
- `spa/api.js` — JSON fetch helper with abort signal.
- `spa/shell.js` — sidebar/topbar/page-meta slots, account menu, drawer, collapse.
- `spa/ui.js` — badges/chips/empty/loading/error, modals, toast, confirm.
- `spa/util.js` — escape/date/number/overdue/debounce.
- `spa/map-loader.js` — lazy Leaflet/MapLibre loader at map destroy helper.
- `spa/theme-picker.js` — thin wrapper for `window.renderThemePicker`.
- `spa/views/dashboard.js`
- `spa/views/deliveries.js`
- `spa/views/live-map.js`
- `spa/views/drivers.js`
- `spa/views/customers.js`
- `spa/views/employees.js`
- `spa/views/reports.js`
- `spa/views/settings.js`
- `tests/util.test.js`
- `tests/router.test.js`
- `tests/auth.test.js`
- `tests/ui.test.js`

### Modified files

- `theme.js` — expose `window.renderThemePicker(slot)` at `window.DeliveryTheme`; keep current auto-apply/picker behavior.
- `index.html` — becomes SPA shell at cutover.
- `dashboard.html`, `deliveries.html`, `live-map.html`, `drivers.html`, `customers.html`, `employees.html`, `reports.html`, `settings.html` — redirect stubs at cutover.
- `login.js` — staff redirect to SPA, preserve `next`.
- `rider.js` — back-to-dashboard redirect to SPA.
- `style.css` — only after parity: remove unused `.appPage`/`.liveMapPage` shell blocks; keep tokens/components used by login/rider/SPA.
- `app.js`, `dashScript.js`, old view JS — delete only after cutover/parity.

### Not modified

- `api/*` — no backend changes.
- `login.html` layout.
- `rider.html` layout/shell.
- `assets/` unless an icon is missing.

---

## Task 1: Test Harness + Shared Utilities

**Files:**
- Create: `package.json`
- Create: `tests/util.test.js`
- Create: `spa/util.js`

**Interfaces:**
- Produces:
  - `esc(value: unknown) -> string`
  - `fmtDate(isoDate: string) -> string` (e.g. `Nov 14, 2026`)
  - `fmtDateTime(sqlDateTime: string) -> string` (`-` kapag empty)
  - `todayKey() -> string` (`YYYY-MM-DD`)
  - `num(value: unknown) -> string` (`1,234`)
  - `isOverdue(delivery: { status: string, del_date: string }) -> boolean`
  - `debounce(fn: Function, wait?: number) -> Function`

- [ ] **Step 1: Create the dev-only Node test config**

`package.json`:

```json
{
  "name": "delivery-project-map",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests"
  }
}
```

No dependencies. This does not affect the static app.

- [ ] **Step 2: Write the failing utility tests**

`tests/util.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { esc, fmtDate, fmtDateTime, todayKey, num, isOverdue } from "../spa/util.js";

test("esc escapes HTML special characters", () => {
  assert.equal(esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
});

test("fmtDate formats ISO date", () => {
  assert.equal(fmtDate("2026-11-14"), "Nov 14, 2026");
});

test("fmtDateTime formats SQL datetime", () => {
  assert.match(fmtDateTime("2026-11-14 08:30:00"), /Nov 14, 2026/);
});

test("fmtDateTime returns dash for empty", () => {
  assert.equal(fmtDateTime(""), "-");
});

test("todayKey returns YYYY-MM-DD", () => {
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test("num adds thousands separators", () => {
  assert.equal(num(1234), "1,234");
});

test("isOverdue only for active past deliveries", () => {
  assert.equal(isOverdue({ status: "Pending", del_date: "2000-01-01" }), true);
  assert.equal(isOverdue({ status: "Delivered", del_date: "2000-01-01" }), false);
  assert.equal(isOverdue({ status: "Pending", del_date: todayKey() }), false);
  assert.equal(isOverdue({ status: "Pending", del_date: "" }), false);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/util.test.js`

Expected: FAIL — `Cannot find module .../spa/util.js`.

- [ ] **Step 4: Implement `spa/util.js`**

Exact signatures:

```js
export const esc = (value) => string;
export const fmtDate = (isoDate) => string;
export const fmtDateTime = (sqlDateTime) => string;
export const todayKey = () => string;
export const num = (value) => string;
export const isOverdue = (delivery) => boolean;
export function debounce(fn, wait = 150) -> Function;
```

Implementation notes:
- `esc` mapping: `& < > " '` → `&amp; &lt; &gt; &quot; &#39;`.
- `fmtDate` splits `YYYY-MM-DD` at local noon (avoid UTC off-by-one), uses `en-US` `{ month: "short", day: "numeric", year: "numeric" }`.
- `fmtDateTime` replaces space with `T`, uses `toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })`; invalid/empty → `-`.
- `isOverdue` = active status in `Pending/Processing/Out for Delivery` **and** `del_date` exists **and** `< todayKey()`.
- `debounce` clears previous timer.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/util.test.js`

Expected: PASS, 7 tests.

- [ ] **Step 6: Commit checkpoint**

Stop. Ask the user before committing:

```bash
git add package.json tests/util.test.js spa/util.js
git commit -m "test: add shared utility helpers"
```

If the user has not approved, continue without committing.

---

## Task 2: Hash Router

**Files:**
- Create: `tests/router.test.js`
- Create: `spa/router.js`

**Interfaces:**
- Consumes: `package.json` test config from Task 1.
- Produces:
  - `ROUTES: Array<{ path, title, group, roles }>`
  - `parseHash(hash: string) -> { path: string, params: URLSearchParams }`
  - `buildHash(path: string, params?: Record<string, string|number|null|undefined>) -> string`
  - `normalizePath(path: string) -> string`
  - `routeFor(path: string) -> Route | null`
  - `navigate(path: string, options?: { replace?: boolean }) -> void`
  - `startRouter(onRoute: (route: Route, params: URLSearchParams) => void) -> () => void`

- [ ] **Step 1: Write the failing router tests**

`tests/router.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/router.test.js`

Expected: FAIL — `Cannot find module .../spa/router.js`.

- [ ] **Step 3: Implement `spa/router.js`**

Route objects:

```js
export const ROUTES = [
  { path: "dashboard", title: "Dashboard", group: "Overview", roles: ["Admin", "Employee"] },
  { path: "live-map", title: "Live Map", group: "Operations", roles: ["Admin", "Employee"] },
  { path: "deliveries", title: "Deliveries", group: "Operations", roles: ["Admin", "Employee"] },
  { path: "drivers", title: "Drivers", group: "Operations", roles: ["Admin", "Employee"] },
  { path: "customers", title: "Customers", group: "Operations", roles: ["Admin", "Employee"] },
  { path: "reports", title: "Reports", group: "Insights", roles: ["Admin", "Employee"] },
  { path: "employees", title: "Employees", group: "Administration", roles: ["Admin"] },
  { path: "settings", title: "Settings", group: "Administration", roles: ["Admin", "Employee"] },
];
```

Behavior:
- `parseHash`: strip leading `#`, optional `/`, whitespace, trailing `/`; empty → `dashboard`; split `?`; `URLSearchParams`.
- Legacy hash `#dashboard` → `dashboard`.
- `buildHash`: `#/` + path; append `?` only for non-empty params; skip `null/undefined/""`.
- `navigate`: `location.hash = buildHash(...)`; `replace:true` uses `location.replace("#/...")`.
- `startRouter`: calls `onRoute` immediately with parsed route (or dashboard fallback), listens `hashchange`, returns cleanup that removes listener.
- Unknown path: caller (main) handles fallback; `routeFor` returns `null`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/router.test.js`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit checkpoint**

Ask permission, then:

```bash
git add tests/router.test.js spa/router.js
git commit -m "feat: add hash router"
```

---

## Task 3: Auth, Access Guard, and API Helper

**Files:**
- Create: `tests/auth.test.js`
- Create: `spa/auth.js`
- Create: `spa/api.js`

**Interfaces:**
- Consumes: router path names from Task 2.
- Produces:
  - `STAFF_ROLES: string[]`
  - `roleHome(role: string) -> "dashboard" | "rider"`
  - `canAccess(role: string, path: string) -> boolean`
  - `loginUrlFor(hash: string) -> string`
  - `bootAuth() -> Promise<User>`
  - `logout() -> Promise<void>`
  - `install401Handler(fetchImpl?: Function) -> void`
  - `apiJson(url: string, options?: RequestInit & { signal?: AbortSignal }) -> Promise<any>`

- [ ] **Step 1: Write the failing auth tests**

`tests/auth.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/auth.test.js`

Expected: FAIL — `Cannot find module .../spa/auth.js`.

- [ ] **Step 3: Implement `spa/auth.js` and `spa/api.js`**

`spa/api.js`:
```js
export async function apiJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
```

`spa/auth.js`:
- `STAFF_ROLES = ["Admin", "Employee"]`.
- `roleHome`: staff → `"dashboard"`, others → `"rider"`.
- `canAccess`: `false` for non-staff; `employees` only Admin; all other admin routes true for staff.
- `loginUrlFor`: include `?next=` only when `hash` starts with `#/`; `encodeURIComponent`.
- `bootAuth`:
  - `apiJson("api/auth.php?action=me")`; catch → `location.replace(loginUrlFor(location.hash))`.
  - role not staff → `location.replace("rider.html")`.
  - set `window.currentUser`, dispatch `userready`, return user.
- `logout`: `confirmBox` check is in shell/task 5; `apiJson("api/auth.php?action=logout", { method:"POST" })`; `location.replace("login.html")`.
- `install401Handler`: wrap `window.fetch` once; if `res.status === 401`, `location.replace(loginUrlFor(location.hash))`; keep the original wrapper guard (`window.__spa401Installed`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/auth.test.js`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit checkpoint**

Ask permission, then:

```bash
git add tests/auth.test.js spa/auth.js spa/api.js
git commit -m "feat: add spa auth and access guard"
```

---

## Task 4: SPA Entry, Shell, and Base CSS

**Files:**
- Create: `spa.html`
- Create: `spa.css`
- Create: `spa/shell.js`
- Create: `spa/main.js`
- Create: `spa/views/dashboard.js` (placeholder only; Task 6 replaces it)

**Interfaces:**
- Consumes: `ROUTES`, `parseHash`, `buildHash`, `routeFor`, `navigate`, `startRouter` (Task 2); `bootAuth`, `canAccess`, `roleHome`, `install401Handler` (Task 3); `esc` (Task 1).
- Produces:
  - `createShell(root, { user, route, navigate }) -> {
      setSearch(config|null),
      setCta(config|null),
      setPageMeta({title, group}),
      setActive(path),
      openDrawer(),
      closeDrawer(),
      destroy()
    }`
  - `mount(root, ctx) -> cleanup` for the placeholder dashboard.
  - `spa/main.js` wires auth, shell, router, view loading.

- [ ] **Step 1: Create the temporary SPA entry**

`spa.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delivery Project</title>
  <script src="theme.js?v=2"></script>
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="spa.css">
</head>
<body class="spaBody">
  <a class="skipLink" href="#mainContent" data-skip>Skip to content</a>
  <div id="app"></div>
  <script type="module" src="spa/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Define the shell CSS contract**

`spa.css` selectors to create:
- `.spaApp` — full viewport grid: `grid-template-columns: 248px minmax(0,1fr)`.
- `.spaSidebar`, `.spaSidebarCollapsed`, `.spaBrand`, `.spaCollapseBtn`.
- `.spaGroup`, `.spaGroupHead`, `.spaGroupBody`, `.spaNavLink`, `.spaNavLink.is-active`.
- `.spaTopbar`, `.spaBreadcrumb`, `.spaSearch`, `.spaCta`, `.spaAccount`.
- `.spaMain`, `.spaView`, `.spaViewHead`.
- `.spaDrawer`, `.spaBackdrop`, `.spaMobileMenu`.
- `.spaDetailRail`, `.spaSheet`.
- Responsive: `@media (max-width:1100px)` rail/overlay; `@media (max-width:719px)` drawer/single column.
- Reuse `var(--card)`, `var(--background)`, `var(--border)`, `var(--foreground)`, `var(--muted-foreground)`, `var(--secondary)`, `var(--accent)`, `var(--ring)`.
- No new color literals.

- [ ] **Step 3: Implement the shell markup/slots**

`createShell` renders:

- Sidebar brand + collapse button.
- Groups: Overview (Dashboard), Operations (Live Map, Deliveries, Drivers, Customers, Rider report), Insights (Reports), Administration (Employees, Settings).
- Nav links as `<a>` with existing IDs:
  `dashboardButton`, `deliveriesButton`, `driversButton`, `mapButton`, `customersButton`, `employeeButton`, `reportsButton`, `riderButton`, `settingsButton`.
- Footer: signed-in name/role + `sidebarLogoutButton`.
- Topbar: mobile menu button, breadcrumb, search slot, account button/menu (`liveAccountButton`, `liveAccountMenu`, `liveProfileButton`, `liveLogoutButton`), CTA slot.
- `<main id="mainContent" class="spaMain" tabindex="-1"><div id="viewRoot" class="spaView"></div></main>`.

Behavior:
- Clicking a nav link calls `navigate(routePath)`.
- Rider report is a normal `href="rider.html"` and is hidden for Employee.
- Collapse toggles `spaSidebarCollapsed`, persists `localStorage.setItem("spaSidebar", "collapsed"|"expanded")`.
- Drawer open/close toggles `aria-expanded`; Escape/backdrop close; focus returns to hamburger.
- Account menu: reuse Task 5's focus/menu behavior later; in this task, basic open/close + Profile/Logout callbacks.
- `setSearch({placeholder, value, onInput})`: show input, bind `input`; `null` hides.
- `setCta({label, onClick})`: show button; `null` hides.
- `setPageMeta`: update breadcrumb text and `document.title = `${title} | Delivery Project``.
- `setActive(path)`: set `aria-current="page"` and `.is-active`; open the active group.
- `destroy`: remove document/window listeners and timers.

- [ ] **Step 4: Implement `spa/main.js` boot**

Behavior:
1. `install401Handler()`.
2. `const user = await bootAuth()`.
3. `const shell = createShell(app, { user, route, navigate })`.
4. `startRouter(async (route, params) => { ... })`.
5. On route:
   - if no route → `navigate("dashboard", { replace:true })`.
   - if `!canAccess(user.role, route.path)` → `navigate("dashboard", { replace:true })`.
   - run previous cleanup; clear `#viewRoot`; abort previous fetch controller.
   - dynamic import the view module.
   - create `ctx`:
     ```js
     {
       user,
       route: { path: route.path, params },
       navigate,
       setQuery(params, opts) { ... buildHash(route.path, merged) ... },
       setSearch: shell.setSearch,
       setCta: shell.setCta,
       toast, confirm: confirmBox,
       signal: controller.signal,
       onCleanup(fn) { cleanups.push(fn); }
     }
     ```
   - `await view.mount(viewRoot, ctx)`; store returned cleanup.
   - shell.setActive(route.path); shell.setPageMeta(route); focus `#viewRoot h1` or `#viewRoot`.
6. On error: render `ui.errorState(message)` and keep shell usable.
7. `spa/main.js` view loader map:
   ```js
   const VIEWS = {
     dashboard: () => import("./views/dashboard.js"),
     deliveries: () => import("./views/deliveries.js"),
     "live-map": () => import("./views/live-map.js"),
     drivers: () => import("./views/drivers.js"),
     customers: () => import("./views/customers.js"),
     employees: () => import("./views/employees.js"),
     reports: () => import("./views/reports.js"),
     settings: () => import("./views/settings.js"),
   };
   ```
   Temporary: unbuilt routes may show a placeholder module until their task lands.

- [ ] **Step 5: Create the placeholder dashboard view**

`spa/views/dashboard.js`:
```js
export default {
  route: "dashboard",
  title: "Dashboard",
  group: "Overview",
  async mount(root) {
    root.innerHTML = `<div class="spaViewHead"><h1 tabindex="-1">Dashboard</h1><p>Loading…</p></div>`;
    return () => {};
  },
};
```

- [ ] **Step 6: Browser verification (manual)**

Log in as Admin. Open:
`http://localhost/DELIVERY_PROJECT_MAP/spa.html`

Expected:
- Sidebar groups and active Dashboard.
- Topbar breadcrumb `Overview / Dashboard`, avatar, empty search/CTA slots.
- No console errors.
- Collapse persists after reload.
- 390px: drawer opens/closes; no page-level horizontal scroll.
- Midnight theme readable.
- Skip link focuses main without changing hash.

If login walls the page, stop and ask the user to verify; do not print credentials.

- [ ] **Step 7: Commit checkpoint**

Ask permission, then:

```bash
git add spa.html spa.css spa/shell.js spa/main.js spa/views/dashboard.js
git commit -m "feat: add spa shell and entry"
```

---

## Task 5: Shared UI, Modal, Toast, and Confirm

**Files:**
- Create: `tests/ui.test.js`
- Create: `spa/ui.js`
- Modify: `spa.css` (modal/toast/confirm/detail-rail styles as needed)

**Interfaces:**
- Consumes: `esc` (Task 1).
- Produces:
  - `statusBadge(status: string) -> string`
  - `statusChip({ label, value, active }) -> string`
  - `emptyState({ title, message, actionLabel?, actionAttrs? }) -> string`
  - `loadingState(message?: string) -> string`
  - `errorState(message: string) -> string`
  - `openModal(modal: HTMLElement, options?: { focus?: string }) -> void`
  - `closeModal(modal: HTMLElement) -> void`
  - `initModalTrap(root?: Document|HTMLElement) -> () => void`
  - `toast(message: string, type?: "info"|"success"|"error") -> void`
  - `confirmBox(message: string) -> Promise<boolean>`

- [ ] **Step 1: Write the failing UI tests**

`tests/ui.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { statusBadge, emptyState, errorState } from "../spa/ui.js";

test("statusBadge maps known statuses", () => {
  assert.match(statusBadge("Pending"), /pendingBadge/);
  assert.match(statusBadge("Delivered"), /deliveredBadge/);
  assert.match(statusBadge("Cancelled"), /cancelledBadge/);
});

test("statusBadge escapes unknown status", () => {
  assert.equal(
    statusBadge(`<b>x</b>`),
    `<span class="statusBadge">&lt;b&gt;x&lt;/b&gt;</span>`
  );
});

test("emptyState escapes title and message", () => {
  const html = emptyState({ title: "<x>", message: `a & b` });
  assert.match(html, /&lt;x&gt;/);
  assert.match(html, /a &amp; b/);
});

test("errorState escapes message", () => {
  assert.match(errorState("<bad>"), /&lt;bad&gt;/);
});
```

`statusBadge` must call the shared `esc` from Task 1 as-is; these expectations already match its `&lt;`/`&gt;` mapping, so no extra escaping layer is allowed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/ui.test.js`

Expected: FAIL — `Cannot find module .../spa/ui.js`.

- [ ] **Step 3: Implement `spa/ui.js`**

Behavior:
- `statusBadge`: map existing statuses to `pendingBadge`, `processingBadge`, `outBadge`, `deliveredBadge`, `cancelledBadge`; unknown → `.statusBadge` only; always `esc(status)`.
- `statusChip`: returns a `<button type="button" class="spaChip" aria-pressed="...">`; caller binds click.
- `emptyState`: `<div class="spaEmpty"><strong>...</strong><p>...</p>...optional action...</div>`.
- `loadingState`: `<div class="spaLoading" role="status">Loading…</div>`.
- `errorState`: `<div class="spaError" role="alert">...</div>`.
- `openModal`: `modal.style.display = "flex"`, save opener in `modal._spaOpener`, focus first focusable or `[data-autofocus]`.
- `closeModal`: hide, restore opener focus if still connected.
- `initModalTrap`: one document-level Tab/Escape handler for topmost `[aria-modal="true"]`; return cleanup.
- `toast`: create `#toastHost`, append `.toast` with role alert/status, close button, auto-remove (error 7s, others 4s; multiline waits for close).
- `confirmBox`: overlay dialog, Cancel default, Escape/backdrop cancel, returns Promise<boolean>; destructive text starts with `Delete` uses danger button.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/ui.test.js`

Expected: PASS.

- [ ] **Step 5: Wire modal trap and toast into `main.js`**

In `spa/main.js`:
- call `initModalTrap()` once after shell render; store cleanup.
- pass `toast` and `confirmBox` into `ctx`.
- `logout` in shell uses `confirmBox`.

- [ ] **Step 6: Browser verification (manual)**

On `spa.html`:
- Use the browser console to call `window.__spaToast("Saved", "success")` only if exposed; otherwise verify via a later view that triggers toast.
- Open the account menu → Profile/Logout; Escape closes; focus returns.
- No console errors.

- [ ] **Step 7: Commit checkpoint**

Ask permission, then:

```bash
git add tests/ui.test.js spa/ui.js spa/main.js spa.css
git commit -m "feat: add shared spa ui"
```

---

## Task 6: Dashboard View

**Files:**
- Modify: `spa/views/dashboard.js` (replace placeholder)
- Modify: `spa.css` (dashboard grid/KPI/chart/status/recent styles)

**Interfaces:**
- Consumes: `ctx`, `apiJson`, `ui`, `util`.
- Produces: default view module `{ route:"dashboard", title:"Dashboard", group:"Overview", mount(root, ctx) }`.

- [ ] **Step 1: Implement the Dashboard markup and data**

Preserve existing IDs:
- `dashDate`, `dashUpdated`, `dashGreeting`
- `kpiTotal`, `kpiActive`, `kpiRate`, `kpiOverdue`
- `kpiTotalFoot`, `kpiActiveFoot`, `kpiRateFoot`, `kpiOverdueFoot`
- period select (7/30/year)
- `recentBody` or existing recent table body ID if practical.

Data: `api/dashboard.php?period=7|30|year`.

Render:
- Page header: greeting, date, updated status; secondary `Live Map` action.
- Topbar CTA: `+ New Delivery` → `ctx.navigate("deliveries", { ... })` with `new=1`.
- KPI grid: Total, Active, Delivery rate, Overdue.
- Main grid: activity chart + status breakdown.
- Bottom grid: recent deliveries + driver status.
- Chart accessible table/description.

Interactions:
- Period select reloads dashboard data.
- Recent rows: `View` → `ctx.navigate("deliveries")` (dashboard API has no delivery id; do not invent a selected id).
- `Live Map` → `ctx.navigate("live-map")`.
- `+ New Delivery` → `ctx.navigate("deliveries")` then `ctx.setQuery({ new: 1 })` or navigate to `#/deliveries?new=1`.

- [ ] **Step 2: Browser verification (manual)**

Log in as Admin; open `spa.html#/dashboard`.

Expected:
- KPI numbers match `api/dashboard.php`.
- Chart bars/labels match; period select changes data.
- Status breakdown and recent list populated.
- Recent `View` opens Deliveries.
- `+ New Delivery` opens Deliveries with Add modal intent.
- 390px: KPI 1 column; chart/status stack; no horizontal scroll.
- Midnight theme readable.
- Navigate away/back: no duplicate fetch loop; no console errors.

- [ ] **Step 3: Commit checkpoint**

Ask permission, then:

```bash
git add spa/views/dashboard.js spa.css
git commit -m "feat: add dashboard spa view"
```

---

## Task 7: Drivers View

**Files:**
- Create: `spa/views/drivers.js`
- Modify: `spa.css` (shared list/detail-rail styles if needed)

**Interfaces:**
- Consumes: `ctx`, `apiJson`, `ui`, `util`.
- Produces: default view module `{ route:"drivers", title:"Drivers", group:"Operations", mount(root, ctx) }`.

- [ ] **Step 1: Implement the Drivers view**

Preserve behavior:
- `api/drivers.php` GET.
- Search + status filter.
- Inline status `<select>` with `Available`, `On Route`, `Offline`; PUT `api/drivers.php?id=<id>` `{ status }`.
- Row actions: View, Edit.
- **No Delete button**; remove the dead delete branch from old code.
- Detail rail = view; retire the View modal.
- Edit modal posts PUT for existing, POST for new (POST returns 405 by design; preserve existing behavior/message).
- Empty/error/loading.
- Mobile: table → cards; detail rail → bottom sheet.

- [ ] **Step 2: Browser verification (manual)**

Open `spa.html#/drivers`.

Expected:
- Rows load; search/status filter works.
- Inline status change saves and persists after refresh.
- Row click selects and shows detail rail; View focuses rail.
- Edit modal saves name/contact/status.
- No Delete button.
- 390px: cards; bottom sheet; no horizontal scroll.
- Navigate away/back: no duplicate listeners.

- [ ] **Step 3: Commit checkpoint**

Ask permission, then:

```bash
git add spa/views/drivers.js spa.css
git commit -m "feat: add drivers spa view"
```

---

## Task 8: Employees View

**Files:**
- Create: `spa/views/employees.js`
- Modify: `spa.css` (shared list/detail-rail styles if needed)

**Interfaces:**
- Consumes: `ctx`, `apiJson`, `ui`, `util`.
- Produces: default view module `{ route:"employees", title:"Employees", group:"Administration", mount(root, ctx) }`.

- [ ] **Step 1: Implement the Employees view**

Preserve behavior:
- `api/users.php` GET (Admin only; route guard already blocks Employee).
- Search + role/status filters.
- Table columns and `[data-mobile-cards]`.
- Detail rail = view; include full name, username, email, contact, role, status, last login, linked driver code.
- No View modal; no create CTA.
- Empty/error/loading.

- [ ] **Step 2: Browser verification (manual)**

As Admin, open `spa.html#/employees`.

Expected:
- Rows load; filters/search work.
- Row click shows detail rail with last login.
- No create button; no console errors.
- As Employee, direct `#/employees` redirects to dashboard.
- 390px cards; no horizontal scroll.

- [ ] **Step 3: Commit checkpoint**

Ask permission, then:

```bash
git add spa/views/employees.js spa.css
git commit -m "feat: add employees spa view"
```

---

## Task 9: Customers View

**Files:**
- Create: `spa/views/customers.js`
- Modify: `spa.css` (shared list/detail-rail and customer modal styles)

**Interfaces:**
- Consumes: `ctx`, `apiJson`, `ui`, `util`, `map-loader` (Leaflet for modal only).
- Produces: default view module `{ route:"customers", title:"Customers", group:"Operations", mount(root, ctx) }`.

- [ ] **Step 1: Implement the Customers view**

Preserve behavior:
- `api/customers.php` GET/POST/PUT/DELETE.
- Search filter.
- Table columns and `[data-mobile-cards]`.
- Detail rail = view: name, contact, address, deliveries; actions Edit/Delete.
- No View modal.
- Add/Edit modal keeps existing address fields and Leaflet address picker; use `loadLeaflet()` only when the modal opens.
- Preserve address validation, field errors, reverse geocode, suggestions.
- Delete confirm; refresh list.
- Empty/error/loading.

- [ ] **Step 2: Browser verification (manual)**

Open `spa.html#/customers`.

Expected:
- Rows load; search works.
- Row click shows detail rail; Edit/Delete work.
- Add modal opens; address search/pin works; save creates a test customer.
- Delete the test customer; confirm.
- 390px cards; no horizontal scroll.
- Navigate away/back: map does not throw; no duplicate listeners.

- [ ] **Step 3: Commit checkpoint**

Ask permission, then:

```bash
git add spa/views/customers.js spa.css
git commit -m "feat: add customers spa view"
```

---

## Task 10: Settings View + Theme Picker

**Files:**
- Create: `spa/views/settings.js`
- Create: `spa/theme-picker.js`
- Modify: `theme.js` (expose picker)
- Modify: `spa.css` (settings cards/detail rail)

**Interfaces:**
- Consumes: `ctx`, `apiJson`, `ui`, `util`, `confirmBox`.
- Produces:
  - default view module `{ route:"settings", title:"Settings", group:"Administration", mount(root, ctx) }`
  - `renderThemePicker(slot: HTMLElement) -> void` in `spa/theme-picker.js`.
- `theme.js` exposes:
  - `window.DeliveryTheme = { THEMES, saved, apply }`
  - `window.renderThemePicker(slot)`

- [ ] **Step 1: Expose the theme picker in `theme.js`**

Keep the current auto-apply behavior. Add:
```js
window.DeliveryTheme = { THEMES, saved, apply };
window.renderThemePicker = function (slot) { /* existing picker creation */ };
```
Keep `DOMContentLoaded` auto-call for non-SPA pages. `spa/theme-picker.js`:
```js
export function renderThemePicker(slot) {
  window.renderThemePicker?.(slot);
}
```

- [ ] **Step 2: Implement the Settings view**

Admin:
- Profile, Security, Appearance cards.
- `renderThemePicker(themeSlot)` after mount.
- User accounts table + detail rail.
- Topbar search + `+ Add User` CTA.
- Row actions: Edit, Reset Password, Delete.
- Edit modal includes Active/Disabled status; Reset Password modal; Add User modal.
- Preserve password/profile validation and API payloads.

Employee:
- Profile, Security, Appearance only.
- No user search/CTA/table/rail; do not call `api/users.php`.
- Preserve current `settings.js` hiding behavior in SPA form.

- [ ] **Step 3: Browser verification (manual)**

As Admin:
- `spa.html#/settings` loads profile/security/theme.
- Theme picker changes theme and persists after reload.
- User table loads; Edit/Reset/Delete work on a **test user** only.
- Add User creates a test user; delete it after.
- Detail rail selects user.

As Employee:
- Settings loads only the three cards.
- No user table, search, CTA, or rail.
- No `api/users.php` request in Network tab.

- [ ] **Step 4: Commit checkpoint**

Ask permission, then:

```bash
git add spa/views/settings.js spa/theme-picker.js theme.js spa.css
git commit -m "feat: add settings spa view"
```

---

## Task 11: Deliveries View + Map

**Files:**
- Create: `spa/views/deliveries.js`
- Create/Modify: `spa/map-loader.js` (Leaflet loader; can be introduced here)
- Modify: `spa.css` (deliveries list/map/details/modal styles)

**Interfaces:**
- Consumes: `ctx`, `apiJson`, `ui`, `util`, `map-loader`, `loadLeaflet()`.
- Produces:
  - default view module `{ route:"deliveries", title:"Deliveries", group:"Operations", mount(root, ctx) }`
  - `loadLeaflet() -> Promise<typeof L>`
  - `destroyMap(map: L.Map) -> void`

- [ ] **Step 1: Implement `spa/map-loader.js`**

Behavior:
- `loadLeaflet()` injects Leaflet CSS/JS once, caches promise, resolves `window.L`.
- `loadLiveMapLibs()` is added in Task 12.
- `destroyMap(map)` calls `map.remove()` if available; null-safe.
- Reject with `new Error("Map unavailable")` on load failure.

- [ ] **Step 2: Implement the Deliveries view**

Layout:
- Page header: title/subtitle; status chips All/Pending/Processing/Out for Delivery/Delivered/Cancelled; driver select; date input; `+ New Delivery` CTA.
- Left list 380px: row cards with status, delivery number, customer, driver, date, stop count; selected highlight.
- Right: map top; selected delivery details bottom.
- Details panel: summary + actions View/Edit/Status/History/Delete.
- Keep the View modal for full details/stops; keep Add/Edit, Status, History modals.
- Mobile: list, map, details bottom sheet.

Data:
- `api/deliveries.php` list, `?id=`, `?action=stops`, `?action=events`.
- `api/customers.php` and `api/drivers.php` for filters and coordinates.
- Map pins: match selected delivery customer/stop names to customer coords; match by name + address when possible. No route line.
- No coords → map message "No map location for this customer yet."

Behavior:
- Search/filter client-side.
- 30s auto-refresh, paused when hidden or modal/sheet open; clear on cleanup.
- Row select updates map/details and `?selected=`.
- `?new=1` opens Add modal after load; remove query.
- Preserve validation, confirmations, API payloads.
- Empty/error/loading per pane.

- [ ] **Step 3: Browser verification (manual)**

Open `spa.html#/deliveries`.

Expected:
- List/filters/search work.
- Select a delivery: map shows destination pin; details panel updates; URL gets `?selected=`.
- Select a delivery with no coords: honest message; details still work.
- Add/Edit/Status/History/Delete work on a **test delivery** only; clean up.
- `#/deliveries?new=1` opens Add modal once.
- Auto-refresh stops when navigating away; no duplicate intervals; no console errors.
- 390px: cards; map; details sheet; no horizontal scroll.

- [ ] **Step 4: Commit checkpoint**

Ask permission, then:

```bash
git add spa/views/deliveries.js spa/map-loader.js spa.css
git commit -m "feat: add deliveries spa view"
```

---

## Task 12: Live Map View

**Files:**
- Create: `spa/views/live-map.js`
- Modify: `spa/map-loader.js` (add `loadLiveMapLibs`)
- Modify: `spa.css` (live map list/map/insights/controls)

**Interfaces:**
- Consumes: `ctx`, `apiJson`, `ui`, `util`, `map-loader`.
- Produces:
  - default view module `{ route:"live-map", title:"Live Map", group:"Operations", mount(root, ctx) }`
  - `loadLiveMapLibs() -> Promise<{ L, maplibregl }>`

- [ ] **Step 1: Add live-map library loading**

`loadLiveMapLibs()` loads once:
- Leaflet CSS/JS
- MapLibre CSS/JS
- `@maplibre/maplibre-gl-leaflet` plugin
- resolves `{ L: window.L, maplibregl: window.maplibregl }`.

- [ ] **Step 2: Implement the Live Map view**

Layout:
- Page header: title, updated status, chips All/Live/Stale; search filters rider list.
- Left list 380px: rider cards with status dot, name, active delivery count, last update, stop preview.
- Right: map top; bottom insight panels:
  - Route overview: segmented bar per stop using existing route leg `km` + total; "straight line" note.
  - Rider details: selected rider, last update, active count, stops/customers, distance.
- Floating controls: zoom, fit selected, style picker, scale.
- Mobile: list, map, insights stacked; list drawer optional.

Data:
- `api/route.php`, `api/location.php`.
- Existing 10s location refresh, 60s delivery refresh; clear on cleanup; pause hidden.
- No drivers API merge; no "No active delivery" bucket; chips All/Live/Stale.

Behavior:
- Select rider → route/stops, details, route overview, `?rider=`.
- Refresh CTA manual refresh.
- Map style persists via `theme.js`.
- Escape closes mobile list/detail sheet.
- Empty state when no riders.

- [ ] **Step 3: Browser verification (manual)**

Open `spa.html#/live-map`.

Expected:
- Rider list loads; search/chips filter.
- Select rider: map draws route/stops; details and route overview update; URL gets `?rider=`.
- Refresh updates timestamps.
- Style picker Street/Topo/Satellite works; Topo uses MapLibre or falls back.
- Navigate away/back 3×: no duplicate intervals/maps; no "Map container is already initialized".
- 390px: map/list/insights stack; no horizontal scroll.
- Midnight theme readable.

- [ ] **Step 4: Commit checkpoint**

Ask permission, then:

```bash
git add spa/views/live-map.js spa/map-loader.js spa.css
git commit -m "feat: add live map spa view"
```

---

## Task 13: Reports View

**Files:**
- Create: `spa/views/reports.js`
- Modify: `spa.css` (reports grid/detail rail/print)

**Interfaces:**
- Consumes: `ctx`, `apiJson`, `ui`, `util`.
- Produces: default view module `{ route:"reports", title:"Reports", group:"Insights", mount(root, ctx) }`.

- [ ] **Step 1: Implement the Reports view**

Layout:
- Page header: title/subtitle; From/To date inputs; Generate, Reset, Export CSV, Print; rider filter.
- Summary cards: Total Deliveries, Delivered, Cancelled, Delivered Rate.
- Main: two-column report table grid (Rider Report, By Driver, By Customer, By Month) + right "Report snapshot" detail rail.
- Detail rail: period totals + selected row breakdown; proof photo link if selected rider report row.
- Print: only report content; hide shell/sidebar/topbar/filters/detail rail; reuse `.printInfo`.

Data:
- `api/reports.php` only.
- Preserve CSV logic: `csvCell`, BOM, hyperlink, date validation.
- Preserve print period.

- [ ] **Step 2: Browser verification (manual)**

Open `spa.html#/reports`.

Expected:
- Generate loads summary/tables.
- Invalid From > To shows existing message.
- Rider filter works.
- Export CSV downloads.
- Print preview hides chrome and shows report tables.
- Detail rail updates on row select.
- 390px stacks; no horizontal page scroll.

- [ ] **Step 3: Commit checkpoint**

Ask permission, then:

```bash
git add spa/views/reports.js spa.css
git commit -m "feat: add reports spa view"
```

---

## Task 14: Cutover, Legacy Redirects, and Login/Rider Links

**Files:**
- Modify: `index.html` (replace with SPA shell)
- Modify: `dashboard.html`, `deliveries.html`, `live-map.html`, `drivers.html`, `customers.html`, `employees.html`, `reports.html`, `settings.html` (redirect stubs)
- Modify: `login.js`
- Modify: `rider.js`
- Modify/remove: `spa.html` (keep as redirect to `index.html` or remove)

**Interfaces:**
- Consumes: all views and shell from Tasks 4–13.
- Produces: production entry at `index.html#/...`; legacy `.html` URLs redirect.

- [ ] **Step 1: Make `index.html` the SPA shell**

Copy `spa.html` content into `index.html`; update `<title>` and module path as needed. Keep `spa.html` as a redirect to `index.html` for one verification pass, or remove it after.

- [ ] **Step 2: Replace old admin pages with redirect stubs**

Exact stub template per file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0;url=index.html#/dashboard">
  <title>Redirecting…</title>
</head>
<body>
  <a href="index.html#/dashboard">Open Dashboard</a>
</body>
</html>
```

Replace the hash per page:
- `dashboard.html` → `#/dashboard`
- `deliveries.html` → `#/deliveries`
- `live-map.html` → `#/live-map`
- `drivers.html` → `#/drivers`
- `customers.html` → `#/customers`
- `employees.html` → `#/employees`
- `reports.html` → `#/reports`
- `settings.html` → `#/settings`

- [ ] **Step 3: Update `login.js` redirects**

- `goTo(role, next)`:
  - staff + valid `next` (`#/...`) → `index.html` + `next`.
  - staff without next → `index.html#/dashboard`.
  - rider/Driver → `rider.html`.
- Read `next` from `new URLSearchParams(location.search).get("next")`.
- On submit, do **not** blindly use server `data.redirect`; use role + `next`.
- Keep existing error handling/validation.

- [ ] **Step 4: Update `rider.js`**

- Replace `window.location.href = "dashboard.html"` with `window.location.href = "index.html#/dashboard"`.
- No layout/shell change.

- [ ] **Step 5: Browser verification (manual)**

Expected:
- `index.html` loads SPA shell; default `#/dashboard`.
- Each old admin `.html` URL redirects to the right hash.
- Logged-out `#/deliveries?selected=123` → login → returns to same route after Admin/Employee login.
- Rider login → `rider.html`; `next` not restored.
- Rider back button → `index.html#/dashboard`.
- Refresh on every hash route works.
- Browser back/forward works.
- Employee direct `#/employees` → dashboard.
- No console errors.

- [ ] **Step 6: Commit checkpoint**

Ask permission, then:

```bash
git add index.html spa.html dashboard.html deliveries.html live-map.html drivers.html customers.html employees.html reports.html settings.html login.js rider.js
git commit -m "feat: cut over admin app to spa"
```

---

## Task 15: Cleanup and Final Verification

**Files:**
- Delete: `app.js`, `dashScript.js`, `dashboard.js`, `deliveries.js`, `drivers.js`, `customers.js`, `employees.js`, `reports.js`, `settings.js`, `live-map.js` (only after cutover parity)
- Modify: `style.css` (remove unused `.appPage`/`.liveMapPage` shell blocks only after grep verification)
- Modify: `spa.css` (final print/responsive fixes)
- Modify: `docs/superpowers/specs/2026-11-14-admin-spa-shell-design.md` only if implementation reveals a factual correction (not for scope changes)

**Interfaces:**
- No new interfaces; final parity/cleanup.

- [ ] **Step 1: Remove dead old admin scripts**

Before deleting, verify no remaining references:

```bash
# Run from repo root; expected: only old stubs/history references, no app entry references.
Select-String -Path *.html,*.js -Pattern 'app\.js|dashScript\.js|dashboard\.js|deliveries\.js|drivers\.js|customers\.js|employees\.js|reports\.js|settings\.js|live-map\.js'
```

Delete only the files with no references from the SPA entry, login, rider, or stubs.

- [ ] **Step 2: Remove dead shell CSS conservatively**

- `Select-String -Path style.css -Pattern 'appPage|liveMapPage'` to find scoped blocks.
- Remove only blocks whose selectors are all `.appPage`/`.liveMapPage` and are not used by login/rider/SPA.
- Keep tokens, `.headerSec`, `.riderPage`, map/token/component styles.
- Verify braces:

```powershell
$t = Get-Content style.css -Raw
"open=$(([regex]::Matches($t,'\{')).Count) close=$(([regex]::Matches($t,'\}')).Count)"
```

Expected: equal counts.

- [ ] **Step 3: Final automated checks**

Run:

```bash
node --test tests
```

Expected: all tests PASS.

Run static checks:

```bash
Select-String -Path spa\*.js,spa\views\*.js -Pattern 'console\.log|debugger'
```

Expected: no debug statements left (except intentional `console.error` diagnostics).

- [ ] **Step 4: Final manual matrix**

As Admin, Employee, and Rider/Driver:

- Auth: login/logout, `next` round-trip, 401, role guards.
- Routes: refresh every hash, back/forward, unknown hash → dashboard, legacy stubs.
- Layout: 1440/1280/1024/768/390; sidebar expanded/collapsed/drawer; no horizontal scroll.
- Themes: Lime, Ocean, Sunset, Midnight spot check.
- Dashboard: KPI/chart/period/recent/New Delivery.
- Deliveries: list/filters/map pin/no-coords message/test-record CRUD/auto-refresh.
- Live Map: rider select/route/insights/refresh/style/cleanup.
- Drivers/Customers/Employees: list/detail rail/actions.
- Settings: Admin users; Employee profile-only.
- Reports: generate/filter/export/print.
- Accessibility: keyboard, focus, Escape, labels, reduced motion.
- Console/Network: no repeated map libs, no duplicate intervals, no errors.

If login-walled, stop and hand the checklist to the user; do not print credentials.

- [ ] **Step 5: Commit checkpoint**

Ask permission, then:

```bash
git add -A
git commit -m "chore: clean up legacy admin spa code"
```

---

## Plan Self-Check (completed while writing)

- **Spec coverage:** all 8 admin routes, shell, topbar, page header, detail rail, map views, bottom panels, theme, print, role guard, deep links, legacy stubs, cleanup.
- **Step scan:** pure logic tasks have failing tests first; UI tasks have exact browser checks; no TBD steps.
- **Type consistency:** `createShell` slots, `ctx` shape, view module contract, router signatures, and `loadLeaflet`/`loadLiveMapLibs` names are reused consistently.
- **Review Focus:** each of the 5 failure modes has a test/manual check in its owning task.
- **Proportion:** plan references the spec for layout details; code blocks are limited to tests/contracts, not full view bodies.
