import { hexToHsl, hslToHex, hslEquals, toBareHex } from '../src/color'
import { readHash, buildShareUrl } from '../src/urlHash'
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
eq('theme neutral #4d4d4d -> hsl (achromatic hue must not be NaN)', hexToHsl('#4d4d4d'), { h: 0, s: 0, l: 30.19607843137255 })
eq('black', hexToHsl('#000000'), { h: 0, s: 0, l: 0 })
eq('white', hexToHsl('#ffffff'), { h: 0, s: 0, l: 100 })
eq('pure red round trip', hslToHex({ h: 0, s: 100, l: 50 }), '#ff0000')
for (const hex of ['#2e86ab','#f6f5ae','#ff5733','#010203','#7f7f7f','#00ff88']) eq('round trip ' + hex, hslToHex(hexToHsl(hex)!), hex)
eq('invalid hex rejected', hexToHsl('nonsense'), null)
eq('bare hex has no hash', toBareHex({ h: 0, s: 100, l: 50 }), 'ff0000')
eq('hslEquals', hslEquals({ h: 1, s: 2, l: 3 }, { h: 1, s: 2, l: 3 }), true)

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

;(globalThis as any).window = { location: { origin: 'https://x.test', pathname: '/' } }
eq('share url', buildShareUrl(three!), 'https://x.test/#p=ff0000,00ff00,0000ff')
eq('share url with no pins', buildShareUrl([]), 'https://x.test/')

console.log('\nstorage validation')
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
}
eq('empty storage -> defaults', load(), { pins: [], settings: DEFAULT_SETTINGS })
store.set('palette-builder.v1', '{ not json')
eq('corrupt json -> defaults', load(), { pins: [], settings: DEFAULT_SETTINGS })
store.set(
  'palette-builder.v1',
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
eq('unknown theme falls back', loaded.settings.theme, 'neutral')
eq('settings from older builds drop unknown keys', loaded.settings, { theme: 'neutral' })
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

  let long = start
  for (let i = 0; i < 150; i++) long = step(long, `v${i}`)
  eq('history is capped', long.past.length, 100)
  eq('cap keeps the most recent', long.past[99], 'v148')
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
