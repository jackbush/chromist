# Chromist — Implementation Plan

## Decisions locked

| Area | Decision |
|---|---|
| Stack | Vite + React + TypeScript, plain CSS (custom properties), static deploy |
| Picker | `react-colorful` (2.8kB, zero deps) + `culori` for colour maths |
| Persistence | `localStorage` for pins + settings; URL hash for sharing |
| Editor scope | Live edit of existing pins, drag-to-reorder, save/revert |
| Desktop (>768px) | Left/right split; pins become horizontal bands |
| 7-pin cap | `+` column hidden at 7, returns on delete |
| Theme | Neutral (70% grey, default) / Black / White |
| Type | Monospace throughout |

## Assumptions (flag if wrong)

- **Neutral grey** = `#4d4d4d` (70% grey in the photographic sense: 70% *density*, i.e. reflecting ~30%). If you meant 70% *lightness* it's `#b3b3b3`. Both are one constant to change.
- **Live edit + revert**: editing a pinned colour updates its stripe live. The action bar shows `REVERT` while a pin is dirty; leaving the editor or pinning something else commits. No modal confirmations.
- **Copy is silent**, as specified — no toast. Brief inline flash of the hex cell only (~200ms) so the tap doesn't feel dead. Say the word and it becomes literally nothing.
- Palette in the hash loads *additively over nothing* — a shared link replaces the current working palette, with the previous one recoverable via undo-free `localStorage` backup key. If that's too clever, it just replaces.

## Phase 1 — Scaffold

- [ ] `npm create vite@latest . -- --template react-ts`; strip boilerplate
- [ ] Add deps: `react-colorful`, `culori`
- [ ] Global CSS reset + monospace stack (`ui-monospace, SFMono-Regular, Menlo, monospace`)
- [ ] Theme as CSS custom properties on `:root` — `--bg`, `--fg`; three theme classes
- [ ] `.gitignore`, base `index.html` title/meta

## Phase 2 — State layer

- [ ] `types.ts` — `Pin { id, hsl }`, `Theme`, `PickerStyle`, `Settings`
- [ ] `usePalette()` — pins array (max 7), add / update / remove / reorder
- [ ] `useSettings()` — theme, picker style; persisted
- [ ] `storage.ts` — localStorage read/write, versioned key, safe parse
- [ ] `urlHash.ts` — encode/decode `#p=hex,hex,...`; read on mount, write on change

## Phase 3 — Layout shell

- [ ] `App.tsx` — two panes + action bar
- [ ] Mobile: pins top 50vh, editor bottom 50vh, action bar pinned bottom
- [ ] Desktop (`min-width: 768px`): pins left 50%, editor right 50%, action bar top
- [ ] Action bar: small title left, settings cog right
- [ ] Use `100dvh` and `env(safe-area-inset-bottom)` so iOS chrome doesn't eat the bar

## Phase 4 — Pinned pane

- [ ] `PinnedPane` — equal-width flex children; N pins + optional `+` column
- [ ] Mobile: vertical stripes, hex bar across the top of the pane
- [ ] Desktop: horizontal bands, hex cell at the left of each band
- [ ] Hex bar cells styled `background: var(--bg); color: var(--fg)`
- [ ] Click hex cell → `navigator.clipboard.writeText` (silent) + micro-flash
- [ ] Click stripe body → load into editor (selects that pin)
- [ ] Click `+` → editor opens on current theme background colour, in "new" mode
- [ ] `+` hidden when `pins.length === 7`
- [ ] Empty state: "pin a colour to get started", centred, `+` column still present
- [ ] Delete control per pin (small `×`, appears on selected pin)

## Phase 5 — Editor pane

- [ ] `Editor` — reads selected pin or draft colour
- [ ] Three picker styles behind one interface:
  - `sliders` — minimal H/S/L sliders (default)
  - `square` — `<HslColorPicker>` saturation square + hue bar
  - `wheel` — `<HslaColorPicker>` wheel variant
- [ ] Large live hex readout, monospace, tappable to copy
- [ ] Primary action: `PIN` (new) / `REVERT` (dirty existing) / nothing (clean existing)
- [ ] Live write-back to the selected stripe on every change

## Phase 6 — Settings popup

- [ ] Cog → popover anchored to the bar; click-outside + Esc to close
- [ ] "Theme": Neutral / Black / White — swaps `--bg`/`--fg`, persists
- [ ] "Colour picker": Sliders / Square / Wheel — persists
- [ ] Focus trap + `aria-*` on the trigger and dialog

## Phase 7 — Reorder & share

- [ ] Drag-to-reorder stripes (pointer events, no dnd library — 7 items max)
- [ ] Copy-share-link action in the settings popup, writes current hash to clipboard
- [ ] Loading a `#p=` URL seeds the palette

## Phase 8 — Verify

- [ ] Manual pass at 375px, 768px, 1440px
- [ ] Touch-drag on real iOS Safari (sliders and reorder are the risky bits)
- [ ] Clipboard on non-secure origin — fall back to `document.execCommand` path
- [ ] Contrast check of hex bar text against all three themes
- [ ] Reload persistence; shared-link round trip
- [ ] `npm run build` clean, no TS errors

## Out of scope for v1

Harmony suggestions, tint/shade ramps, CSS/JSON/ASE export, OKLCH-based generation.
`culori` is in from day one so these stay cheap to add later.

## Review

All eight phases built. `npm run build` clean, `npm run check` 29/29.

### Two bugs found and fixed during verification

1. **Colour drift on round trip.** HSL was rounded to integers on import, but
   integer HSL has ~3.7M states against hex's 16.7M — so `#2e86ab` came back as
   `#2e87ad`. Every share-link load or reload would have shifted the palette.
   Fixed by storing full precision and rounding only at display; six hex values
   now round-trip exactly (`checks/logic.ts`).
2. **history.replaceState flood.** Persistence ran on every change, so dragging
   a slider fired a `replaceState` per pointer event. Safari rate-limits these
   (~100 / 30s) and throws. Writes are now debounced 250ms, with a `pagehide`
   flush so the last edit is never lost.

### Verified

Headless Chrome against the dev server, driven through a same-origin iframe
harness (Chrome clamps its own window to 500px, so a real 390px viewport needed
the iframe). Captured and checked: mobile empty state, 3 pins, 7 pins (`+`
hidden, button reads "full"), settings popover, all three themes, all three
picker styles, pin selection (outline, delete ×, editor loads the colour,
button reads "pinned"), and the desktop left/right split with horizontal bands.

Desktop editor was restyled mid-review: centring the picker in a tall pane left
the controls stranded, so it now stacks from the top.

### Not verified — needs a real device

Touch drag on iOS Safari, for both the range inputs and drag-to-reorder. These
are the parts most likely to need adjustment. Clipboard also needs a check over
plain http on a phone, where the `execCommand` fallback path takes over.

### Notes

`react-colorful` ships square-and-hue-bar pickers only — it has no wheel — so
the wheel style was hand-built. (Removed in the revision below.)

---

## Revision — editor simplification and undo/redo

Requested after the first build.

- [x] Colour picker setting dropped; always the square + hue bar
- [x] Picker fills the editor pane, with only the hex code above it
- [x] Hex code centred and editable — type or paste to set the colour
- [x] `+` pins a theme-coloured stripe immediately and focuses the editor on it
- [x] Pin/revert button removed; no draft state left in the app
- [x] Undo/redo arrows in the action bar, plus cmd/ctrl+Z and shift+cmd/ctrl+Z
- [x] Deleted `Sliders.tsx` and `Wheel.tsx`

### How undo works

`src/hooks/useHistory.ts` — past/present/future over the pins array, driven by a
pure reducer. `commit` takes an optional tag; commits sharing a tag inside 400ms
collapse into one entry, so a picker drag is one undo step rather than one per
pointer event. History caps at 100 entries. Theme is a setting, not a palette
edit, so it stays outside history.

Selection follows the palette: when undo, redo or delete retires the selected
pin, selection falls back to the first pin, or to none when the palette empties.

### Verified

`npm run check` 40/40 — 11 new assertions cover the reducer (stacking, undo,
redo, no-op at the ends, dropping the redo branch on a new commit, coalescing,
and the cap). Screenshots confirmed: `+` adds a `#4D4D4D` stripe and selects it;
typing `#ff0000` in the hex field applies live to the stripe and moves the
picker handles; one undo reverts the whole typed edit; a second undo removes the
added stripe and disables the undo arrow. Both layouts and the empty state
re-checked.

Two nits fixed on review: a stray border above the `+` column when the palette
was empty, and the editor hint duplicating the pins-pane instruction.
