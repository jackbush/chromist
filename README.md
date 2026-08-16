# Chromist
**[Get your colours right.](https://jackbush.github.io/chromist/)**

Build or import a palette, edit it in the space that suits the job, and read
every colour against every other one — under WCAG 2.2, under the WCAG 3.0 draft,
at any font weight, through any kind of colour vision. No account, no backend,
no analytics.

## Features

**Perceptual colour, by default.** Colours are held as OKLab and edited in
OKHSL. Lightness means the same thing at every hue, so a ramp that looks even
*is* even — unlike HSL, where `hsl(60 100% 50%)` and `hsl(240 100% 50%)` both
claim 50% and are nowhere near each other. The older spaces are all here too,
for pasting numbers in and out of tools that speak them.

**Display P3.** OKLCH and LCh reach past sRGB. A colour that does is drawn twice
in one stripe — most of it as it really is, and a band of what a narrower screen
will make of it — with the boundary marked across the picker so you can see
exactly where you left sRGB behind.

**An audit that answers the question you had.** Every colour as text over every
colour as background, both ways round:

- **WCAG 2.2** gives the level — AAA, AA, AA+ or FAIL — and the contrast ratio.
  That is what conformance means and what you are held to.
- **WCAG 3.0 (draft)** runs APCA and reports the *smallest font size that
  passes*, which is the thing you actually needed to know. It is polarity-aware,
  so light-on-dark scores differently from dark-on-light and the grid stops
  being symmetric.
- **Font weight feeds both.** 2.2 needs it to know where large text begins, APCA
  to pick a column of its table.
- **Colour-vision simulation** over the whole grid: protanopia, deuteranopia,
  tritanopia.
- **Gamut**, so you can read the palette as sRGB will render it rather than as
  your screen does.
- **"Same colour" detection**, which neither specification covers: a pair within
  a just-noticeable difference of each other is flagged as one colour, not as
  low contrast. Under simulation this turns up constantly.

Every verdict is set in the two colours it describes, at the weight you chose
and at the size it is claiming — so the grid is its own evidence rather than a
description of some.

**Text in, text out.** Paste a list of colours in any notation CSS understands;
every line that can't be read is named rather than dropped. Any hex or value
copies with one click.

**Share with a link.** The palette and the way you are reading it both ride in
the URL. Send it to anyone; there is nothing to sign up to. Everything else
stays in your browser's local storage.

**Accessible itself.** Full keyboard operation including reordering, real modal
dialogs, focus that goes where it should, status messages announced, honoured
`prefers-reduced-motion`, and pinch-zoom left alone. See
[Accessibility](#accessibility).

## Using it

Click a hex code to copy it, click a stripe to edit it, drag to reorder, `+` to
add a colour beside the selected one.

Above the picker: the colour space, the value in it, and a button to copy that
value. The square and the slider are the same control in every space — only what
their axes mean changes. The field reads anything CSS can express and writes the
current space's notation.

The bar, left to right: edit as text, audit, share link, reset, undo, redo,
help, light/dark. Reset is the only one that can't be undone, and it asks first.

In the audit: the specification, the font weight, the gamut, and which eye to
read it through. On a phone those four sit behind one **Accessibility audit
settings** button, so the grid gets the screen.

| Key | What it does |
| --- | ------------ |
| `cmd`/`ctrl` + `Z` | Undo — add `shift` to redo |
| `alt` + arrow | Move the focused colour along the palette |
| Arrow (on the picker) | Nudge — `shift` for ten times the step |
| `Enter` (on a hex cell) | Copy it |
| `cmd`/`ctrl` + `Enter` | Apply, in the edit dialog |
| `Escape` | Close a dialog, or leave the audit |
| `Tab` (from the top) | Skip past the bar to the palette |

## Colour spaces

The square is always two channels and the slider is always hue. What changes is
which two, and whether every point in the square is a colour you can have.

| Space | Square | Why this one |
| ----- | ------ | ------------ |
| **OKHSL** | S × L | The default. Perceptual, so lightness means the same at every hue — and the only perceptual space here whose square has no unreachable corner. |
| **HSL** | S × L | What CSS and every other tool speak. Familiar, and dishonest about lightness. |
| **HSB** | S × B | Matches Figma, Photoshop and Sketch, so numbers pasted from them land where you expect. |
| **HWB** | W × B | Tinting and shading as straight axes — the one to build a ramp off a single hue in. |
| **OKLCH (P3)** | C × L | Perceptual and honest, and the numbers paste straight into CSS. Reaches past sRGB. |
| **LCh (P3)** | C × L | CIELAB — what colour science and print speak. Reaches past sRGB. |

The two P3 spaces can name colours sRGB can't, and mark how far sRGB reached
with a dashed line across the square. The other four are the sRGB cube
relabelled and cannot leave it, which is why the space you pick is also the
gamut you get — there is no separate switch for it. Switching to a space that
can't describe what you have says so, and asks, before it moves anything.

## Accessibility

The app is built to the standard it measures. Every control is reachable and
operable from the keyboard, including drag-to-reorder (`alt` + arrow). Dialogs
are real `<dialog>` elements opened with `showModal`, so the page behind them is
inert to the pointer, to `Tab` and to a screen reader alike, and focus returns
to whatever opened them. Copies, moves and deletions are announced through a
polite live region, because a flash of colour is not feedback for everyone.
Focus rings are drawn two-tone over the swatches and picker, where the colour
behind them is anyone's guess. Zoom is not disabled and no form control is under
16px. `prefers-reduced-motion` stops the flashes as well as the transitions.

Two things an automated report will raise, both deliberate:

- **The audit grid fails contrast on purpose.** Each verdict is drawn in the pair
  it is reporting on, at the size it is claiming. A cell that says FAIL being
  hard to read *is the finding*. Scanning the grid as though it were ordinary UI
  will return a page of violations that are all working as intended.
- **The remove button reports as a 22px target.** It is drawn at 22px and
  answers to 24px, via a transparent ring that tools measuring the painted box
  cannot see.

## Construction

Vite, React, TypeScript, plain CSS, and [culori](https://culorijs.org/) for the
colour maths. No picker library: the square is painted per pixel, which is the
one thing a CSS gradient can't do.

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
site.config.ts     every title, description, icon and link-preview value
vite/site-meta.ts  expands that into the head tags and the web manifest
src/
  App.tsx          state, the wiring between the panes, and what it asks first
  types.ts         the type surface, including the canonical Colour
  color.ts         parsing, opposite, random, de-duplication, ΔE
  gamut.ts         what a screen can show: mapping, CSS output, the square
  modes.ts         the six editing modes, as one table
  cvd.ts           colour-vision deficiency simulation
  contrast.ts      WCAG ratio, the four bands the audit reports, and APCA
  colourList.ts    the text form of a palette: parsing, validation, formatting
  storage.ts       localStorage, validating anything read back
  urlHash.ts       share-link encoding and decoding
  clipboard.ts     copy, with a fallback for non-secure origins
  announce.ts      the live region everything speaks through
  components/      PinnedPane, Editor, ChannelPicker, ActionBar, ContrastAudit,
                   AuditSettings, EditColoursDialog, Modal, icons
  hooks/           useHistory, usePersistentState, useIsDesktop,
                   useKeyboardInset, useThemeColor
checks/logic.ts    assertions run by `npm run check`
```

## Decisions

Things that look like mistakes until you know why.

- **Colours are stored as OKLab, unrounded.** Unbounded, so a Display P3 colour
  is the same kind of value as an sRGB one and nothing needs a special case;
  perceptual, so every editing mode is a pure function of it and ΔE is a
  distance. Rounding is left to display: `#2e86ab` → `#2e87ad` is what happens
  otherwise, and the checks assert zero drift over 20k random hexes.
- **The gamut test has an epsilon, and needs one.** Every blue with `r=00` sits
  exactly on the sRGB boundary and reads a fraction *outside* it after a round
  trip. Testing strictly hands it to the chroma mapper, which moved `#0009be` to
  `#001fb0`. The tolerance also has to clear OKHSL, whose square is fitted to an
  approximation of the boundary and overshoots by up to 8e-6.
- **Only OKLCH and LCh reach Display P3.** HSL, HSB and HWB are re-labellings of
  the sRGB cube. OKHSL is too, less obviously: its saturation is a fraction of
  the chroma available *in sRGB*. The editor says so rather than letting a drag
  quietly clamp.
- **The picker holds its own coordinates during a drag.** A colour that has been
  fitted to a gamut has forgotten where the pointer was, so pushing chroma past
  the edge would stick there instead of coming back — and a drag through grey
  would lose its hue, since grey hasn't got one. Same arrangement as the text
  field's half-typed draft.
- **The proximity metric is CIEDE2000, not Euclidean OKLab.** OKLab distance is
  badly nonlinear at the dark end: it scores `#000000` against `#0a0a0a` some
  thirty times higher than a mid-tone pair that looks equally close. The
  threshold is 2.3, the long-standing JND.
- **One specification at a time.** 2.2 and 3.0 disagree by design, and showing a
  ratio next to an Lc invites reading the disagreement as a single verdict. 2.2
  is the default and keeps the AAA / AA / AA+ vocabulary; 3.0 is labelled a
  draft and reports what APCA actually answers — the smallest usable font size.
- **The APCA font table is floored to its row, not interpolated**, and checked
  against `apca-w3` rather than built on it. Flooring errs the only safe way:
  Lc 74 is answered as Lc 70, asking for 19.5px at weight 400 where
  interpolating would allow about 18.2 — the same rule `formatRatio` follows,
  never advertise what hasn't been earned. Verified across all 2169
  Lc-and-weight combinations: identical at every row, and never once smaller.
  Fifty lines of arithmetic and a table of constants fixed by the spec beat a
  dependency and its transitive one.
  - Watch the row spacing if you touch it. The table jumps Lc 0, 10, 15 and
    carries that offset for its whole length, so the index is
    `floor(Lc / 5) - 1`. Getting it wrong reads every answer one row too
    generous, silently.
- **Lc keeps its sign.** The magnitude is the score, but WCAG 2's ratio reads the
  same both ways and APCA's doesn't — so under 2.2 the grid is symmetric across
  its diagonal and under 3.0 the two triangles are two different findings. The
  sign is what says so.
- **The verdict is drawn at the selected weight.** The grid is meant to be its
  own evidence, and weight is half of what legibility depends on. A verdict that
  is hard to read at weight 100 is the finding, not a fault.
- **The audit's fact strip is in theme colours, not the pair's.** A cell whose
  finding is that its two colours are one colour has no third colour to say so
  in. The score above it stays in the pair's own colours, so when they are the
  same colour that band is simply blank — which is the finding.
- **The audit replaces the panes rather than covering them.** It's a mode, not a
  dialog: nothing is trapped, the bar stays live, and the mode rides in the URL
  (`&a=1`, and `&v=deutan` for the simulation) but not into storage — it
  describes a look at the palette, not the palette.
- **The share link is the one lossy channel.** Storage holds the unrounded
  value; the URL quantises to eight bits a channel, `rrggbb` for sRGB and
  `p3-rrggbb` for anything wider. That keeps every link ever shared working and
  the common case as short as it was, which is worth more than the last bit.
- **Writes are debounced.** Dragging in the picker fires a change per pointer
  event, and Safari throws once `history.replaceState` passes ~100 calls per 30
  seconds.
- **History coalescing is tag-based.** Commits sharing a tag within 400ms merge,
  which is what keeps one drag to one undo step. Untagged commits always stand
  alone.
- **`oppositeColour` is its own inverse**, which is why `+` filters its result
  through `distinctFrom` — otherwise repeated presses alternate between two
  colours. It stays exact and unclamped for that reason; fitting the result to a
  gamut is `distinctFrom`'s job. That filter compares by ΔE rather than by hex,
  since two colours a single bit apart are the same colour to look at.
- **One dialog component, and no `window.confirm`.** The editor, the audit
  settings and both confirmations are the same `Modal`: one place where modality,
  escape, focus return and the keyboard inset are dealt with, and questions that
  can name their own action — "Switch", "Reset" — in the app's own type rather
  than the browser's.
- **`theme-color` follows the app's theme, not the system's.** The palette's
  light/dark setting is its own, so a white app under a dark OS was leaving the
  phone's browser bars black. The tags in the document answer per OS scheme,
  which is all that can be known before the app boots; after that the app
  rewrites them.
- **All metadata lives in `site.config.ts`.** Title, description, icons, cover
  image, theme colours and the web manifest are derived from one object at build
  time. `index.html` carries none of it, so nothing can drift.
- **The hover clipboard on a hex cell is absolutely positioned**, not a flex
  sibling, so the code stays dead centre. Its container query measures the
  *content box*, so the threshold looks smaller than the cell.
- **Icons are [Phosphor](https://phosphoricons.com), regular weight** (MIT),
  inlined in `components/icons.tsx` rather than installed. To add one, copy the
  **regular** SVG from [phosphoricons.com](https://phosphoricons.com) and paste
  its `<path>` into a new component there; any other weight sits at a different
  visual density. Regular draws outlines as *filled* shapes on a 256 grid, so
  CSS that colours an icon sets `color`, never `stroke`. If the list stops being
  short, `npm i @phosphor-icons/react` — the wrapper exists so callers wouldn't
  change.
