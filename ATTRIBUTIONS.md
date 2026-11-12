# Attributions

Beat Poe! is by Wardo Studio. The game's own code is under the MIT license
(see LICENSE). Everything below comes from somewhere else and keeps its own terms.

## Word lists

| File | Source | License |
|---|---|---|
| `data/words.txt` | `word-list` 4.1.0 by Sindre Sorhus | MIT |
| `data/common.txt` | `words.txt` filtered with word frequencies from `wordfreq` by Robyn Speer | CC BY-SA 4.0 |

Full notices, and the sources behind wordfreq's data (including the SUBTLEX
word lists by Marc Brysbaert et al.), are in `data/LICENSE.md`.

## Fonts

Hosted in `fonts/`; license texts are in `fonts/licenses/`.

| Font | Used for | License |
|---|---|---|
| Rye | Mark Twain's name | SIL Open Font License 1.1 |
| Alfa Slab One | Mark Twain's tiles | SIL Open Font License 1.1 |
| Cormorant Garamond | Emily Dickinson | SIL Open Font License 1.1 |
| Pirata One | Mary Shelley's name | SIL Open Font License 1.1 |
| Special Elite | Mary Shelley's tiles | Apache License 2.0 |
| IM Fell English SC | Edgar Allan Poe | SIL Open Font License 1.1 |

## Portraits

The eight author portraits in `art/` (and the app icons in `icons/`, made from
Poe's portrait) are original caricatures generated with Google Gemini from the
prompts in `art/GEMINI-PROMPTS.md`, then cut out and resized with
`tools/cutout.py`. They are not copied from any photograph or painting.

## Quotations

Lines marked "real" in `js/lines.js` are quotations from works in the public
domain; each is credited there with its work and year:

- Mark Twain: *Adventures of Huckleberry Finn* (1884), *The Tragedy of Pudd'nhead Wilson* (1894), *Following the Equator* (1897)
- Emily Dickinson: *Poems* (1890), *Poems, Second Series* (1891), *Poems, Third Series* (1896), in the wording of those editions
- Mary Shelley: *Frankenstein; or, The Modern Prometheus* (1818, revised 1831)
- Edgar Allan Poe: "The Fall of the House of Usher" (1839), "The Pit and the Pendulum" (1842), "The Tell-Tale Heart" (1843), "The Conqueror Worm" (1843), "The Raven" (1845), "The Cask of Amontillado" (1846)

All other lines are original, written in each author's voice for this game.

## Inspiration

The game is a homage to the word-battle genre that Bookworm Adventures made
popular. It shares no code, art, text or word lists with that game.
