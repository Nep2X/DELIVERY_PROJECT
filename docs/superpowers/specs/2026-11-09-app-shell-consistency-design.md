# App Shell & UI Consistency — Design

## Intent

Gawing isang consistent na app shell ang buong delivery system, gamit ang format na na-establish sa Live Map:

- Walang site header sa mga app pages.
- Floating icon rail sa kaliwa.
- Account circle sa top-right.
- Isang malaking workspace card para sa content.
- Overlay panels para sa contextual details; modal para sa forms.
- Full-bleed map para sa Live Map.

**Bakit:** Para hindi magmukhang magkakaibang system ang bawat page, at para isang pattern lang ang matututunan ng user sa navigation, tables, forms, at mobile.

## Current State

- 9 app pages: Dashboard, Deliveries, Drivers, Live Map, Customers, Employees, Reports, Submit Delivery, Settings.
- Pareho ang shell markup: `headerSec` + `mainLayout` + `optionSec` + `dashboardSec`.
- Tables at filters ay nasa `panel` cards; forms ay modals.
- Live Map lang ang full-bleed at may overlay panels.
- May duplicate/override CSS layers mula sa Live Map work.
- `rider.html` may malaking inline `<style>`.
- Navigation ay normal page load via `PAGE_MAP` sa `app.js`.
- Role-aware na ang pagtago ng Employees at Submit Delivery para sa Employee role.

## Goals

1. Isang shared shell sa lahat ng app pages.
2. Malinaw at pare-parehong navigation.
3. Consistent page template para sa list, dashboard, reports, settings, at form pages.
4. Consistent table behavior, forms, buttons, states, at overlays.
5. Mobile parity: walang horizontal scroll, ≥44px targets.
6. Light/Midnight parity at print support.
7. Lowest-risk migration: isang page per task, test bawat isa.

## Non-Goals

- Walang backend, API, o database changes.
- Walang bagong feature (pagination, sorting engine, bagong reports).
- Walang SPA/router rewrite.
- Walang color palette o theme changes.
- Walang pagbabago sa map tiles o routing service.
- Walang pagbabago sa login page.

## Anti-Goals

- Hindi pwedeng mawala ang deep links, refresh, at back button.
- Hindi pwedeng masira ang role-based access.
- Hindi pwedeng maging mas mahirap i-maintain ang CSS kaysa ngayon.
- Hindi pwedeng magkaroon ng horizontal scroll sa 390px.
- Hindi pwedeng mawala ang print/export ng Reports.

## Constraints

- Static HTML + vanilla JS + PHP API; walang build step.
- Existing IDs at data logic ay pananatilihin.
- Existing `style.css` tokens lang; walang hardcoded colors.
- Assistant must not edit website files; exact Find/Replace instructions, isa-isa.
- No commit/push/upload without explicit permission.

## Approaches Considered

### A. Shared multi-page shell (chosen)

Normal page loads, pare-parehong floating shell, overlay panels para sa contextual details, modal para sa forms.

- **Trades off:** may page reload sa bawat navigation.
- **Wins:** safe, keeps URLs/auth/back/refresh, minimal JS change, malapit agad sa Live Map look.

### B. Single-page app

Isang shell, client-side router, content swap.

- **Trades off:** malaking rewrite, state management, risk sa auth at existing page scripts.
- **Rejected:** walang UI benefit na hindi kayang ibigay ng Option A.

### C. Iframe/overlay dashboard

Rail opens each page inside an overlay/iframe.

- **Trades off:** double scrollbars, accessibility issues, brittle URLs.
- **Rejected:** mas maraming problema kaysa naayos.

## Navigation Model

- **Left rail** = primary navigation.
- Order: Dashboard, Deliveries, Drivers, Live Map, Customers, Employees, Reports, Submit Delivery, Settings.
- Active page: `.active` + `aria-current="page"`.
- Icon-only, may tooltip, 40px desktop / 44px mobile.
- **Account circle** = Profile, Logout.
  - Profile → `settings.html`
  - Logout → existing `handleLogout`
- Normal page load. Walang router.
- Role-aware: Employee role hides Employees at Submit Delivery (existing behavior).
- `Home` header button ay aalisin; Dashboard na ang home.

## Shared Shell

### Desktop layout

```text
┌ viewport ──────────────────────────────────────────────┐
│ ┌rail┐  ┌─ workspace card ────────────────────────────┐ │
│ │    │  │ header: title/subtitle | actions | account  │ │
│ │    │  │ toolbar (sticky)                            │ │
│ │    │  │ scroll body: table / cards / form           │ │
│ └────┘  └─────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

- Rail: absolute, left 12, top 12, bottom 12, width 56, floating card, z 900.
- Workspace: absolute, left 80, right 12, top 12, bottom 12, `var(--card)`, border, radius 8, `overflow: hidden`, flex column, z 1.
- Header: title + subtitle/status sa kaliwa; page actions + account circle sa kanan.
- Toolbar: sticky, background `var(--card)`, bottom border, horizontal scroll allowed only inside it.
- Body: only content scrolls.
- Account circle: nasa workspace header, visually same position as Live Map top-right.

### Mobile layout

- Rail: left 8, top 8, bottom 8, width 48.
- Workspace: left 64, right 8, top 8, bottom 8.
- Header wraps: title on first row; actions + account on second row kung kailangan.
- Toolbar: horizontal scroll ng filter controls; walang page-level horizontal scroll.
- Tables: row cards; labels via `data-label`/`::before`.
- Contextual details: bottom sheet.

### Live Map variant

- Full-bleed map sa ilalim ng lahat.
- Floating rail, floating topbar, Riders overlay, delivery-details overlay.
- Same account menu behavior at tokens.

## Page Templates

### 1. List pages (Deliveries, Drivers, Customers, Employees)

- Workspace header: title, subtitle, primary action (hal. `+ New Delivery`).
- Toolbar: search, filters, clear action, count.
- Table: sticky header, hover row, primary column emphasis, row actions sa kebab menu.
- Create/edit: existing modal (centered), same styling sa lahat.
- Empty state: icon + title + short guidance + primary action.
- Loading: inline skeleton o `Loading…` status; walang layout jump.

### 2. Dashboard

- Workspace header: greeting/title + updated status + Live Map/New Delivery actions.
- KPI grid.
- Recent deliveries table.
- Optional map preview kung may existing data; hindi bagong feature.

### 3. Reports

- Workspace header: title + description.
- Toolbar: date range, generate, reset, export, print.
- Summary cards.
- Tables.
- Print layout: chrome hidden, light colors, tables ang ipi-print.

### 4. Settings

- Workspace header: title + description.
- Section cards grid: Profile, Security, Theme, Users.
- Walang table scroll issue; cards stack sa mobile.

### 5. Submit Delivery (Rider)

- Minimal shell: walang admin rail; brand, page context, at Logout.
- Workspace header: title + description.
- Single-column form, max-width 720px, centered sa workspace.
- Sections: delivery, proof upload, location, submit.
- Map preview at proof preview consistent ang border/radius.
- Inline `<style>` ililipat sa shared CSS.
- Existing auth guard at back behavior preserved.

### 6. Live Map

- Full-bleed map.
- Riders overlay + details overlay.
- Walang permanenteng columns.

## Component Standards

### Buttons

- Primary: isa lang per view.
- Outline: secondary actions.
- Danger: destructive.
- Icon: 40px desktop / 44px mobile.
- Pareho ang height, padding, radius, at focus ring sa lahat ng pages.

### Forms

- Label sa itaas ng field; help text kung kailangan.
- Inline error sa ilalim ng field; error color token.
- Footer: primary action sa kanan, cancel sa kaliwa.
- Modal width max 560px; mobile full-width bottom sheet kung masyadong mataas.

### Tables

- Sticky `thead`.
- Count summary sa toolbar.
- Row hover at focus-visible.
- Actions sa kebab menu; hindi haystack ng buttons.
- Mobile: rows become cards; walang horizontal scroll.

### Overlays

- **Forms** = centered modal (existing pattern).
- **Contextual details** = side panel desktop / bottom sheet mobile.
- Pareho: title, close button, Escape, focus trap, `aria-modal` kung modal.
- Isang overlay lang at a time.

### States

- Loading, empty, error, success — pareho ang copy at placement.
- Toast para sa CRUD feedback (existing `alert`).
- Walang silent failure.

### Visual Tokens

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32.
- Radius: 6 (controls), 8 (cards), 12 (sheets).
- Typography: h1 24–28, h2 18–20, body 14, small 12.
- Shadows: existing `--shadow-panel`.
- Colors: existing tokens only.

## Responsive Rules

- Breakpoints: 1250, 900, 850, 650, 430.
- ≤850: overlays become bottom sheets; rail 48px.
- ≤650: tables become cards; header wraps; touch targets ≥44px.
- 390px: walang horizontal scroll.

## Accessibility

- Skip link sa lahat ng pages.
- Visible focus sa lahat ng interactive elements.
- `aria-current` sa active rail item.
- `aria-expanded` sa account menu at overlays.
- `Escape` nagsasara sa menu at sheet.
- Focus trap sa modals.
- Reduced motion support.

## Theme and Print

- Light at Midnight dapat pareho ang hierarchy at contrast.
- Walang hardcoded background/text colors.
- Print: workspace chrome, rail, toolbar, at actions hidden; content readable sa papel.
- Reports print layout ang priority.

## Implementation Sequence

1. Shared shell CSS + account menu behavior sa `app.js`.
2. Dashboard (pilot).
3. Deliveries.
4. Drivers.
5. Customers.
6. Employees.
7. Reports.
8. Settings.
9. Submit Delivery.
10. Live Map verification pagkatapos ng shared account change. Ang dead-rule CSS cleanup ay separate follow-up, para hindi masira ang working styling.
11. Full regression at live smoke test.

Isang page per task; test bago lumipat sa susunod.

## Risks and Mitigations

- **CSS specificity/duplicate layers:** gumamit ng bagong scoped `.appPage`/`.appShell` section; i-consolidate ang Live Map overrides sa huli.
- **Nawawalang header actions:** account menu ang sasalo sa Profile/Logout; Dashboard ang home.
- **Modal DOM assumptions:** huwag galawin ang IDs at form structure; wrapper at CSS lang.
- **Role-based visibility:** i-test ang Employee at Admin accounts.
- **Print regression:** i-test ang Reports print preview bago at pagkatapos.
- **Mobile overflow:** i-test ang bawat list page sa 390px.

## Success Criteria

- Lahat ng app pages ay may parehong floating rail at workspace shell.
- Walang site header sa app pages.
- Account menu gumagana sa lahat ng pages.
- Tables readable at walang horizontal scroll sa desktop at mobile.
- Forms at overlays consistent ang itsura at behavior.
- Light/Midnight at print pasado.
- Walang regression sa auth, CRUD, role access, at Live Map.

## Builder Calls (decided here)

- Keep existing IDs at classes; magdagdag lang ng shell classes. Mas mababa ang risk.
- Account menu markup ay nasa bawat page; behavior ay nasa `app.js` para isang implementation lang.
- **Live Map is already full-bleed with overlays.** The remaining work is verifying it after the account-menu behavior moves to `app.js`. Ang dead-rule CSS cleanup ay hiwalay na follow-up, para hindi masira ang gumaganang styling.
- **Rider inline styles:** ililipat verbatim sa `style.css` sa Task 8, walang selector rewrite, para mababa ang risk.
- **Read-only View/history overlays stay as modals in this phase.** Only Live Map's `routeInfo` uses the side panel/bottom sheet pattern. Modal styling will be standardized instead.
- **Print scope:** Reports is fully verified. Other pages must not break when printed and should produce a readable snapshot, but walang per-page print optimization.
- Walang global topbar; page header ang nasa workspace card. Ang account circle ay nasa header.
- Walang pagination; count summary lang, dahil maliit pa ang dataset.

## Rider/Driver Shell (decided)

`rider.html` keeps its own auth guard and does **not** load `app.js`. It gets a minimal shell:

- No admin rail.
- Same visual language: floating workspace card, tokens, typography, controls.
- Brand sa header, Submit Delivery context, Logout.
- Existing back button at auth behavior preserved kung kailangan.
- Account menu markup at `app.js` behavior ay hindi kasama sa page na ito.

## Open Question

Wala nang natitira.
