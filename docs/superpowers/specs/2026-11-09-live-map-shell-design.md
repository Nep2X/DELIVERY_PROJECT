# Live Map Shell — Design

## Intent

Gawing map-first ang **Live Map page only**, gayahin ang format/placement ng reference:

- Isang rounded app shell
- Left icon rail na dikit sa left control panel
- Mapa ang main space
- Floating right panel para sa delivery details
- Top bar na nakapatong sa mapa
- Map controls sa bottom-right

**Hindi kasama:** color changes, bagong theme, ibang pages, backend/API changes.

## Scope

Files:

- `live-map.html` — restructure ng page shell
- `style.css` — bagong Live Map layout at responsive rules
- `live-map.js` — selection/details panel at mobile toggles

Hindi gagalawin:

- `theme.js`
- `api/route.php` at ibang API
- Dashboard, Deliveries, Reports, Settings, at iba pang pages

## Layout

### Desktop

```text
┌─────────────────────────────────────────────────────────────┐
│ ┌────┬──────────────┬──────────────────────────────────────┐ │
│ │    │              │  Live Map        updated   [account] │ │
│ │rail│ Riders list  │                                      │ │
│ │    │              │              MAP                     │ │
│ │    │              │                         ┌──────────┐ │ │
│ │    │              │                         │ Delivery │ │ │
│ │    │              │                         │ details  │ │ │
│ │    │              │                         └──────────┘ │ │
│ │    │              │                              [zoom]  │ │
│ └────┴──────────────┴──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- Shell: rounded, bordered, `overflow: hidden`, halos buong viewport height.
- Left rail: existing `optionSec`; icons at top, logout sa bottom.
- Left panel: existing Riders list (`liveList`), attached sa rail, may sariling scroll.
- Map: fills the remaining center area.
- Right floating panel: delivery details ng selected rider; may close button.
- Top bar: overlay sa map; title, updated status, account button.
- Bottom-right: Leaflet zoom + scale controls.

### Mobile

- Rail remains attached sa left.
- Riders panel hidden by default; may “Riders” button sa top bar para buksan.
- Right delivery details panel becomes bottom sheet kapag may selected rider.
- Close button sa details sheet.
- Map controls remain bottom-right, above the sheet.

## Behavior

- Click rider → highlight sa list, draw route, populate right panel.
- No selected rider → right panel shows “Select a rider to view delivery details.”
- Close details panel → clear selection at hide panel; route/marker cleared.
- Account button → menu with **Profile** at **Logout**.
- Existing route drawing, pins, theme switching, at auto-refresh ay mananatili.

## Right Panel Content

Gamit lang ang existing route data:

- Rider name
- Last updated
- Total distance from company
- Delivery number
- Customer name
- Address
- Stop order at distance
- “Address not on the map yet” warning kung applicable

Walang bagong API field.

## Colors

Existing CSS tokens lang:

- `--card`, `--background`, `--secondary`
- `--border`, `--border-soft`
- `--foreground`, `--muted-foreground`
- `--primary`, `--accent`

Walang bagong palette. Gagana sa Light at Midnight themes.

## Accessibility

- Account button may `aria-label`.
- Details close button may `aria-label`.
- Riders panel toggle may `aria-expanded`.
- Selected rider retains `aria-pressed`.
- Focus visible sa lahat ng bagong controls.
- Mobile touch targets ≥44px.

## Non-goals

- Walang pagbabago sa ibang pages.
- Walang pagbabago sa kulay/theme.
- Walang pagbabago sa map tiles o routing service.
- Walang bagong delivery fields o database changes.

## Open Decision

Ito ay para sa **Live Map page only**. Kapag okay ang resulta, saka pag-uusapan kung gagawin din sa Dashboard.
