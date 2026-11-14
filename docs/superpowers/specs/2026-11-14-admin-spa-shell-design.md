# Admin SPA Shell — Design

## Intent

Gawing isang SPA ang **buong admin app** (Dashboard, Deliveries, Live Map, Drivers, Customers, Employees, Reports, Settings) gamit ang **layout grammar** ng reference screenshot, hindi ang kulay nito.

Ang reference ay may:

- persistent, grouped sidebar na may sub-nav;
- topbar na may breadcrumb, search, avatar, at contextual primary action;
- page header na may title, filter chips, at date range;
- two-pane workspace: list sa kaliwa, map o insights sa kanan;
- floating map controls;
- bottom insight panels.

Ang gusto ng user: parehong **structure at flow**, pero existing na palette/themes at DM Sans ang mananatili. Existing content at data lang ang lalabas; walang invent na ETA, truck, o route data.

**Bakit:** Para hindi na magmukhang magkakaibang system ang bawat page, at para isang navigation at workspace pattern lang ang matutunan ng user.

## Current State

- 9 admin pages, bawat isa ay hiwalay na HTML at may sariling shell markup.
- Shared shell ngayon: 56px icon rail, workspace card, account circle, per-page account menu.
- Navigation ay normal page loads (`app.js` `PAGE_MAP`).
- Bawat page script ay top-level at DOM-bound; may magkakaparehong global names (`esc`, `fmtDate`, `$id`, `ICONS`).
- Deliveries may 30s auto-refresh, Dashboard 60s, Live Map 10s/60s.
- Live Map lang ang full-bleed at may map. Customers ay may Leaflet sa address picker modal.
- `index.html` ay redirect sa `live-map.html`.
- `.htaccess` ay walang SPA fallback/rewrite.
- `login.html` at `rider.html` ay standalone at walang admin shell.
- `theme.js` ay nag-a-apply ng theme bago mag-render; ang theme picker ay ginagawa lang sa `DOMContentLoaded`.
- `dashScript.js` ay dead/unreferenced.

## Goals

1. Isang admin SPA shell: sidebar, topbar, page header, workspace, detail rail/insight panels.
2. Pareho ang layout grammar sa lahat ng admin pages, hindi lang Live Map/Deliveries.
3. Existing tokens, themes, DM Sans, at visual identity lang; walang reference colors.
4. Existing data at API calls lang; walang backend/API/database changes.
5. Existing IDs at data logic ay pananatilihin kung praktikal.
6. Deep links, refresh, back/forward, at role-based access ay hindi masisira.
7. Mobile parity: drawer/rail, no horizontal scroll sa 390px, ≥44px targets.
8. Light/Midnight parity at Reports print/export.
9. Lowest-risk migration: shell muna, isang view at a time, cutover sa huli.

## Non-Goals

- Walang pagbabago sa `login.html` layout o auth API behavior.
- Walang admin rail sa `rider.html`; standalone pa rin ito.
- Walang bagong feature na wala sa existing data: ETA, live truck telemetry, route optimization, global search endpoint, bagong reports.
- Walang pagbabago sa map tiles, OSRM, geocode, o routing service.
- Walang bagong color palette o theme.
- Walang build step, bundler, o npm dependency.
- Walang pagbabago sa database schema o PHP endpoints.
- Walang commit/push/upload nang walang permiso.

## Anti-Goals

- Hindi pwedeng mawala ang deep links, refresh, at browser back/forward.
- Hindi pwedeng masira ang Admin/Employee/Driver role rules.
- Hindi pwedeng magkaroon ng horizontal scroll sa 390px.
- Hindi pwedeng mawala ang Reports CSV export at print.
- Hindi pwedeng magkaroon ng duplicate event listeners, duplicate intervals, o duplicate `const` errors pag nagpalit ng view.
- Hindi pwedeng manatili ang lumang admin shell sa tabi ng bagong SPA shell.
- Hindi pwedeng mag-claim ng ETA, truck, o route na wala sa data.

## Constraints

- Static HTML + vanilla JS + PHP API; walang build step.
- Native ES modules at dynamic `import()` ang gagamitin; modern browser lang.
- Hash routing (`#/...`) dahil walang `.htaccess` rewrite at dapat gumana sa XAMPP.
- Existing `style.css` tokens at component styles ang base; bagong shell layout sa hiwalay na `spa.css`.
- Existing API response shapes at field names ay hindi babaguhin.
- Existing page IDs ay pananatilihin kung hindi makakasira sa SPA semantics.
- Assistant must not commit/push/upload without explicit permission.
- Huwag i-print ang credentials.

## Approaches Considered

### A. Shared JS shell, multi-page pa rin

Isang `shell.js` na nagre-render ng sidebar/topbar sa bawat page load; normal URLs pa rin.

- **Wins:** maliit ang risk, keeps URLs/auth/back/refresh, madaling i-rollback.
- **Trades off:** may page reload sa bawat navigation; hindi tunay na persistent shell; kailangan pa ring i-maintain ang 9 HTML pages.

### B. Static shell sa bawat HTML

I-paste ang bagong sidebar/topbar sa 9 pages; CSS lang ang shared.

- **Wins:** pinakasimple, walang bagong router.
- **Trades off:** 9 kopya ng shell; drift kapag may binago; walang persistent state; mahirap i-maintain.

### C. SPA rewrite (chosen)

Isang shell + hash router + view modules.

- **Wins:** tunay na persistent sidebar/topbar; isang shell lang; consistent workspace; selected item at filters ay pwedeng manatili habang nag-navigate; malinis na view boundaries.
- **Trades off:** kailangang i-refactor ang page scripts into mount/unmount modules; URL ay hash-based; mas malaki ang migration scope; kailangang maingat sa cleanup at auth.
- **Bakit pinili:** Ito ang pinili ng user. Ang layout grammar ng reference ay talagang isang persistent app shell; ang SPA ang natural na paraan para mapanatili ito sa lahat ng pages.

## Decisions Already Made

- Admin app ang SPA; `login.html` at `rider.html` ay standalone.
- Maps sa **Live Map** at **Deliveries** lang. Ang customer address picker sa Add/Edit Customer modal ay exception: existing functionality ito, hindi page-level map.
- Bottom chart/insight panels sa **Dashboard** at **Live Map** lang.
- Other row-based pages ay may **selected-item detail preview rail**.
- No backend/API/database changes.
- Existing palette/themes at DM Sans; walang reference colors.
- Nothing gets built until this design is approved.

## Scope

### In scope

- Bagong SPA entry/shell.
- Hash router, auth boot, role guard, route titles/breadcrumbs.
- View modules para sa 8 admin routes.
- Sidebar groups, topbar slots, page header, detail rail, insight panels.
- Deliveries map preview at Live Map two-pane layout.
- Theme picker integration sa Settings.
- Legacy admin URL redirects.
- Print/export at accessibility preservation.
- Migration at cleanup ng lumang admin pages/scripts.

### Out of scope

- `login.html`, `login.js` layout at auth API behavior.
- `rider.html` shell/layout; redirect target lang ang babaguhin.
- PHP endpoints, SQL schema, `.htaccess` rewrites.
- Bagong API, bagong chart data, bagong search endpoint.
- Reference colors, bagong fonts, bagong icon library.

## Information Architecture

### Route table

| Route | View | Group | Roles |
|---|---|---|---|
| `#/dashboard` | Dashboard | Overview | Admin, Employee |
| `#/live-map` | Live Map | Operations | Admin, Employee |
| `#/deliveries` | Deliveries | Operations | Admin, Employee |
| `#/drivers` | Drivers | Operations | Admin, Employee |
| `#/customers` | Customers | Operations | Admin, Employee |
| `#/reports` | Reports | Insights | Admin, Employee |
| `#/employees` | Employees | Administration | Admin only |
| `#/settings` | Settings | Administration | Admin; Employee (profile/security/appearance only) |

Default route: `#/dashboard`. Unknown route: replace with `#/dashboard`. Trailing slash at legacy hash (`#dashboard`, `#deliveries`) ay normalized.

### Legacy URLs

Pagkatapos ng cutover, ang lumang admin pages ay magiging redirect stubs:

- `dashboard.html` → `index.html#/dashboard`
- `deliveries.html` → `index.html#/deliveries`
- `live-map.html` → `index.html#/live-map`
- `drivers.html` → `index.html#/drivers`
- `customers.html` → `index.html#/customers`
- `employees.html` → `index.html#/employees`
- `reports.html` → `index.html#/reports`
- `settings.html` → `index.html#/settings`

Ang `index.html` ay magiging SPA shell. Ang `login.html` at `rider.html` ay mananatiling standalone. Ang server-side `redirect_for()` na `dashboard.html` ay okay pa rin dahil ang stub ang magre-redirect sa SPA; walang backend change.

`login.js` at `rider.js` redirects ay ia-update sa SPA URL:
- staff login → `index.html#/dashboard`
- rider login → `rider.html`
- rider "back to dashboard" → `index.html#/dashboard`

### Deep links at selection

Selected item at active tab ay nasa query string para gumana ang refresh at back/forward:

- `#/deliveries?selected=123`
- `#/live-map?rider=4`
- `#/customers?selected=8`
- `#/drivers?selected=2`
- `#/employees?selected=5`
- `#/settings?selected=3`
- `#/reports?selected=driver:Juan`

Filters na hindi kailangan i-share ay mananatili sa view state. Kapag selected id ay wala na pagkatapos ng refresh, clear ang selection at huwag mag-error.

`#/deliveries?new=1` ay bubuksan ang Add Delivery modal pagkatapos ng mount; aalisin ang query pagkatapos. Ito ang CTA mula Dashboard.

Kapag logged out at binuksan ang deep link, i-save ang kasalukuyang hash at ipasa sa login:

- SPA boot → `login.html?next=` + `encodeURIComponent(location.hash)`.
- `login.js` ay mag-redirect pabalik sa `index.html` + `next` kung staff at valid hash; kung wala, `#/dashboard`.
- Server na `data.redirect` (`dashboard.html`) ay fallback lang; ang stub ang magdadala sa SPA.
- Huwag i-restore ang `next` kung rider/Driver ang role; `rider.html` pa rin.

### Navigation model

- Sidebar groups:
  - **Overview:** Dashboard
  - **Operations:** Live Map, Deliveries, Drivers, Customers, Rider report (outbound)
  - **Insights:** Reports
  - **Administration:** Employees, Settings
- Group headers ay collapsible; active group auto-open.
- Child links ay `<a href="#/...">` na may existing IDs kung kaya (`dashboardButton`, `deliveriesButton`, etc.).
- Active item: `.is-active` + `aria-current="page"`.
- Rider report ay outbound link sa `rider.html`, may external/arrow icon; hidden sa Employee.
- Sidebar footer: signed-in name/role + Logout. Account menu sa topbar ay may Profile at Logout din; isa lang ang behavior implementation.

### Role model

Preserve existing behavior:

- Admin: lahat ng routes at nav items.
- Employee: lahat maliban sa Employees at Rider report. Direct hash sa `#/employees` → `#/dashboard`. Rider report link hidden. Sa Settings, **Profile / Security / Appearance lang** ang makikita; walang user search, `+ Add User`, user-accounts table, o user detail rail dahil `api/users.php` ay Admin-only at ito ang existing behavior.
- Driver/Rider: hindi pumapasok sa SPA; redirect sa `rider.html`.
- Unauthenticated: redirect sa `login.html?next=<hash>`.
- 401 mula sa kahit anong API habang nasa SPA: redirect sa `login.html?next=<hash>`.
- `window.currentUser` at `userready` event ay pananatilihin para sa compatibility ng views habang migration.

## Shell Layout

### Desktop (≥1100px)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ┌──────────────┐  ┌ topbar: breadcrumb · search · avatar · CTA ───┐ │
│ │ sidebar      │  │                                                  │ │
│ │ 248px        │  ├ page header: title/subtitle · chips/date range ─┤ │
│ │ grouped nav  │  │                                                  │ │
│ │              │  │ workspace                                        │ │
│ │              │  │  list/table + map/insights/detail rail            │ │
│ │ footer       │  │                                                  │ │
│ └──────────────┘  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

- App frame: full viewport, `height: 100dvh`, no page-level scroll.
- Sidebar: persistent, 248px, `var(--card)`, border-right, sticky/fixed.
- Topbar: 64px, spans content area, `var(--card)`, bottom border.
- Main: `minmax(0, 1fr)`, `overflow: hidden`; only the view body scrolls.
- Content padding: 24–32px, consistent with existing workspace.
- Page header: title 28–30px/500–600, subtitle 13–14px, chips/date range below or right.
- Detail rail: 340px, sticky, same card background; empty state kapag walang selection.
- Map workspace: left list 360–400px, right map; bottom insight panels 220–260px high under the map only. Left list spans full height.
- No page transition animation; optional 120ms opacity only with reduced-motion guard. Reference is static.

### Tablet (720–1099px)

- Sidebar collapses to 64px icon rail by default; toggle can expand it as an overlay (not push content).
- Topbar search collapses to icon; clicking expands inline.
- Two-pane map: list 300–340px, map right; bottom panels stack under map if height is tight.
- Detail rail becomes 300px; at <900px it becomes a bottom sheet.

### Mobile (≤719px)

- Sidebar becomes off-canvas drawer (280px) with backdrop; hamburger sa topbar.
- Body scroll lock while drawer open; Escape at backdrop click close; focus returns sa hamburger.
- Topbar: hamburger, compact breadcrumb/page title, search icon, avatar, CTA icon.
- Page header stacks: title, subtitle, chips (horizontal scroll inside container), filters.
- Workspace single column.
- Tables become row cards using existing `[data-mobile-cards]` pattern.
- Detail rail becomes bottom sheet with close button; selecting a row opens it.
- Map views: map first or list first? Use list first, map below with a "Map" toggle; selected item scrolls to map. Bottom insight panels stack below map.
- No page-level horizontal scroll at 390px.

## Sidebar

### Expanded

- Logo/brand sa top, collapse button sa right.
- Groups with label, chevron, and child links.
- Child link: icon + label; active pill/fill; focus ring.
- Footer: signed-in user name/role, Rider report link (Admin only), Logout.
- Collapse state persisted sa `localStorage` (`spaSidebar=collapsed|expanded`).

### Collapsed rail

- 64px; icons only with `aria-label`/tooltip.
- Group separators, active icon fill.
- Clicking a group/child navigates; tooltip shows label.
- Hindi kailangang i-implement ang hover flyout sa unang version; labels via tooltip. (Builder call: flyout is optional if time permits.)

### Mobile drawer

- Same expanded structure inside a drawer.
- Backdrop, focus trap, `aria-modal="true"`, `aria-expanded` sa hamburger.
- Close on route change.

## Topbar

Slots, left to right:

1. Mobile hamburger (hidden desktop).
2. Breadcrumb: group / page, e.g. `Operations / Deliveries`.
3. Search: per-view input, icon, placeholder; hidden kapag walang search ang view. On tablet/mobile it collapses to an icon.
4. Spacer.
5. Avatar/account menu: Profile → `#/settings`, Logout → existing confirm + logout.
6. Contextual CTA: one primary action per view; hidden kapag wala.

Search behavior:
- Deliveries: delivery number, customer, driver, address.
- Live Map: rider name, customer name.
- Drivers: name, contact.
- Customers: name, contact, address.
- Employees: name, username, email, contact.
- Settings: user name, username, role — **Admin only**; hidden sa Employee.
- Dashboard/Reports: hidden (no global search endpoint).

CTA behavior:
- Dashboard: `+ New Delivery` → `#/deliveries?new=1`.
- Deliveries: `+ New Delivery` → open Add modal.
- Customers: `+ Add Customer` → open Add modal.
- Settings: `+ Add User` → open Add User modal — **Admin only**; hidden sa Employee.
- Live Map: `Refresh` (manual refresh of locations/deliveries).
- Drivers/Employees/Reports: hidden; Reports has `Export CSV`/`Print` sa page header, not topbar.

## Page Header

Each view renders its own `.viewHead` inside the content area:

- Left: title, subtitle, optional status/updated text.
- Right: secondary actions (e.g. Live Map, Export, Print).
- Below: primary filter chips (All + statuses) and secondary filters/date range.
- Chips are toggle buttons with `aria-pressed`; "All" clears the group.
- Date range uses existing `<input type="date">`; no new date library.
- Keep labels short; no invented metrics.

## Workspace Patterns

### 1. List + detail rail

Used by Drivers, Customers, Employees, Settings (user accounts), Reports (report snapshot).

```text
┌ main list/table ───────────────────────────┬ detail rail 340px ┐
│ page header + filters                      │ selected item     │
│ rows/cards                                 │ actions           │
│                                            │ empty state       │
└────────────────────────────────────────────┴───────────────────┘
```

- Row click selects; selected row has `aria-selected="true"` and visible fill.
- Keyboard: row is focusable; Enter/Space selects; `Esc` clears selection on mobile sheet.
- Detail rail shows only fields already in the loaded row; no extra fetch unless existing action needs it.
- Empty state: "Select a [item] to see details."
- Actions in rail mirror **existing** row actions only. Huwag magdagdag ng destructive capability na wala sa current UI.
- Ang dating View modals ng Drivers, Customers, at Employees ay ire-retire; ang detail rail ang magiging view. Edit/Reset/Delete modals remain.
- Sa Deliveries, ang View modal ay mananatili para sa kumpletong detalye/stops; ang bottom details panel ay summary + actions lang.
- On mobile, rail is a bottom sheet; row click opens it.

### 2. List + map + bottom insight

Used by Deliveries and Live Map.

```text
┌ list 380px ─────────────┬ map ───────────────────────────────┐
│ rows/cards              │ floating controls                  │
│                         ├ insight panel 1 ┬ insight panel 2 ┤
│                         │                 │                  │
└─────────────────────────┴─────────────────┴──────────────────┘
```

- Left list spans full height; map + bottom panels share right column.
- Map fills available space; `min-height` 320px.
- Floating controls: zoom, fit selected, map style (Street/Topo/Satellite), scale.
- On mobile: list, map, then insight panels stacked; map has a fixed 16:9/60vh height.

### 3. Dashboard insight page

- KPI grid, activity chart + status breakdown, recent deliveries + driver status.
- No detail rail; no map.
- Chart panel is the "bottom insight" equivalent.

## View Architecture

### Entry

`index.html` (SPA shell) loads:

- `theme.js` (classic, before body render, for no-flash theme)
- `style.css` (existing tokens/components)
- `spa.css` (new shell/layout styles)
- `<script type="module" src="spa/main.js"></script>`

`spa/main.js` boots auth, router, shell, and current view. No build step.

### Directory

```text
spa/
  main.js          boot + auth + router start
  router.js        hash parse, navigate, route table
  shell.js         sidebar, topbar, page header slots, account menu
  auth.js          me/login/logout, role guard, 401 wrapper
  api.js           fetch helpers + abort signal
  ui.js            shared templates: chips, badges, empty/loading/error, modal, detail rail
  util.js          esc, date, number, debounce, focus helpers
  map-loader.js    lazy Leaflet/MapLibre loader + cleanup helpers
  theme-picker.js  theme select creation for Settings
  views/
    dashboard.js
    deliveries.js
    live-map.js
    drivers.js
    customers.js
    employees.js
    reports.js
    settings.js
```

### View module contract

```js
export default {
  route: "deliveries",
  title: "Deliveries",
  group: "Operations",
  async mount(root, ctx) {
    // render markup, bind events, load data
    return () => {
      // clear intervals, abort fetches, remove maps/listeners
    };
  },
};
```

- `root`: view container; all queries scoped here.
- `ctx`:
  - `user`
  - `route` (`{ path, params }`)
  - `navigate(path, { replace })`
  - `setQuery(params, { replace })`
  - `setSearch({ placeholder, value, onInput })` / `clearSearch()`
  - `setCta({ label, onClick })` / `clearCta()`
  - `setPageMeta({ title, group })` (optional; route meta is default)
  - `toast(message, type)`
  - `confirm(message)`
  - `signal` (`AbortSignal`) at `onCleanup(fn)` kung kailangan
- Router calls previous cleanup, clears `root`, dynamically imports the next view, then mounts.
- Isang view lang ang mounted at a time. Walang hidden views na tumatakbo sa background.
- Shared state (selected item, filters) ay nasa view module o URL; walang global mutable page state.

### Router

- Hash-based: `#/path?query`.
- `hashchange` at initial load ang nagti-trigger ng route.
- `navigate` uses `location.hash = ...` for push; `location.replace("#/...")` for replace.
- `setQuery` updates only the query, preserving path; use replace para hindi mag-spam ng history sa filter changes. Selected item changes use push.
- Unknown route → replace dashboard.
- `document.title = "<Page> | Delivery Project"`.
- Scroll content to top after mount; focus the view `<h1>` (`tabindex="-1"`) o main container para accessible ang route change.
- Skip link ay `<a href="#mainContent" data-skip>`; click handler `preventDefault()` at focus ang main. Hindi ito dapat magpalit ng hash/route.

### Auth boot

1. Parse route from hash.
2. Show a minimal branded loading state; hide shell until auth resolves.
3. `GET api/auth.php?action=me`.
4. If not ok → `location.replace("login.html?next=" + encodeURIComponent(location.hash))`.
5. If role not Admin/Employee → `location.replace("rider.html")`.
6. If Employee at route ay `#/employees` → replace `#/dashboard`.
7. Set `window.currentUser`; dispatch `userready`.
8. Render shell with allowed nav; mount route.
9. Any API 401 → `location.replace("login.html?next=" + encodeURIComponent(location.hash))`.

`login.js`:
- Kung may `next` na valid hash (`#/...`), staff login → `index.html` + `next`.
- Kung wala, staff → `index.html#/dashboard`.
- Kung rider/Driver → `rider.html`; huwag i-restore ang admin `next`.
- Kung naka-login na at may `next`, same rule.

Keep the current global fetch 401 wrapper in `spa/auth.js` or `spa/api.js`; huwag i-double-wrap ang fetch.

### Shared helpers

Move repeated logic out of page scripts:

- `esc` (HTML escape)
- `fmtDate`, `fmtDateTime`, `todayKey`
- `num`
- `statusBadge`, `statusChip`
- `emptyState`, `loadingState`, `errorState`
- `debounce`
- `openModal`/`closeModal`, focus trap, focus restore
- `toast`/`confirmBox` (existing behavior)

Existing `app.js` global `alert` at `confirmBox` ay ire-retire; views import `toast`/`confirm`. Huwag mag-global `alert` na sasapawan ang native `alert`.

### Modals

- Modal markup stays inside the owning view.
- Shared focus trap: topmost `[aria-modal="true"]`; Tab loops; Escape closes; focus returns sa opener.
- Remove duplicate per-page Tab traps from old scripts.
- Confirm dialog (`confirmBox`) remains global/shared; destructive confirm uses `btnDanger`.
- On route change, close any open modal at unmount.

### Maps

- Lazy-load Leaflet only when a view needs it; MapLibre + leaflet-maplibre plugin only for Live Map topo style.
- `map-loader.js` caches promises; loads CSS/JS once; rejects with a user-facing error.
- Live Map: Leaflet + MapLibre + plugin.
- Deliveries: Leaflet only.
- Customers: Leaflet only inside Add/Edit modal; no page-level map.
- On unmount: `map.remove()`, clear layers, remove resize observers/listeners, null out map refs.
- After mount/layout, call `invalidateSize()` on the next frame; also on sidebar collapse/resize.
- If map fails to load: show inline "Map unavailable" message; list/filters/actions still work.
- Map style picker at floating control; existing `theme.js` style persistence.

### Theme integration

- `theme.js` stays classic and applies saved theme before render.
- Refactor theme picker creation into `spa/theme-picker.js` (or expose `window.renderThemePicker(slot)` from `theme.js`).
- Settings calls the picker renderer after mount; `DOMContentLoaded`-only behavior is not enough in SPA.
- Map theme changes continue via existing `data-theme` observer; views that draw routes re-read tokens on change.
- No new theme tokens/colors.

### Cleanup checklist (per view)

- Clear `setInterval`/`setTimeout`.
- Abort in-flight fetches.
- Remove document/window listeners added by the view.
- Remove Leaflet/MapLibre maps.
- Close modals/bottom sheets.
- Revoke object URLs (proof preview/photo viewer) kung meron.
- Reset module-level state kung ang module ay ire-reuse.

## Per-View Templates

### 1. Dashboard

**Layout**

- Page header: greeting, date, "updated" status; secondary `Live Map` action; topbar CTA `+ New Delivery`.
- KPI grid: Total deliveries, Active now, Delivery rate, Overdue. Preserve existing IDs (`kpiTotal`, `kpiActive`, `kpiRate`, `kpiOverdue`) and footnotes.
- Main grid: Delivery activity chart (2/3) + status breakdown (1/3). Existing 7/30/year period select.
- Bottom grid: Recent deliveries (5) + Driver status (Available/On Route/Offline). Existing dashboard API fields.

**Data**

- `api/dashboard.php` only. No new endpoint.
- Existing count-up animation; respect reduced motion.

**Interactions**

- KPI/Recent rows: `View` goes to `#/deliveries?selected=<id>` kung may id; kung wala, `#/deliveries`.
- `Live Map` → `#/live-map`.
- `+ New Delivery` → `#/deliveries?new=1`.
- Period select reloads chart only (or whole dashboard like now); keep behavior.

**States**

- Loading skeleton for KPI/chart/table; error inline with retry; empty recent list message.
- Chart has accessible table/description (existing).

**Responsive**

- 4 KPI columns → 2 → 1.
- Chart/status stack; recent/driver stack.

### 2. Deliveries

**Layout**

- Page header: title/subtitle; status chips `All`, `Pending`, `Processing`, `Out for Delivery`, `Delivered`, `Cancelled`; driver select; date input; `+ New Delivery` CTA.
- Left list 380px: delivery rows/cards with status badge, delivery number, customer, driver, date, stop count. Selected row highlighted.
- Right: map (top) + selected delivery details (bottom panel).
- Details panel: delivery number, customer(s), driver, date, status, item/quantity if existing, actions View/Edit/Status/History/Delete.
- Modals: Add/Edit, Update Status, History, View (View may be replaced by details panel; keep modal only if needed for long content).
- Mobile: list first, map below, details sheet.

**Data**

- `api/deliveries.php` list, `?id=`, `?action=stops`, `?action=events`.
- `api/customers.php`, `api/drivers.php` for filters/names.
- Map pins: match selected delivery's customer/stop names to customer coordinates from `api/customers.php`. Match by name and, kung possible, address. If no match/coords, show "No map location for this customer yet." No route line; destination pins only.

**Interactions**

- Search/filter client-side as today; preserve 30s auto-refresh, paused when tab hidden or a modal/sheet is open; clear interval on unmount.
- Row select updates map + details + `?selected=`.
- Add/Edit/Status/History/Delete preserve existing validation, confirmations, and API payloads.
- `?new=1` opens Add modal after data loads; remove query.
- Empty/error states per pane; if list fails, map shows empty.

**Responsive**

- Desktop: list + map + details.
- Tablet: narrower list, map right, details bottom.
- Mobile: cards, map toggle, details bottom sheet; no horizontal scroll.

### 3. Live Map

**Layout**

- Page header: title, updated status; chips `All`, `Live` (updated ≤5 min), `Stale` (>5 min); search filters rider list.
- Left list 380px: rider cards with status dot, name, active delivery count, last update, stop preview. Selected highlighted.
- Data source is the existing merge of `api/route.php` (riders with `Out for Delivery` route) and `api/location.php` (riders with an active delivery and a reported location). Walang `api/drivers.php` merge at walang "No active delivery" bucket; hindi ito existing behavior at walang location data ang offline drivers.
- Right: map top; bottom insight panels:
  - **Route overview:** segmented horizontal bar per stop using existing route leg distances (`km`) and total; labels; "straight line" note when applicable. No ETA.
  - **Rider details:** selected rider, last update, active delivery count, stops/customers, distance from company; empty state kapag walang selection.
- Floating map controls: zoom, fit selected, style picker, scale. No fake locate/truck controls.
- Mobile: list, map, insights stacked; rider list drawer optional (existing toggle behavior can be reused).

**Data**

- `api/route.php` (active riders, trail, stops), `api/location.php` (last locations).
- Existing 10s location refresh, 60s delivery refresh; clear on unmount; pause when hidden.
- No new ETA/route geometry.

**Interactions**

- Select rider → draw route/stops, update details and route overview, update `?rider=`.
- Refresh CTA → manual `refreshLocations` + `refreshDeliveries`.
- Map style persists via `theme.js`.
- Escape closes mobile list/detail sheet.
- If no riders: empty state in list + map centered on company; no fake data.

**Responsive**

- Desktop: full map and panels.
- Tablet: narrower list; panels may stack vertically.
- Mobile: map 55–60vh; list/insights below; floating controls smaller but ≥44px.

### 4. Drivers

**Layout**

- Page header: title/subtitle; status chips `All`, `Available`, `On Route`, `Offline`; search.
- Main table + detail rail (340px).
- Table columns: Driver ID, Driver, Contact, Deliveries, Status, Action. Existing `[data-mobile-cards]`.
- Status editing stays as the existing inline row `<select>`; huwag itong ilipat sa rail.
- Detail rail: name, contact, status, delivery count, actions View/Edit; ang rail mismo ang view (retire ang View modal). Empty state.
- No delete button: may dead delete handler sa old script pero walang Delete button sa current UI. Huwag i-expose sa SPA.
- No map, no create CTA (drivers are created via Settings).

**Data**

- `api/drivers.php` only. Preserve existing edit and inline status update flows; remove the dead delete branch.

**States**

- Loading/error/empty in table; detail rail empty until selection.

### 5. Customers

**Layout**

- Page header: title/subtitle; search; `+ Add Customer` CTA.
- Main table + detail rail.
- Table columns: Customer, Contact, Address, Deliveries, Action.
- Detail rail: name, contact, address, delivery count; actions Edit/Delete. Ang rail mismo ang view (retire ang View modal).
- Add/Edit modal keeps the existing Leaflet address picker (exception to map rule); no page-level map.

**Data**

- `api/customers.php`, `api/geocode.php` inside modal only.
- Preserve address validation and field-level errors.

**States**

- Empty/error; long address wraps; mobile cards.

### 6. Employees

**Layout**

- Admin only.
- Page header: title/subtitle; role/status selects; search.
- Main table + detail rail.
- Table columns: Employee ID, Full Name, Username, Email, Contact, Role, Status, Action.
- Detail rail: full profile, role/status, last login, linked driver if existing; action View only (existing). Ang rail mismo ang view (retire ang View modal).
- No create CTA (user creation is in Settings).

**Data**

- `api/users.php` only (Admin-only). Preserve role/status filters; move the existing View modal fields into the rail.

**States**

- Empty/error; Employee role cannot reach route.

### 7. Reports

**Layout**

- Page header: title/subtitle; date range From/To; Generate, Reset, Export CSV, Print; rider filter.
- Summary cards: Total Deliveries, Delivered, Cancelled, Delivered Rate.
- Main: two-column grid of report tables (Rider Report, By Driver, By Customer, By Month) + right detail rail "Report snapshot".
- Detail rail: selected period totals and selected row breakdown (total/delivered/cancelled); proof photo link if selected rider report row and existing `proof_image`.
- Print: only report content; shell/sidebar/topbar/filters/detail rail hidden; light colors; existing `.printInfo`.

**Data**

- `api/reports.php` only. Preserve CSV logic (`csvCell`, BOM, hyperlink) and print period.
- No new chart.

**States**

- No report loaded: guidance; invalid date range message; zero data; long tables scroll.

**Responsive**

- Summary 4 → 2 → 1; tables stack; detail rail becomes bottom sheet; print unchanged.

### 8. Settings

**Layout**

- Page header: title/subtitle; search users (Admin only); `+ Add User` CTA (Admin only).
- Top cards: Profile, Security, Appearance (theme picker) — visible sa lahat ng roles.
- Lower workspace: User Accounts table + detail rail — **Admin only**.
- Table columns: Name, Username, Role, Contact, Status, Action.
- Row actions (existing): **Edit**, **Reset password**, **Delete**. Walang hiwalay na Disable action; nasa loob ng Edit modal ang Active/Disabled status.
- Detail rail: selected user profile/role/status/linked driver; actions Edit/Reset Password/Delete.
- Theme picker rendered after mount via shared theme-picker helper.

**Employee variant**

- Profile, Security, at Appearance cards lang. Walang user search, CTA, accounts table, o detail rail.
- Huwag tawagin ang `api/users.php` para sa Employee; `api/auth.php?action=me` lang at existing profile/password endpoints.
- Preserve current `settings.js` behavior na nagtatago sa user-accounts panel at Add User.

**Data**

- `api/auth.php?action=me`, `api/users.php` (Admin only); existing profile/password/theme flows.
- Preserve password validation, profile update, user add/edit/reset/delete, and Active/Disabled inside Edit.

**States**

- Profile/security loading; theme picker fallback if `themeSlot` missing; empty users; error; Employee variant without user UI.

**Responsive**

- Cards 3 → 1; table cards; detail rail bottom sheet.

### 9. Rider (standalone)

- No admin shell, no SPA router, no new layout.
- Only redirect target update: back to `index.html#/dashboard`.
- Existing auth, proof upload, location, and minimal shell preserved.

### 10. Login (standalone)

- No shell/layout change.
- Update client redirect mapping to SPA; keep API payload/behavior.
- If already logged in, staff → `index.html#/dashboard`; rider → `rider.html`.

## Cross-Cutting

### Theming at visual system

- Existing tokens lang: `--background`, `--card`, `--foreground`, `--muted-foreground`, `--border`, `--primary`, `--accent`, `--secondary`, `--destructive`, `--green`, `--blue`, `--ring`.
- No reference navy/violet; no new hardcoded colors.
- DM Sans at existing scale (28–30px page title, 16–18px section, 13–14px body, 10–12px metadata).
- Use existing 8/12px radii, borders, and shadows; no new decorative halos.
- Active nav uses existing `--secondary`/`--accent` treatment, not a new color.
- Status chips/badges reuse existing status classes/colors.

### Responsive rules

- Breakpoints: 1100px (sidebar collapse), 900px (detail rail → sheet), 720px/650px (mobile drawer/cards), 430px (compact).
- No page-level horizontal scroll at 390px.
- Chips row horizontal scroll only inside its container; scrollbar hidden but keyboard reachable.
- Touch targets ≥44px.
- Topbar search expands/collapses without layout jump.
- Mobile drawer/sheet focus trap + Escape + backdrop close.
- iOS inputs remain 16px at ≤650px (existing fix).

### Accessibility

- Landmarks: `header`, `nav`, `main`; one `h1` per view.
- Skip link focuses main without changing route.
- `aria-current="page"` on active nav; `aria-expanded` on groups/drawer.
- Search labels; chips have accessible names; selected rows `aria-selected`.
- Detail rail updates announced with `aria-live="polite"` (or focus moves to rail on mobile).
- Modals: `aria-modal`, labeled, focus trap, focus restore; Escape.
- Map has text alternative; selected rider/delivery details are in DOM, not only map.
- Charts have accessible table/description.
- Focus visible via existing `:focus-visible` ring.
- Reduced motion: no route/map animation when `prefers-reduced-motion`.
- Long text wraps; no clipped names/emails/addresses.

### Print

- `@media print` hides sidebar, topbar, page header actions, chips/toolbars, detail rail, bottom sheets.
- Main content resets to static/auto height/overflow visible.
- Reports: keep `.printInfo`, summary cards, tables; page background white; borders visible.
- Only the active view is printed; other routes are unmounted.

### Performance

- Dynamic import per view; maps lazy.
- Avoid loading Leaflet/MapLibre on Dashboard/Reports/Settings.
- Pause intervals when `document.hidden`; clear on unmount.
- Debounce search input.
- Reuse cached customers/drivers lists within a view; refetch on view mount or manual refresh.
- No duplicate fetches on route change.
- Cache-bust module imports with `?v=3` if needed during rollout.

### Error, loading, empty states

- Every view: loading skeleton/status, error with retry, empty with guidance + primary action if applicable.
- Map: "Map unavailable" fallback; list remains usable.
- Detail rail: "Select an item" empty state.
- If selected id disappears after refresh: clear selection, keep list usable.
- Toasts: existing `toast` behavior; errors 7s, success 4s, long messages wait for close.
- Confirm destructive actions with existing `confirmBox`.

### Security/role

- No new API calls or permissions.
- Preserve `api/auth.php?action=me` boot check and 401 redirect.
- Employee route guard for `#/employees`; hide Rider report.
- Do not expose user data that the current page/API did not already expose.
- Logout clears session via existing endpoint; no credentials in console/logs.

## Migration Sequence

Phased; old app remains usable until cutover.

### Phase 0 — Preparation

- Add `spa/` directory, `spa.css`, and `index.html` shell behind a temporary entry (`spa.html` if needed).
- Keep old admin pages/scripts untouched.
- Add shared utils and map loader.
- Add route table and auth boot.

### Phase 1 — Shell + Dashboard pilot

- Build sidebar/topbar/page header shell.
- Build Dashboard view.
- Verify auth, roles, theme, responsive, route focus.
- No other routes migrated yet; temporary placeholder only for unbuilt routes.

### Phase 2 — Read-only/list views

- Drivers → Employees → Customers.
- Build detail rail pattern, mobile sheet, filters, empty/error states.
- Preserve view/edit/delete flows.

### Phase 3 — Settings

- Profile/security/theme cards, user accounts table, detail rail.
- Integrate theme picker after mount.
- Preserve password/profile/user CRUD.

### Phase 4 — Deliveries

- List + map + details, modals, status/history, auto-refresh.
- Add map pin matching via customers API; no route line.
- Test deep link `?selected=` and `?new=1`.

### Phase 5 — Live Map

- Lazy maps, rider list, route overview, rider details, refresh intervals.
- Test map style, themes, mobile sheets, cleanup.
- Remove old floating route-info overlay; move details to insight panel.

### Phase 6 — Reports

- Summary cards, tables, detail rail, CSV, print.
- Verify print CSS from SPA.

### Phase 7 — Cutover

- Make `index.html` the SPA shell.
- Replace old admin HTML files with redirect stubs.
- Update `login.js`/`rider.js` redirects.
- Retire `app.js`/`dashScript.js` (or leave dead files for one verification pass, then remove).
- Remove unused old `.appPage`/`.liveMapPage` CSS only after SPA parity is verified; keep tokens/components.
- Verify legacy links, server redirect, login, rider.

### Phase 8 — Verification and cleanup

- Full manual matrix (below).
- Remove dead code/CSS, duplicate handlers, unused IDs.
- Confirm no console errors, no duplicate intervals, no memory leaks on route switching.
- Ask permission before commit/push.

## Testing and Verification

### Test-data safety

- Destructive checks (delete delivery/customer/user, status changes, password reset) ay gagawin lang sa **records na ginawa para sa test**, at lilinisin pagkatapos.
- Huwag mag-delete o mag-edit ng existing/live records.
- Kung may disposable local DB copy, iyon ang gamitin; kung wala, create-and-delete test records lang.
- Huwag i-print ang credentials o API keys sa logs/terminal.

### Auth/roles

- Logged out → login, with `next` hash preserved.
- Admin → all routes.
- Employee → no Employees/Rider report; direct `#/employees` redirects dashboard; Settings is profile/security/appearance only (no user table/search/CTA/rail).
- Driver/Rider → rider page, not SPA; `next` is not restored.
- 401 during view → login with `next`.
- Logout confirm → login; back button does not restore protected view.
- Deep link `#/deliveries?selected=123` → login → returns to same route after staff login.

### Routing

- Refresh each hash route.
- Back/forward across routes and selected ids.
- Unknown hash → dashboard.
- Legacy `.html` links → correct SPA route.
- `#/deliveries?new=1` opens modal once; query cleared.
- Skip link focuses main and does not change route.
- Document title/breadcrumb update.

### Layout/responsive

- 1440/1280/1024/768/390 widths.
- Sidebar expanded/collapsed/drawer; no overlap; focus trap.
- Topbar search/CTA responsive.
- Two-pane list+map; bottom panels; detail rail/bottom sheet.
- No horizontal scroll at 390px.
- Long names/emails/addresses/status labels.
- Light and Midnight themes; Ocean/Sunset spot check.

### Functional parity

- Dashboard KPIs/chart/period/recent.
- Deliveries create/edit/status/history/delete/filters/auto-refresh; map pins.
- Live Map selection, route, stops, refresh, style; no fake ETA.
- Drivers view/edit/inline status (no delete button); Customers view/edit/delete; Employees view; Settings profile/password/theme, and Admin-only user add/edit/reset/delete.
- Reports generate/reset/filter/export/print.

### Maps

- Leaflet loads only when needed.
- Live Map topo style (MapLibre) and fallback.
- Deliveries destination pins; no coords → message.
- Customers address picker still works in modal.
- Map cleanup on route change; no "Map container is already initialized" error.
- `invalidateSize` after sidebar collapse/resize.

### Accessibility/print

- Keyboard-only navigation, modals, drawer, chips, rows.
- Screen reader landmarks/labels/live regions.
- Focus visible; focus restore.
- Reduced motion.
- Reports print preview; no shell/chrome; readable tables.

### Performance/cleanup

- Navigate away/back multiple times; no duplicate listeners/intervals/fetches.
- Network tab: no repeated map library loads.
- Console: no errors/warnings from Leaflet/MapLibre/duplicate IDs.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Page scripts collide (`const esc`, globals) | Convert to modules; shared utils; no global page scripts. |
| Duplicate intervals/listeners after route switch | Mount returns cleanup; clear intervals/abort/listeners; test repeated navigation. |
| Leaflet "container already initialized" | `map.remove()` on unmount; fresh container per mount; null refs. |
| Auth flash / wrong role | Boot check before showing shell; role guard; 401 wrapper. |
| Deep links break | Hash routes + legacy stubs; selected id in query; refresh test. |
| Print broken by SPA shell | Print CSS resets frame; only active view; Reports print test. |
| Theme picker missing after mount | Shared `renderThemePicker(slot)` called by Settings. |
| Topo MapLibre load failure | Fallback to raster topo; map error message; list remains. |
| Deliveries map has no coords | Match customers by name/address; show honest empty state. |
| Scope creep into backend | No API/schema changes; use existing endpoints only. |
| Old shell remains | Cutover stubs + retire old CSS/scripts after parity. |

## Builder Calls

These are decisions made here so the builder does not guess:

- Default route is Dashboard, not Live Map.
- Sidebar groups: Overview, Operations, Insights, Administration. Rider report is an outbound link under Operations, Admin-only.
- Collapsed rail shows all destinations as icons with tooltips; no hover flyout in v1.
- Topbar search is per-view; hidden on Dashboard/Reports; hidden on Settings for Employee.
- Topbar CTA on Settings is Admin-only.
- Employee Settings is profile/security/appearance only; no user table, search, CTA, or rail.
- Deliveries map shows destination pins only, no route line; coordinates come from Customers API.
- Live Map chips are All/Live/Stale; no "No active delivery" bucket at no drivers-API merge.
- Live Map route overview uses existing leg distances; no ETA.
- Reports detail rail shows the selected aggregate row + period totals, not a new chart.
- Customers Add/Edit modal keeps the existing address-picker map.
- Drivers keep inline status editing; no Delete button. Settings actions are Edit/Reset Password/Delete, not Disable.
- View modals for Drivers/Customers/Employees are retired in favor of the detail rail; Deliveries keeps its View modal for full details.
- Legacy admin pages become redirect stubs only at cutover, not during development.
- Deep links survive the logged-out → login round-trip via `next`.
- No new color tokens; no new fonts.

## Success Criteria

- One persistent admin shell; all 8 admin routes use it.
- The layout reads like the reference's structure: grouped sidebar, topbar, page header with chips/date range, two-pane workspace, floating map controls, bottom insight panels.
- Existing palette/themes and DM Sans are unchanged.
- No invented data; every number/label comes from existing APIs/DOM.
- No backend/API/database changes.
- Deep links, refresh, back/forward, roles, print/export, and mobile all pass.
- Rider and login remain standalone.
- No duplicate intervals/listeners/maps after route switching.
- No commit/push/upload without explicit permission.
