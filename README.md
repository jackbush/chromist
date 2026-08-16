# Chromist
Get your colours right.

- **Import your palette.** Paste your hex codes in as text.
- **Accessibility audit.** Every combination, scored AAA / AA / AA+ / FAIL.
- **Share with anyone.** One link, to anyone. No account or sign-up.
- **Private.** No backend, accounts, database or analytics.

## Actions

Click a hex code to copy it, click a stripe to edit it, drag to reorder, `+` to
add a colour beside the selected one. `cmd`/`ctrl` + `Z` undoes.

The bar, left to right: share link, audit, edit as text, undo, redo, reset,
light/dark. Reset is the only one that can't be undone, and it asks first.

## Construction

Vite, React, TypeScript, plain CSS.
[react-colorful](https://github.com/omgovich/react-colorful) for the picker,
[culori](https://culorijs.org/) for conversion — culori also speaks OKLCH, the
sane basis for tint ramps or harmony suggestions if those ever get built.

```sh
npm install
npm run dev      # http://localhost:5173/chromist/
```

| Script            | What it does                                       |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Dev server with hot reload                         |
| `npm run build`   | Type-check then build to `dist/`                   |
| `npm run preview` | Serve the built `dist/` locally                    |
| `npm run check`   | Logic assertions — colour maths, URL hash, storage |

Push to `main`; the workflow runs `check` and `build`, then publishes to GitHub
Pages. One-time setup: *Settings → Pages → Source → GitHub Actions*. `base` in
`vite.config.ts` must match the repo name or every asset 404s — which is why dev
also runs under `/chromist/`.

```
src/
  App.tsx        state, and the wiring between the panes
  color.ts       hex <-> hsl, opposite, random, de-duplication
  storage.ts     localStorage, validating anything read back
  urlHash.ts     share-link encoding and decoding
  clipboard.ts   copy, with a fallback for non-secure origins
  colourList.ts  the text form of a palette: parsing, validation, formatting
  contrast.ts    WCAG ratio and the four bands the audit reports
  components/    PinnedPane, Editor, ActionBar, EditColoursDialog,
                 ContrastAudit, icons
  hooks/         useHistory, usePersistentState, useIsDesktop
checks/logic.ts  assertions run by `npm run check`
```

## Decisions

Things that look like mistakes until you know why.

- **HSL is stored unrounded.** Integer HSL has ~3.7M states against hex's 16.7M,
  so rounding on import makes colours drift (`#2e86ab` → `#2e87ad`). Round only
  when displaying. Related: culori leaves hue *undefined* for greys, so every
  read of `.h` needs a fallback.
- **Writes are debounced.** Dragging in the picker fires a change per pointer
  event, and Safari throws once `history.replaceState` passes ~100 calls per 30
  seconds.
- **`oppositeHsl` is its own inverse**, which is why `+` filters its result
  through `distinctFrom` — otherwise repeated presses alternate between two
  colours.
- **The audit replaces the panes rather than covering them.** It's a mode, not a
  dialog: nothing is trapped, the bar stays live, and the mode rides in the URL
  (`&a=1`) but not into storage — it describes a look at the palette, not the
  palette.
- **History coalescing is tag-based.** Commits sharing a tag within 400ms merge,
  which is what keeps one drag to one undo step. Untagged commits always stand
  alone.
- **The hover clipboard on a hex cell is absolutely positioned**, not a flex
  sibling, so the code stays dead centre. Its container query measures the
  *content box*, so the threshold looks smaller than the cell.
- **Icons are [Phosphor](https://phosphoricons.com), regular weight** (MIT),
  inlined in `components/icons.tsx` rather than installed — nine icons is a
  short list. To add one, copy the **regular** SVG from
  [phosphoricons.com](https://phosphoricons.com) and paste its `<path>` into a
  new component there; any other weight sits at a different visual density.
  Regular draws outlines as *filled* shapes on a 256 grid, so CSS that colours
  an icon sets `color`, never `stroke`. If the list stops being short,
  `npm i @phosphor-icons/react` — the wrapper exists so callers wouldn't change.
