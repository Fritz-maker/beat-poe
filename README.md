# Beat Poe! (skeleton)

A word duel against four authors: Mark Twain, Emily Dickinson, Mary Shelley, and
Edgar Allan Poe. Spell the longest, highest-value words to beat each one before
they beat you. This is the plain playable skeleton: no author art, themes, or
popups yet.

## Play it

The game must be opened through a web server (not by double-clicking index.html):

    cd beat-poe
    python3 -m http.server 8000

- On this computer: open http://localhost:8000
- On a phone on the same wifi: run `hostname -I`, then open `http://<first address>:8000`

## Controls

- Phone: tap tiles in any order, then Play. Tap a picked tile to remove it.
  Scramble needs two taps (it costs your turn).
- Desktop: type letters, Enter = play, Backspace = undo, Esc = clear,
  Tab = scramble, F2 = switch the best-word list.

## Files

- `js/logic.js` - pure rules, tuning knobs at the top (ported from the LÖVE version's logic.lua)
- `js/main.js`  - the UI
- `data/words.txt` - every playable word; `data/common.txt` - common words for the best-word check
- `test/` - rule tests: `node --test`
- `tools/sim.mjs` - balance bots: `node tools/sim.mjs`
- `tools/make-trace.mjs` + `tools/parity_lua.py` - check the JS rules against the original Lua
- `tools/smoke.py` - headless-browser test of the UI (needs Python Playwright and Chrome)

## Word lists

- `words.txt` comes from the `word-list` npm package (MIT, Sindre Sorhus).
- `common.txt` is `words.txt` filtered with word frequencies from `wordfreq`
  (Robyn Speer; data under CC BY-SA 4.0, which includes SUBTLEX data by Marc Brysbaert et al.).

Full license and attribution files come with the published version.
