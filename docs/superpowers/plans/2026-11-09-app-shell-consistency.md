# App Shell & UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isang consistent na floating app shell sa lahat ng admin pages, minimal shell sa Rider page, at pare-parehong navigation, tables, forms, at overlays — walang backend changes.

**Architecture:** Normal multi-page navigation. Bawat admin page ay makakakuha ng `body.appPage`, aalisin ang site header, at gagamit ng floating rail + workspace card. Isang shared account menu behavior sa `app.js`; per-page markup lang ang account button. Live Map remains full-bleed.

**Tech Stack:** Static HTML, vanilla JS, existing `style.css` tokens, Leaflet/MapLibre, PHP API unchanged.

**Spec:** `docs/superpowers/specs/2026-11-09-app-shell-consistency-design.md`

## Global Constraints

- Admin pages lang ang mababago: Dashboard, Deliveries, Drivers, Customers, Employees, Reports, Settings.
- Live Map: verification lang; walang layout rewrite. Dead CSS cleanup ay separate follow-up.
- Rider page: minimal shell; walang admin rail; existing auth at back behavior preserved.
- Walang API, database, o `api/route.php` changes.
- Existing tokens lang; walang hardcoded colors.
- Mobile touch targets ≥44px; walang horizontal scroll sa 390px.
- Existing IDs at data logic ay hindi gagalawin.
- Assistant must not edit website files; exact Find/Replace, isa-isa.
- No commit/push/upload without explicit permission.
- Huwag i-print ang credentials.

## Review Focus

- **Employee role:** Employees at Submit Delivery hidden; account menu at logout gumagana pa rin.
- **Mobile 390px list page:** table becomes cards; walang horizontal scroll; account menu reachable.
- **Long page title / actions:** header wraps; walang overlap sa account circle.
- **Midnight theme:** workspace card, account menu, at tables readable.
- **Print Reports:** kumpleto ang nilalaman; walang rail, header, toolbar, o account button.
- **Keyboard:** `Escape` nagsasara sa account menu at modal; visible ang focus.

---

## Shell Contract

### Account markup (use verbatim)

```html
<div class="accountWrap">
    <button id="liveAccountButton" class="accountBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="liveAccountMenu" aria-label="Account menu">
        <img src="assets/company-logo.svg" alt="">
    </button>
    <div id="liveAccountMenu" class="accountMenu" role="menu" hidden>
        <button id="liveProfileButton" type="button" role="menuitem">Profile</button>
        <button id="liveLogoutButton" type="button" role="menuitem">Logout</button>
    </div>
</div>
```

### Classes

- `body.appPage` — admin page shell scope.
- `.accountWrap`, `.accountBtn`, `.accountMenu` — global account menu (works on Live Map too).
- `.pageActions` — right side ng `dashboardHead`, naglalaman ng account markup.
- `.listPage` — fixed-header table pages (Deliveries, Drivers, Customers, Employees).
- `.tablePanel` — panel na naglalaman ng `.tableWrapper`.

### Account IDs (same on every page)

`liveAccountButton`, `liveAccountMenu`, `liveProfileButton`, `liveLogoutButton`.

---

### Task 1: Shared shell foundation + Dashboard pilot

**Files:**
- Modify: `app.js` — account menu behavior
- Modify: `live-map.js` — remove duplicate account handlers
- Modify: `style.css` — append shared shell CSS
- Modify: `dashboard.html` — body class, remove header, account markup

**Interfaces:**
- Produces: `.appPage` shell CSS; `.accountWrap/.accountBtn/.accountMenu` global CSS; account behavior in `app.js`.
- Consumes: existing `handleLogout`, `PAGE_MAP`, `uiNavIcons`.

- [ ] **Step 1: Add account menu behavior sa `app.js`**

Find:
```js
const profileBtn = document.getElementById("profileButton");
if (profileBtn) profileBtn.addEventListener("click", () => (window.location.href = "settings.html"));
```

Replace:
```js
const profileBtn = document.getElementById("profileButton");
if (profileBtn) profileBtn.addEventListener("click", () => (window.location.href = "settings.html"));

// ---------- ACCOUNT MENU ----------
const accountBtn = document.getElementById("liveAccountButton");
const accountMenu = document.getElementById("liveAccountMenu");
const accountProfile = document.getElementById("liveProfileButton");
const accountLogout = document.getElementById("liveLogoutButton");

function closeAccountMenu() {
    if (!accountMenu || !accountBtn) return;
    accountMenu.hidden = true;
    accountBtn.setAttribute("aria-expanded", "false");
}

if (accountBtn && accountMenu) {
    accountBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = accountMenu.hidden;
        accountMenu.hidden = !open;
        accountBtn.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("click", (e) => {
        if (accountMenu.hidden) return;
        if (!accountMenu.contains(e.target) && !accountBtn.contains(e.target)) closeAccountMenu();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAccountMenu();
    });
}

if (accountProfile) accountProfile.addEventListener("click", () => {
    window.location.href = "settings.html";
});

if (accountLogout) accountLogout.addEventListener("click", () => {
    closeAccountMenu();
    handleLogout();
});
```

- [ ] **Step 2: Remove duplicate account handlers sa `live-map.js`**

Delete these four lines:
```js
const accountBtn = document.getElementById("liveAccountButton");
const accountMenu = document.getElementById("liveAccountMenu");
const liveProfileBtn = document.getElementById("liveProfileButton");
const liveLogoutBtn = document.getElementById("liveLogoutButton");
```

Replace the whole account block (mula `function closeAccountMenu()` hanggang sa `liveLogoutBtn` listener) with:
```js
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.body.classList.remove("ridersOpen");
    if (ridersToggleBtn) ridersToggleBtn.setAttribute("aria-expanded", "false");
});
```

- [ ] **Step 3: Append shared shell CSS sa `style.css`**

```css
/* =====================================================
   SHARED APP SHELL
====================================================== */
.accountWrap {
    position: relative;
    flex: 0 0 auto;
}

.accountBtn {
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

.accountBtn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.accountMenu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 950;
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

.accountMenu[hidden] {
    display: none;
}

.accountMenu button {
    min-height: 40px;
    padding: 10px 12px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--foreground);
    text-align: left;
    font-size: 14px;
    cursor: pointer;
}

.accountMenu button:hover {
    background: var(--secondary);
}

.appPage .mainLayout {
    position: relative;
    display: block;
    height: 100vh;
    height: 100dvh;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 0;
    overflow: hidden;
}

.appPage .optionSec {
    position: absolute;
    top: 12px;
    left: 12px;
    bottom: 12px;
    width: 56px;
    height: auto;
    padding: 16px 8px;
    z-index: 900;
    border-radius: 8px;
}

.appPage .dashboardSec {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: 12px;
    left: 80px;
    height: auto;
    min-height: 0;
    padding: 24px;
    gap: 20px;
    overflow-y: auto;
    border-radius: 8px;
}

.appPage .dashboardHead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
}

.appPage .pageActions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
}

.appPage .listPage {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.appPage .listPage .tablePanel {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

.appPage .listPage .tablePanel .tableWrapper {
    flex: 1;
    min-height: 0;
    overflow: auto;
}

.appPage .dataTable thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--card);
}

@media (max-width: 850px) {
    .appPage .optionSec {
        top: 8px;
        left: 8px;
        bottom: 8px;
        width: 48px;
        padding: 12px 2px;
    }

    .appPage .dashboardSec {
        top: 8px;
        right: 8px;
        bottom: 8px;
        left: 64px;
        padding: 16px;
        gap: 14px;
    }

    .accountBtn {
        width: 44px;
        height: 44px;
    }

    .accountMenu button {
        min-height: 44px;
    }
}

@media (max-width: 650px) {
    .appPage .dashboardHead {
        flex-wrap: wrap;
    }

    .appPage .listPage {
        display: block;
        overflow-y: auto;
    }

    .appPage .listPage .tablePanel {
        display: block;
    }

    .appPage .listPage .tablePanel .tableWrapper {
        overflow: visible;
    }

    .appPage .dataTable thead th {
        position: static;
    }
}
```

- [ ] **Step 4: I-update ang `dashboard.html`**

- `<body>` → `<body class="appPage">`
- Delete the whole `<header class="headerSec">...</header>` block.
- Insert the **Account markup** snippet inside `.dashActions`, after the `newDeliveryBtn`.

- [ ] **Step 5: Verify**

Run:
```powershell
node --check app.js
node --check live-map.js
Select-String -Path dashboard.html -Pattern 'appPage|liveAccountButton'
```

Expected: both checks pass; `appPage` and `liveAccountButton` matches.

Browser:
- Dashboard: floating rail, workspace card, account circle.
- Account menu: Profile, Logout, `Escape`.
- Rail navigation gumagana.
- Live Map: account menu gumagana pa rin; Riders drawer `Escape` gumagana.
- Walang console error.

---

### Task 2: Deliveries page

**Files:**
- Modify: `deliveries.html`

**Interfaces:**
- Consumes: `.appPage` shell, `.pageActions`, `.accountWrap` snippet, `.listPage`, `.tablePanel`.

- [ ] **Step 1: Add body class at alisin ang header**

- `<body>` → `<body class="appPage">`
- Delete the whole `<header class="headerSec">...</header>` block.

- [ ] **Step 2: Add account markup sa header**

Find:
```html
            <div class="dashboardHead">
                <div class="pageHead">
                    <h1>Deliveries</h1>
                    <p>Manage all delivery transactions</p>
                </div>
            </div>
```

Replace:
```html
            <div class="dashboardHead">
                <div class="pageHead">
                    <h1>Deliveries</h1>
                    <p>Manage all delivery transactions</p>
                </div>
                <div class="pageActions">
                    <div class="accountWrap">
                        <button id="liveAccountButton" class="accountBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="liveAccountMenu" aria-label="Account menu">
                            <img src="assets/company-logo.svg" alt="">
                        </button>
                        <div id="liveAccountMenu" class="accountMenu" role="menu" hidden>
                            <button id="liveProfileButton" type="button" role="menuitem">Profile</button>
                            <button id="liveLogoutButton" type="button" role="menuitem">Logout</button>
                        </div>
                    </div>
                </div>
            </div>
```

- [ ] **Step 3: Mark as list page**

- `<section class="dashboardSec" id="pageContent"` → `<section class="dashboardSec listPage" id="pageContent"`
- Sa panel na may `<div class="tableWrapper">`, palitan ang `<div class="panel">` ng `<div class="panel tablePanel">`.

- [ ] **Step 4: Verify**

- Walang site header; floating rail at workspace card.
- Table scroll sa loob; sticky header kapag nag-scroll.
- Search, filters, New Delivery, edit/delete gumagana.
- 390px: cards ang rows, walang horizontal scroll.
- Account menu at Logout gumagana.

---

### Task 3: Drivers page

**Files:**
- Modify: `drivers.html`

**Interfaces:**
- Same shell contract as Task 2.

- [ ] **Step 1: Body class + remove header**

`<body>` → `<body class="appPage">`; delete `<header class="headerSec">...</header>`.

- [ ] **Step 2: Account markup**

Add the same `.pageActions` + account snippet after the Drivers `.pageHead` block.

- [ ] **Step 3: List page classes**

`dashboardSec` → `dashboardSec listPage`; table panel → `panel tablePanel`.

- [ ] **Step 4: Verify**

Dashboard-style shell, search/filter, table scroll, mobile cards, account menu.

---

### Task 4: Customers page

**Files:**
- Modify: `customers.html`

**Interfaces:**
- Same shell contract as Task 2.

- [ ] **Step 1: Body class + remove header**

`<body>` → `<body class="appPage">`; delete header block.

- [ ] **Step 2: Account markup**

Add `.pageActions` + account snippet after the Customers `.pageHead`.

- [ ] **Step 3: List page classes**

`dashboardSec` → `dashboardSec listPage`; table panel → `panel tablePanel`.

- [ ] **Step 4: Verify**

Search, Add Customer, view/edit modal, table scroll, mobile cards, account menu.

---

### Task 5: Employees page

**Files:**
- Modify: `employees.html`

**Interfaces:**
- Same shell contract as Task 2.

- [ ] **Step 1: Body class + remove header**

`<body>` → `<body class="appPage">`; delete header block.

- [ ] **Step 2: Account markup**

Add `.pageActions` + account snippet after the Employees `.pageHead`.

- [ ] **Step 3: List page classes**

`dashboardSec` → `dashboardSec listPage`; table panel → `panel tablePanel`.

- [ ] **Step 4: Verify role behavior**

- Admin: Employees page visible at rail.
- Employee role: Employees at Submit Delivery hidden; walang bounce.
- Account menu at Logout gumagana.
- Table scroll at mobile cards okay.

---

### Task 6: Reports page

**Files:**
- Modify: `reports.html`
- Modify: `style.css` — append generic print overrides

**Interfaces:**
- Consumes: `.appPage`, `.pageActions`, account snippet.

- [ ] **Step 1: Body class + remove header**

`<body class="reportsPage">` → `<body class="appPage reportsPage">`; delete header block.

- [ ] **Step 2: Account markup**

Add `.pageActions` + account snippet after the Reports `.pageHead`.

- [ ] **Step 3: Append print overrides sa `style.css`**

```css
@media print {
    .appPage .mainLayout {
        position: static;
        display: block;
        height: auto;
        overflow: visible;
    }

    .appPage .optionSec,
    .appPage .accountWrap,
    .appPage .dashboardHead,
    .appPage .toolbar {
        display: none !important;
    }

    .appPage .dashboardSec {
        position: static;
        height: auto;
        min-height: 0;
        padding: 0;
        overflow: visible;
        border: 0;
    }
}
```

- [ ] **Step 4: Verify**

- Date filters, Generate, Reset, Export CSV, Print gumagana.
- Print preview: kumpleto ang report; walang rail/header/toolbar/account.
- Mobile: cards at tables readable; walang horizontal scroll.
- Account menu gumagana.

---

### Task 7: Settings page

**Files:**
- Modify: `settings.html`

**Interfaces:**
- Consumes: `.appPage`, `.pageActions`, account snippet.

- [ ] **Step 1: Body class + remove header**

`<body>` → `<body class="appPage">`; delete header block.

- [ ] **Step 2: Account markup**

Add `.pageActions` + account snippet after the Settings `.pageHead`.

- [ ] **Step 3: Verify**

- Profile, Security, Appearance cards readable.
- Edit Profile, Change Password, Add User, theme picker gumagana.
- User table scroll at mobile cards okay.
- Account menu at Logout gumagana.

---

### Task 8: Rider page minimal shell

**Files:**
- Modify: `rider.html`
- Modify: `style.css`

**Interfaces:**
- Consumes: existing rider header IDs (`backBtn`, `whoami`, `logoutBtn`), existing `rider.js`.
- Produces: `.riderPage` shell styles.

- [ ] **Step 1: Add body class**

`<body>` → `<body class="riderPage">`.

- [ ] **Step 2: Move inline styles to `style.css`**

- Copy the entire `<style>...</style>` block mula `rider.html` head.
- Append it verbatim sa `style.css` sa ilalim ng bagong comment:
```css
/* ---------- RIDER PAGE ---------- */
```
- Delete the inline `<style>...</style>` block sa `rider.html`.

- [ ] **Step 3: Append rider shell CSS sa `style.css`**

```css
.riderPage {
    background: var(--background);
}

.riderPage .headerSec {
    position: sticky;
    top: 0;
    z-index: 100;
    width: 100%;
}

.riderPage .riderWrap {
    max-width: 760px;
    margin: 0 auto;
    padding: 20px 16px 40px;
}

@media (max-width: 650px) {
    .riderPage .riderWrap {
        padding: 12px 10px 32px;
    }
}
```

- [ ] **Step 4: Verify**

- Walang admin rail; brand, whoami, back (kapag admin), Logout lang.
- Form sections, proof upload, preview, GPS, place search, submit gumagana.
- Mobile: walang horizontal scroll; inputs at buttons ≥44px.
- `node --check rider.js`.

---

### Task 9: Final consistency and regression

**Files:**
- Read-only: lahat ng pages at JS

**Interfaces:**
- Consumes: Tasks 1–8.

- [ ] **Step 1: Syntax check lahat ng JS**

Run:
```powershell
Get-ChildItem *.js | ForEach-Object { node --check $_.Name; if ($LASTEXITCODE -ne 0) { "FAILED: $($_.Name)" } }
```

Expected: walang `FAILED`.

- [ ] **Step 2: Desktop walkthrough**

Para sa bawat page: Dashboard, Deliveries, Drivers, Live Map, Customers, Employees, Reports, Submit Delivery, Settings:

- Floating rail, workspace card, account circle.
- Walang site header.
- Active rail item tama.
- Account menu: Profile, Logout, `Escape`.
- Walang console error.

- [ ] **Step 3: Mobile walkthrough sa 390px**

- Walang horizontal scroll.
- Tables → cards.
- Header at actions nag-wrap.
- Account menu at buttons ≥44px.

- [ ] **Step 4: Theme at role test**

- Light at Midnight sa Dashboard, Deliveries, Reports, Settings.
- Employee role: Employees at Submit Delivery hidden.
- Rider role: `rider.html` minimal shell, walang bounce loop.

- [ ] **Step 5: Print at CRUD regression**

- Reports print preview kumpleto.
- Isang add/edit/delete sa Deliveries.
- Isang add/edit sa Customers.
- Proof upload sa Submit Delivery (kung may test data).
- Live Map account menu at Riders drawer gumagana pa rin.

- [ ] **Step 6: Live smoke test**

```text
https://delcomtracking.wuaze.com/dashboard.html
https://delcomtracking.wuaze.com/deliveries.html
https://delcomtracking.wuaze.com/live-map.html
https://delcomtracking.wuaze.com/reports.html
https://delcomtracking.wuaze.com/settings.html
```

Expected: parehong shell, walang layout break, gumagana ang navigation at account menu.

- [ ] **Step 7: Commit (only with permission)**

Huwag mag-commit/push/upload hangga't walang explicit approval.

---

## Self-Review Notes

- **Spec coverage:** Shell, navigation, list pages, dashboard, reports, settings, rider, Live Map verification, print, a11y — may task lahat.
- **Class/ID consistency:** `.appPage`, `.listPage`, `.tablePanel`, `.accountWrap`, `.accountBtn`, `.accountMenu`, at account IDs pareho sa lahat ng tasks.
- **Uncovered-input tests pinned:** Employee role (Task 5), mobile 390 list page (Task 2), long header wrap (Task 1 at Task 2), Midnight (Task 9), print Reports (Task 6), Escape/focus (Task 1 at Task 9).
- **Proportion:** Shared CSS at account behavior nasa Task 1 lang; per-page tasks ay structural changes lang, hindi code transcripts.
