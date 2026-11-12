# Beat Poe!

A word duel against four authors. Spell the longest, highest-value words you
can to beat Mark Twain, Emily Dickinson and Mary Shelley, then face Edgar Allan Poe.

**Play it: https://fritz-maker.github.io/beat-poe/**

It is made for phones (portrait, tap to play) and also works on a desktop with
a keyboard. On a phone, use your browser's "Add to Home screen" to install it;
after the first visit it also works offline.

## How to play

- Tap tiles in any order to spell a word of 3 or more letters, then tap **Play**.
  Tap a picked tile again to put it back.
- Long words hit much harder than short ones, and rare letters are worth more.
- After each word the author hits back. Every few turns a **curse wave** turns
  some tiles into hard letters; the beads under the author's health bar count down to it.
- **Scramble** deals a fresh grid and clears curses, but costs your turn.
- Play the best word the grid allows and you earn a **bonus life**. Lives are
  saved for the final fight with Poe, where each one brings you back from defeat.
- Missed the best word? **Show me** displays the grid as it was, with the best
  word marked in order.
- The gear opens Settings: whether "best word" means common words or every
  valid word, and whether to offer Show me.

Desktop keys: type letters, Enter = play, Backspace = undo, Esc = clear,
Tab = scramble, F2 = switch the best-word list.

## Run it on your own computer

The game has to be opened through a web server, not by double-clicking index.html:

    python3 -m http.server 8000

Then open http://localhost:8000

## For developers

No build step and no dependencies: plain HTML, CSS and JavaScript modules.

| Path | What it is |
|---|---|
| `js/logic.js` | The rules, with the tuning knobs (foe stats, letter values, curse settings) at the top |
| `js/lines.js` | What each author says at each game moment, with the source of every genuine quotation |
| `js/main.js` | The interface |
| `css/style.css`, `css/themes.css` | Layout, and one colour-and-font theme per author |
| `data/` | Word lists: every playable word, and the common words used for the best-word check |
| `art/`, `fonts/`, `icons/` | Portraits, typefaces and app icons |
| `sw.js`, `manifest.webmanifest` | Offline play and add-to-home-screen |
| `love/` | The original desktop game (Lua, LÖVE) that this grew out of |
| `test/` | Rule tests: `node --test` |
| `tools/` | Balance bots (`sim.mjs`), the Lua parity check, the portrait cut-out script, and a headless-browser test |

When you add or rename files in `css/`, `js/`, `art/`, `fonts/`, `data/` or
`icons/`, add them to the list in `sw.js` and change its `CACHE` name.

## Credits and licenses

Beat Poe! is by Wardo Studio. The game's own code is under the MIT license
(see `LICENSE`). The word lists, fonts and portraits come from other sources
and keep their own terms: see `ATTRIBUTIONS.md`.

The authors' genuine lines are quotations from their public-domain works; the
rest are original lines written in their voices.
