# Live Map Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gawing map-first ang Live Map page: rail + dikit na Riders panel, mapa sa gitna, floating delivery-details panel, top bar overlay na may account circle, at bottom-right map controls — same colors at existing data.

**Architecture:** CSS-only layout shell na naka-scope sa `body.liveMapPage`, plus minimal DOM/JS wiring para sa details panel, riders drawer, at account menu. Existing IDs (`#map`, `#list`, `#riderCount`, `#updated`) at existing route rendering ang pananatilihin. Walang API o database change.

**Tech Stack:** Vanilla HTML/CSS/JS, Leaflet 1.9.4, MapLibre GL, existing `style.css` tokens.

**Spec:** `docs/superpowers/specs/2026-11-09-live-map-shell-design.md`

## Global Constraints

- Live Map page only: `live-map.html`, `style.css`, `live-map.js`.
- Walang color/theme changes. Existing tokens lang: `--card`, `--background`, `--secondary`, `--border`, `--border-soft`, `--foreground`, `--muted-foreground`, `--primary`, `--accent`.
- Walang API, database, o `api/route.php` changes.
- Walang pagbabago sa ibang pages. Lahat ng bagong CSS ay naka-scope sa `.liveMapPage`.
- Mobile touch targets ≥44px.
- Walang horizontal scroll sa 390px width.
- Assistant must not edit website files; exact Find/Replace lang, isa-isa.
- No commit/push/upload without explicit permission.
- Huwag i-print ang credentials.

## Review Focus

- **Walang rider o walang selection:** right panel dapat may placeholder, hindi blangko o hidden ang layout.
- **Mahahabang customer name/address:** right panel at rider card dapat mag-wrap, walang horizontal overflow.
- **Mobile 390px, details open:** bottom sheet hindi dapat mag-cover sa close button o magdulot ng horizontal scroll.
- **Midnight theme:** lahat ng bagong control dapat readable gamit existing tokens, walang hardcoded color.
- **Keyboard:** `Escape` dapat magsara sa account menu at riders drawer; visible ang focus sa lahat ng bagong button.
- **Narrow desktop (851–1100px):** Riders panel, mapa, at floating panel dapat hindi mag-overlap nang sira.

---

### Task 1: HTML shell + JS wiring

**Files:**
- Modify: `live-map.html:12-67`
- Modify: `live-map.js:168`, `live-map.js:192-202`, `live-map.js:339-373`, `live-map.js:508-512`, `live-map.js:557`

**Interfaces:**
- Consumes: existing `selectRider`, `renderList`, `clearSelection`, `renderInfo`.
- Produces: `#routeInfoBody`, `#closeInfo`, `#ridersToggle`, `#liveAccountButton`, `#liveAccountMenu`, `#liveProfileButton`, `#liveLogoutButton`; body classes `hasSelection` at `ridersOpen`.

- [ ] **Step 1: Replace the Live Map body markup**

Find:
```html
<body>

    <a class="skipLink" href="#pageContent">Skip to content</a>

    <header class="headerSec">
        <h2>DELIVERY PROJECT</h2>
        <div class="headerActions">
            <button id="aboutButton">Home</button>
            <button id="profileButton">Profile</button>
            <button id="logoutButton">Logout</button>
        </div>
    </header>

    <main class="mainLayout">

        <aside class="optionSec">
            <div class="sidebarTitle">MENU</div>

            <button id="dashboardButton">Dashboard</button>
            <button id="deliveriesButton">Deliveries</button>
            <button id="driversButton">Drivers</button>
            <button id="mapButton" class="active" aria-current="page">Live Map</button>
            <button id="customersButton">Customers</button>
            <button id="employeeButton">Employees</button>
            <button id="reportsButton">Reports</button>
            <button id="riderButton">Submit Delivery</button>
            <button id="settingsButton">Settings</button>

            <div class="sidebarBottom">
                <button id="sidebarLogoutButton">Logout</button>
            </div>
        </aside>

        <section class="dashboardSec" id="pageContent" tabindex="-1">
            <div class="dashboardHead">
                <div>
                    <h1>Live Map</h1>
                    <p>ESMIRINGHOY ESMIRINGHOY ESMIRINGHOY ESMIRINGHOY</p>
                </div>
                <span class="liveStatus" id="updated" role="status">Loading…</span>
            </div>

            <div class="liveGrid">
                <aside class="liveList">
                    <div class="liveListHead"><span>Riders</span><span id="riderCount">0</span></div>
                    <div id="list" aria-label="Riders on delivery"></div>
                </aside>

                <div class="liveMapWrap">
                    <div id="map" aria-label="Rider map"></div>
                    <div id="routeInfo" class="routeInfo" hidden></div>
                </div>
            </div>
        </section>

    </main>
```

Replace:
```html
<body class="liveMapPage">

    <a class="skipLink" href="#pageContent">Skip to content</a>

    <header class="headerSec">
        <h2>DELIVERY PROJECT</h2>
        <div class="headerActions">
            <button id="aboutButton">Home</button>
            <button id="profileButton">Profile</button>
            <button id="logoutButton">Logout</button>
        </div>
    </header>

    <main class="mainLayout">

        <aside class="optionSec">
            <div class="sidebarTitle">MENU</div>

            <button id="dashboardButton">Dashboard</button>
            <button id="deliveriesButton">Deliveries</button>
            <button id="driversButton">Drivers</button>
            <button id="mapButton" class="active" aria-current="page">Live Map</button>
            <button id="customersButton">Customers</button>
            <button id="employeeButton">Employees</button>
            <button id="reportsButton">Reports</button>
            <button id="riderButton">Submit Delivery</button>
            <button id="settingsButton">Settings</button>

            <div class="sidebarBottom">
                <button id="sidebarLogoutButton">Logout</button>
            </div>
        </aside>

        <section class="dashboardSec" id="pageContent" tabindex="-1">
            <div class="liveGrid">
                <aside class="liveList" id="ridersPanel" aria-label="Riders on delivery">
                    <div class="liveListHead"><span>Riders</span><span id="riderCount">0</span></div>
                    <div id="list"></div>
                </aside>

                <div class="liveMapWrap">
                    <div id="map" aria-label="Rider map"></div>

                    <div class="liveTopbar">
                        <div class="liveTopbarTitle">
                            <h1>Live Map</h1>
                            <span class="liveStatus" id="updated" role="status">Loading…</span>
                        </div>
                        <div class="liveTopbarActions">
                            <button id="ridersToggle" class="liveTopbarBtn" type="button" aria-expanded="false" aria-controls="ridersPanel" aria-label="Toggle riders list">Riders</button>
                            <div class="liveAccount">
                                <button id="liveAccountButton" class="liveAccountBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="liveAccountMenu" aria-label="Account menu">
                                    <img src="assets/company-logo.svg" alt="">
                                </button>
                                <div id="liveAccountMenu" class="liveAccountMenu" role="menu" hidden>
                                    <button id="liveProfileButton" type="button" role="menuitem">Profile</button>
                                    <button id="liveLogoutButton" type="button" role="menuitem">Logout</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <aside id="routeInfo" class="routeInfo" aria-label="Delivery details">
                        <div class="routeInfoHead">
                            <span>Delivery details</span>
                            <button id="closeInfo" class="routeInfoClose" type="button" aria-label="Close delivery details">&times;</button>
                        </div>
                        <div id="routeInfoBody">
                            <p class="routeInfoEmpty">Select a rider to view delivery details.</p>
                        </div>
                    </aside>
                </div>
            </div>
        </section>

    </main>
```

- [ ] **Step 2: Move the map style control sa bottom-right**

Find:
```js
    options: { position: "topright" },
```

Replace:
```js
    options: { position: "bottomright" },
```

- [ ] **Step 3: Move the zoom control sa bottom-right**

Find:
```js
L.control.zoom({ position: "topright" }).addTo(map);
new StyleControl().addTo(map);
```

Replace:
```js
L.control.zoom({ position: "bottomright" }).addTo(map);
new StyleControl().addTo(map);
```

- [ ] **Step 4: Add references sa mga bagong elemento**

Find:
```js
const listEl = document.getElementById("list");
const countEl = document.getElementById("riderCount");
const updatedEl = document.getElementById("updated");
const infoEl = document.getElementById("routeInfo");
```

Replace:
```js
const listEl = document.getElementById("list");
const countEl = document.getElementById("riderCount");
const updatedEl = document.getElementById("updated");
const infoEl = document.getElementById("routeInfo");
const infoBodyEl = document.getElementById("routeInfoBody");
const closeInfoBtn = document.getElementById("closeInfo");
const ridersToggleBtn = document.getElementById("ridersToggle");
const accountBtn = document.getElementById("liveAccountButton");
const accountMenu = document.getElementById("liveAccountMenu");
const liveProfileBtn = document.getElementById("liveProfileButton");
const liveLogoutBtn = document.getElementById("liveLogoutButton");
```

- [ ] **Step 5: Palitan ang `clearSelection` para hindi mag-hide ang panel**

Find:
```js
    routeLines = [];
    destMarkers = [];
    infoEl.hidden = true;
}
```

Replace:
```js
    routeLines = [];
    destMarkers = [];
    renderInfo();
}
```

- [ ] **Step 6: Render placeholder at details sa `#routeInfoBody`**

Find:
```js
function renderInfo() {
    const loc = locations[selectedId];
    if (!loc || !currentRoute) { infoEl.hidden = true; return; }
    infoEl.hidden = false;

    let html = `<b>${escH(riderLabel(loc.driver_id, loc.name))}</b> · ${currentRoute.km.toFixed(1)} km from company` +
```

Replace:
```js
function syncSelectionState() {
    document.body.classList.toggle("hasSelection", selectedId !== null && !!locations[selectedId]);
}

function renderInfo() {
    const loc = locations[selectedId];
    if (!loc || !currentRoute) {
        infoBodyEl.innerHTML = '<p class="routeInfoEmpty">Select a rider to view delivery details.</p>';
        syncSelectionState();
        return;
    }

    let html = `<b>${escH(riderLabel(loc.driver_id, loc.name))}</b> · ${currentRoute.km.toFixed(1)} km from company` +
```

Find:
```js
    }
    infoEl.innerHTML = html;
}
```

Replace:
```js
    }
    infoBodyEl.innerHTML = html;
    syncSelectionState();
}
```

- [ ] **Step 7: Isara ang riders drawer kapag pumili ng rider**

Find:
```js
function selectRider(id) {
    selectedId = id;
    renderList();
    showSelected(true);
}
```

Replace:
```js
function selectRider(id) {
    selectedId = id;
    document.body.classList.remove("ridersOpen");
    if (ridersToggleBtn) ridersToggleBtn.setAttribute("aria-expanded", "false");
    renderList();
    showSelected(true);
}
```

- [ ] **Step 8: Add shell controls bago ang auto-refresh**

Find:
```js
(async () => {
    await refreshDeliveries();
    await refreshLocations();
})();
```

Replace:
```js
// ---------- SHELL CONTROLS ----------
if (closeInfoBtn) closeInfoBtn.addEventListener("click", () => {
    selectedId = null;
    clearSelection();
    renderList();
});

if (ridersToggleBtn) ridersToggleBtn.addEventListener("click", () => {
    const open = document.body.classList.toggle("ridersOpen");
    ridersToggleBtn.setAttribute("aria-expanded", String(open));
});

function closeAccountMenu() {
    if (!accountMenu || !accountBtn) return;
    accountMenu.hidden = true;
    accountBtn.setAttribute("aria-expanded", "false");
}

if (accountBtn) accountBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = accountMenu.hidden;
    accountMenu.hidden = !open;
    accountBtn.setAttribute("aria-expanded", String(open));
});

document.addEventListener("click", (e) => {
    if (!accountMenu || accountMenu.hidden || !accountBtn) return;
    if (!accountMenu.contains(e.target) && !accountBtn.contains(e.target)) closeAccountMenu();
});

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeAccountMenu();
    document.body.classList.remove("ridersOpen");
    if (ridersToggleBtn) ridersToggleBtn.setAttribute("aria-expanded", "false");
});

if (liveProfileBtn) liveProfileBtn.addEventListener("click", () => {
    window.location.href = "settings.html";
});

if (liveLogoutBtn) liveLogoutBtn.addEventListener("click", () => {
    closeAccountMenu();
    const mainLogout = document.getElementById("logoutButton");
    if (mainLogout) mainLogout.click();
});

(async () => {
    await refreshDeliveries();
    await refreshLocations();
})();
```

- [ ] **Step 9: Verify JS syntax at HTML contract**

Run:
```powershell
node --check live-map.js
```

Expected: no output, exit code 0.

Run:
```powershell
Select-String -Path live-map.html -Pattern 'routeInfoBody|closeInfo|ridersToggle|liveAccountButton|liveAccountMenu'
```

Expected: lahat ng 5 IDs ay may match.

- [ ] **Step 10: Verify sa browser**

Open `http://localhost/DELIVERY_PROJECT_MAP/live-map.html` habang naka-login.

Expected:
- Walang console error.
- Lumalabas ang Riders list, mapa, at right panel na may "Select a rider to view delivery details."
- Click rider: lumalabas ang details sa right panel; gumagana pa rin ang route at pins.
- Click `×`: bumabalik sa placeholder at nawawala ang route.
- Click account circle: lumalabas ang Profile/Logout menu. `Escape` nagsasara.
- Map controls nasa bottom-right.

---

### Task 2: Desktop shell CSS

**Files:**
- Modify: `style.css` — magdagdag sa pinakadulo ng file, pagkatapos ng huling `}`.

**Interfaces:**
- Consumes: `body.liveMapPage`, `.liveShell`, `.liveTopbar`, `.liveAccount`, `.routeInfoHead` mula sa Task 1.
- Produces: desktop grid — `300px` riders panel + fluid map — at floating right panel.

- [ ] **Step 1: Append the desktop shell CSS**

Append sa pinakadulo ng `style.css`:
```css
/* =====================================================
   LIVE MAP SHELL (scope: body.liveMapPage)
====================================================== */
.liveMapPage .mainLayout {
    grid-template-columns: 68px minmax(0, 1fr);
    padding: 24px;
}

.liveMapPage .dashboardSec {
    height: calc(100vh - 124px);
    height: calc(100dvh - 124px);
    min-height: 560px;
    padding: 0;
    gap: 0;
    overflow: hidden;
}

.liveMapPage .liveGrid {
    height: 100%;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 0;
    position: relative;
}

.liveMapPage .liveList {
    height: auto;
    min-height: 0;
    padding: 14px;
    background: var(--card);
    border-right: 1px solid var(--border);
}

.liveMapPage .liveListHead {
    flex: 0 0 auto;
}

.liveMapPage #list {
    margin-top: 12px;
}

.liveMapPage .liveMapWrap {
    height: auto;
    min-height: 0;
    border-radius: 0 8px 8px 0;
    overflow: hidden;
}

.liveMapPage .liveTopbar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 600;
    min-height: 60px;
    padding: 8px 12px 8px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--card);
    border-bottom: 1px solid var(--border);
}

.liveMapPage .liveTopbarTitle {
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 12px;
}

.liveMapPage .liveTopbarTitle h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--foreground);
}

.liveMapPage .liveTopbarActions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.liveMapPage .liveTopbarBtn {
    min-height: 36px;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--secondary);
    color: var(--foreground);
    font-size: 13px;
    cursor: pointer;
}

.liveMapPage #ridersToggle {
    display: none;
}

.liveMapPage .liveAccount {
    position: relative;
}

.liveMapPage .liveAccountBtn {
    width: 40px;
    height: 40px;
    padding: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--secondary);
    cursor: pointer;
}

.liveMapPage .liveAccountBtn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.liveMapPage .liveAccountMenu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 700;
    min-width: 160px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-panel);
}

.liveMapPage .liveAccountMenu[hidden] {
    display: none;
}

.liveMapPage .liveAccountMenu button {
    padding: 10px 12px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--foreground);
    text-align: left;
    font-size: 14px;
    cursor: pointer;
}

.liveMapPage .liveAccountMenu button:hover {
    background: var(--secondary);
}

.liveMapPage #profileButton,
.liveMapPage #logoutButton {
    display: none;
}

.liveMapPage .routeInfo {
    top: 76px;
    right: 16px;
    bottom: auto;
    left: auto;
    z-index: 550;
    width: 320px;
    max-height: calc(100% - 152px);
    padding: 0;
    overflow: auto;
}

.liveMapPage .routeInfoHead {
    position: sticky;
    top: 0;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--card);
    border-bottom: 1px solid var(--border-soft);
    font-size: 13px;
    font-weight: 600;
}

.liveMapPage .routeInfoClose {
    width: 32px;
    height: 32px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--secondary);
    color: var(--foreground);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
}

.liveMapPage #routeInfoBody {
    padding: 12px 14px;
    font-size: 13px;
    line-height: 1.6;
}

.liveMapPage .routeInfoEmpty {
    margin: 0;
    color: var(--muted-foreground);
}
```

- [ ] **Step 2: Verify desktop layout sa Light theme**

Open `http://localhost/DELIVERY_PROJECT_MAP/live-map.html`.

Expected:
- Rail at Riders panel magkadikit, walang gap.
- Mapa puno ang natitirang space.
- Top bar overlay sa itaas ng mapa; account circle sa kanan.
- Right floating panel may placeholder; hindi covered ang bottom-right controls.
- Walang horizontal scroll sa 1280px width.

- [ ] **Step 3: Verify long-content behavior**

I-click ang rider na may pinakamahabang customer name/address.

Expected:
- Right panel nagla-line-wrap, walang horizontal overflow.
- Panel may scrollbar kung lumampas sa `max-height`.
- Hindi natatakpan ang close button.

---

### Task 3: Mobile CSS

**Files:**
- Modify: `style.css` — magdagdag sa pinakadulo, pagkatapos ng Task 2 block.

**Interfaces:**
- Consumes: body classes `hasSelection` at `ridersOpen` mula sa Task 1.
- Produces: riders drawer sa kaliwa, delivery details bottom sheet, 44px targets.

- [ ] **Step 1: Append the mobile CSS**

Append sa pinakadulo ng `style.css`:
```css
/* ---------- Live Map mobile ---------- */
@media (max-width: 850px) {
    .liveMapPage .mainLayout {
        grid-template-columns: 56px minmax(0, 1fr);
        padding: 14px 14px 14px 0;
    }

    .liveMapPage .dashboardSec {
        height: calc(100vh - 104px);
        height: calc(100dvh - 104px);
        min-height: 480px;
    }

    .liveMapPage .liveGrid {
        grid-template-columns: minmax(0, 1fr);
    }

    .liveMapPage .liveList {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        z-index: 650;
        width: min(78vw, 300px);
        border-radius: 0;
        box-shadow: var(--shadow-panel);
        transform: translateX(-102%);
        transition: transform 0.2s ease;
    }

    .liveMapPage.ridersOpen .liveList {
        transform: none;
    }

    .liveMapPage #ridersToggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 44px;
        min-height: 44px;
    }

    .liveMapPage .liveAccountBtn {
        width: 44px;
        height: 44px;
    }

    .liveMapPage .liveTopbarTitle h1 {
        font-size: 16px;
    }

    .liveMapPage .routeInfo {
        top: auto;
        left: 0;
        right: 0;
        bottom: 0;
        width: auto;
        max-height: 42vh;
        padding: 0 0 env(safe-area-inset-bottom, 0);
        border-radius: 12px 12px 0 0;
        border-bottom: 0;
        transform: translateY(105%);
        transition: transform 0.22s ease;
        z-index: 660;
    }

    .liveMapPage.hasSelection .routeInfo {
        transform: none;
    }

    .liveMapPage .routeInfoClose {
        width: 44px;
        height: 44px;
    }

    .liveMapPage.hasSelection .leaflet-bottom {
        bottom: 44%;
        transition: bottom 0.22s ease;
    }

    .liveMapPage .rider {
        min-height: 44px;
    }
}

@media (max-width: 650px) {
    .liveMapPage .liveTopbar {
        padding: 6px 8px 6px 12px;
    }

    .liveMapPage .liveTopbarTitle {
        gap: 8px;
    }

    .liveMapPage .liveStatus {
        font-size: 11px;
    }
}
```

- [ ] **Step 2: Verify sa 390px width**

Open DevTools → Responsive → `390 x 844`.

Expected:
- Walang horizontal scroll.
- `Riders` button lumalabas sa top bar; click → drawer bumubukas mula kaliwa.
- Click rider → drawer nagsasara, bottom sheet lumalabas.
- Close `×` → bumabalik sa mapa.
- Mapa controls nakalipat pataas kapag bukas ang sheet.
- Lahat ng bagong button ≥44px.

- [ ] **Step 3: Verify Midnight theme**

Palitan ang theme sa Settings → Midnight, bumalik sa Live Map.

Expected:
- Walang hardcoded white/black na control.
- Readable ang top bar, account menu, at details panel.

---

### Task 4: Final verification

**Files:**
- Read-only: `live-map.html`, `style.css`, `live-map.js`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: verified Live Map shell.

- [ ] **Step 1: Syntax at scope check**

Run:
```powershell
node --check live-map.js
Select-String -Path style.css -Pattern 'Live Map Shell|Live Map mobile'
Select-String -Path live-map.html -Pattern 'liveMapPage'
```

Expected: JS check passes; CSS sections 2 matches; HTML 1 match.

- [ ] **Step 2: Desktop at mobile walkthrough**

Sa browser, i-test isa-isa:

1. Live Map, walang selection → placeholder.
2. Live Map, may selection → details + route + close.
3. Account menu → Profile, Logout, `Escape`.
4. Riders drawer sa 390px.
5. Bottom sheet sa 390px.
6. Light at Midnight themes.
7. Hard refresh (`Ctrl + F5`) para siguradong bagong CSS.

Expected: lahat gumagana, walang console error, walang horizontal scroll.

- [ ] **Step 3: Live smoke test (read-only)**

Pag okay sa local, buksan:
```text
https://delcomtracking.wuaze.com/live-map.html
```

Expected:
- Lumalabas ang 3 deliveries at riders list.
- Gumagana ang selection at details panel.
- Kung may "Could not reach the map service" o gray tiles, i-record lang — existing hosting limitation, hindi UI bug.

- [ ] **Step 4: Commit (only with permission)**

Huwag mag-commit/push hangga't walang explicit na approval.

---

## Self-Review Notes

- Spec coverage: layout, mobile drawer/bottom sheet, account menu, placeholder, existing data only — lahat may task.
- Type/ID consistency: `#routeInfoBody`, `#closeInfo`, `#ridersToggle`, `#liveAccountButton`, `#liveAccountMenu`, `#liveProfileButton`, `#liveLogoutButton`, body classes `hasSelection` at `ridersOpen` — pareho sa HTML, JS, at CSS tasks.
- Uncovered inputs pinned: walang rider (Task 1 Step 6), long text (Task 2 Step 3), 390px sheet (Task 3 Step 2), Midnight (Task 3 Step 3), Escape (Task 1 Step 10).
