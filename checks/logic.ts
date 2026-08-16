import {
  hexToHsl,
  hslToHex,
  hslEquals,
  toBareHex,
  oppositeHsl,
  randomHsl,
  distinctFrom,
} from '../src/color'
import { formatColourList, parseColourList } from '../src/colourList'
import { contrastRatio, formatRatio, scoreFor } from '../src/contrast'
import { MAX_PINS } from '../src/types'
import { readHash, readAudit, buildShareUrl } from '../src/urlHash'
import { load, save, DEFAULT_SETTINGS } from '../src/storage'
import { reducer } from '../src/hooks/useHistory'

let pass = 0
let fail = 0
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    pass++
    console.log(`  ok   ${label}`)
  } else {
    fail++
    console.log(`  FAIL ${label}\n         got ${a}\n         want ${e}`)
  }
}

console.log('\ncolour conversion')
eq('mid grey -> hsl (achromatic hue must not be NaN)', hexToHsl('#4d4d4d'), { h: 0, s: 0, l: 30.19607843137255 })
eq('black', hexToHsl('#000000'), { h: 0, s: 0, l: 0 })
eq('white', hexToHsl('#ffffff'), { h: 0, s: 0, l: 100 })
eq('pure red round trip', hslToHex({ h: 0, s: 100, l: 50 }), '#ff0000')
for (const hex of ['#2e86ab','#f6f5ae','#ff5733','#010203','#7f7f7f','#00ff88']) eq('round trip ' + hex, hslToHex(hexToHsl(hex)!), hex)
eq('invalid hex rejected', hexToHsl('nonsense'), null)
eq('bare hex has no hash', toBareHex({ h: 0, s: 100, l: 50 }), 'ff0000')
eq('hslEquals', hslEquals({ h: 1, s: 2, l: 3 }, { h: 1, s: 2, l: 3 }), true)

console.log('\nopposite colour')
{
  const opp = (hex: string) => hslToHex(oppositeHsl(hexToHsl(hex)!))

  eq('black -> white', opp('#000000'), '#ffffff')
  eq('white -> black', opp('#ffffff'), '#000000')
  // The reason lightness is mirrored rather than hue simply rotated: a plain
  // rotation is a no-op on any grey, and both themes are grey.
  eq('grey moves', opp('#4d4d4d'), '#b2b2b2')

  const before = hexToHsl('#2e86ab')!
  const after = oppositeHsl(before)
  eq('hue rotates half a turn', Math.round(after.h), Math.round((before.h + 180) % 360))
  eq('saturation is untouched', after.s, before.s)
  eq('lightness mirrors around 50', after.l, 100 - before.l)
  eq('applying it twice returns the original', hslToHex(oppositeHsl(after)), '#2e86ab')

  let moved = 0
  for (const hex of ['#2e86ab', '#ff5733', '#f6f5ae', '#4d4d4d', '#000000', '#808080']) {
    if (opp(hex) !== hex) moved++
  }
  eq('every sample changes colour', moved, 6)
}

console.log('\nrandom start colour')
{
  const samples = Array.from({ length: 500 }, () => randomHsl())
  eq('hue stays in range', samples.every((c) => c.h >= 0 && c.h < 360), true)
  eq('saturation stays vivid', samples.every((c) => c.s >= 55 && c.s <= 90), true)
  eq('lightness stays usable', samples.every((c) => c.l >= 40 && c.l <= 65), true)
  eq('always a valid hex', samples.every((c) => /^#[0-9a-f]{6}$/.test(hslToHex(c))), true)
  eq('hues actually vary', new Set(samples.map((c) => Math.round(c.h))).size > 100, true)
}

console.log('\nno duplicate colours')
{
  const hsl = (hex: string) => hexToHsl(hex)!
  const blue = hsl('#2e86ab')
  const opposite = oppositeHsl(blue)

  eq(
    'a free colour is used as-is',
    hslToHex(distinctFrom(opposite, [blue])),
    hslToHex(opposite),
  )

  // The case this exists for: + twice in a row, where the second opposite is
  // the original colour again.
  const again = oppositeHsl(opposite)
  eq('a colour already pinned is replaced', hslToHex(distinctFrom(again, [blue, opposite])) !== hslToHex(blue), true)

  const full = ['#2e86ab', '#ff5733', '#f6f5ae', '#4d4d4d', '#000000', '#ffffff', '#00ff88'].map(hsl)
  for (let i = 0; i < 200; i++) {
    const out = hslToHex(distinctFrom(full[i % full.length], full))
    if (full.some((c) => hslToHex(c) === out)) {
      eq('replacement never collides with a full palette', out, 'something unused')
      break
    }
  }
  eq('replacement never collides with a full palette', true, true)
}

console.log('\nurl hash')
eq('empty hash -> null', readHash(''), null)
eq('unrelated hash -> null', readHash('#other=1'), null)
eq('garbage values dropped', readHash('#p=zzzzzz,nothex'), null)
const three = readHash('#p=ff0000,00ff00,0000ff')
eq('three colours parsed', three?.length, 3)
eq('first parsed correctly', three?.[0].hsl, { h: 0, s: 100, l: 50 })
eq('ids are unique', new Set(three?.map((p) => p.id)).size, 3)
eq('capped at 7', readHash('#p=' + Array(12).fill('ff0000').join(','))?.length, 7)
eq('mixed valid/invalid keeps valid', readHash('#p=ff0000,xx,00ff00')?.length, 2)
eq('audit flag read', readAudit('#p=ff0000&a=1'), true)
eq('no audit flag', readAudit('#p=ff0000'), false)
eq('audit flag must be 1', readAudit('#p=ff0000&a=yes'), false)
eq('empty hash has no audit flag', readAudit(''), false)

;(globalThis as any).window = { location: { origin: 'https://x.test', pathname: '/' } }
eq('share url', buildShareUrl(three!), 'https://x.test/#p=ff0000,00ff00,0000ff')
eq('share url with no pins', buildShareUrl([]), 'https://x.test/')
eq('audit share url', buildShareUrl(three!, true), 'https://x.test/#p=ff0000,00ff00,0000ff&a=1')
eq('audit share url with no pins', buildShareUrl([], true), 'https://x.test/')
eq('audit share url round trips', readAudit(buildShareUrl(three!, true).split('#')[1]), true)

console.log('\nstorage validation')
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
}
eq('default theme is black', DEFAULT_SETTINGS.theme, 'black')
eq('empty storage -> defaults', load(), { pins: [], settings: DEFAULT_SETTINGS })
store.set('chromist.v1', '{ not json')
eq('corrupt json -> defaults', load(), { pins: [], settings: DEFAULT_SETTINGS })
store.set(
  'chromist.v1',
  JSON.stringify({
    pins: [
      { id: 'a', hsl: { h: 1, s: 2, l: 3 } },
      { id: 'b', hsl: { h: 'bad', s: 2, l: 3 } },
      { nope: true },
    ],
    settings: { theme: 'martian', picker: 'wheel' },
  }),
)
const loaded = load()
eq('malformed pins filtered out', loaded.pins.length, 1)
eq('unknown theme falls back to the default', loaded.settings.theme, DEFAULT_SETTINGS.theme)

// The retired theme reaches this code as an unknown name, so anyone still
// holding it lands on the dark default rather than a theme that no longer has
// any colours behind it.
store.set('chromist.v1', JSON.stringify({ pins: [], settings: { theme: 'neutral' } }))
eq('a retired theme falls back to dark', load().settings.theme, 'black')
eq('settings from older builds drop unknown keys', loaded.settings, DEFAULT_SETTINGS)
save({ pins: [{ id: 'a', hsl: { h: 1, s: 2, l: 3 } }], settings: DEFAULT_SETTINGS })
eq('save round trips', load().pins[0].id, 'a')

console.log('\nundo / redo')
{
  const start = { past: [] as string[], present: 'a', future: [] as string[] }
  const step = (s: typeof start, next: string, coalesce = false) =>
    reducer(s, { type: 'commit', next, coalesce })

  let s = step(step(start, 'b'), 'c')
  eq('commits stack up', [s.past, s.present], [['a', 'b'], 'c'])

  s = reducer(s, { type: 'undo' })
  eq('undo steps back one', [s.past, s.present, s.future], [['a'], 'b', ['c']])

  s = reducer(s, { type: 'undo' })
  eq('undo again', [s.past, s.present, s.future], [[], 'a', ['b', 'c']])

  eq('undo at the start is a no-op', reducer(s, { type: 'undo' }).present, 'a')

  s = reducer(s, { type: 'redo' })
  eq('redo steps forward', [s.past, s.present, s.future], [['a'], 'b', ['c']])

  const branched = step(s, 'x')
  eq('committing after undo drops the redo branch', branched.future, [])
  eq('committing after undo keeps the past', branched.past, ['a', 'b'])

  const coalesced = step(step(start, 'b'), 'c', true)
  eq('coalesced commit does not deepen history', [coalesced.past, coalesced.present], [['a'], 'c'])
  eq(
    'undo after coalescing lands before the whole run',
    reducer(coalesced, { type: 'undo' }).present,
    'a',
  )

  const afterReset = reducer(step(step(start, 'b'), 'c'), { type: 'reset', next: 'z' })
  eq('reset clears the whole stack', afterReset, { past: [], present: 'z', future: [] })

  let long = start
  for (let i = 0; i < 150; i++) long = step(long, `v${i}`)
  eq('history is capped', long.past.length, 100)
  eq('cap keeps the most recent', long.past[99], 'v148')
}

console.log('\ncontrast')
{
  const ratio = (a: string, b: string) => contrastRatio(hexToHsl(a)!, hexToHsl(b)!)

  eq('black on white is the maximum', ratio('#000000', '#ffffff'), 21)
  eq('a colour against itself is 1', ratio('#2e86ab', '#2e86ab'), 1)
  eq('order does not matter', ratio('#2e86ab', '#ffffff'), ratio('#ffffff', '#2e86ab'))

  eq('7 and over is AAA', scoreFor(7), 'AAA')
  eq('just under 7 is AA', scoreFor(6.99), 'AA')
  eq('4.5 is AA', scoreFor(4.5), 'AA')
  eq('just under 4.5 is large-text only', scoreFor(4.49), 'AA+')
  eq('3 is large-text only', scoreFor(3), 'AA+')
  eq('under 3 fails outright', scoreFor(2.99), 'FAIL')

  // A displayed ratio must never round its way into looking like a pass.
  eq('the ratio rounds down', formatRatio(4.499), '4.49:1')
  eq('the ratio keeps two places', formatRatio(21), '21.00:1')
}

console.log('\ncolour list')
{
  const hexes = (text: string) => parseColourList(text).hexes
  const errs = (text: string) => parseColourList(text).errors

  eq('reads a plain list', hexes('#e4572e\n#17bebb'), ['#e4572e', '#17bebb'])
  eq('takes codes without the hash', hexes('e4572e'), ['#e4572e'])
  eq('lower-cases what it reads', hexes('#E4572E'), ['#e4572e'])
  eq('expands three digits', hexes('#abc\nfff'), ['#aabbcc', '#ffffff'])
  eq('ignores blank lines and padding', hexes('\n  #abc  \n\n'), ['#aabbcc'])
  eq('round-trips the formatted form', hexes(formatColourList(['#e4572e'])), ['#e4572e'])

  eq('rejects eight-digit alpha', errs('#e4572eff'), [
    { line: 1, message: 'no opacity — drop the last digits' },
  ])
  eq('rejects four-digit alpha', errs('#abcd'), [
    { line: 1, message: 'no opacity — drop the last digits' },
  ])
  eq('rejects non-hex text', errs('tomato'), [{ line: 1, message: 'not a hex colour' }])
  eq('rejects odd lengths', errs('#abcde'), [{ line: 1, message: 'needs three or six digits' }])
  eq('rejects an empty list', errs(' \n '), [{ line: 1, message: 'needs at least one colour' }])
  eq('reports the failing line number', errs('#abc\n\nnope')[0].line, 3)
  eq('holds everything back while a line is bad', hexes('#abc\nnope'), [])

  const over = errs(Array(MAX_PINS + 1).fill('#abc').join('\n'))
  eq('rejects more than the cap', over, [{ line: MAX_PINS + 1, message: `over ${MAX_PINS} colours` }])
  eq('accepts exactly the cap', hexes(Array(MAX_PINS).fill('#abc').join('\n')).length, MAX_PINS)
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
