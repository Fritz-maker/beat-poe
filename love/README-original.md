# Wordfight (prototype)

Spell the longest, highest-value words to beat each foe before it beats you.
No clock: pressure comes from the foe's attacks and its curse waves, which
swap tiles for hard letters (Q Z X J V K W).

Run:  love wordfight      (from the folder that contains this one)

Controls: click tiles or type letters | Enter = play | Backspace = undo letter
          Esc = clear | Tab = scramble (costs your turn: the foe gets a free hit; clears curses)
          F11 = fullscreen | window is resizable and scales to fit

Tuning: everything lives at the top of logic.lua (letter values, length curve,
foes, player HP, healing) so you can rebalance without touching the UI.
Word list: words.txt (MIT-licensed `word-list` package).

Best-word panel: F2 (or the button) switches between common words only (default)
and every valid word. You can always play any word in words.txt either way.
common.txt = words.txt filtered to reasonably well-known words.

Bonus lives: every time you play the best word available (the highest-damage word, often the longest) (what the best-word panel calls
perfect) you earn a life. Lives are spent only in the final fight: if you die there,
you come back with REVIVE_FRAC of your max HP (see logic.lua). Lives reset on a new run.

Pop-ups: a perfect word shows a BONUS LIFE! burst; a play worth at least CLOSE_FRAC (70%) of
the best word shows "Nice try, you were close!". Both are drawn in code (see drawBanner).

Qu tiles: some Q tiles come up as "Qu" (QU_CHANCE). A Qu tile spells QU, counts as two letters,
and is worth QU_VALUE (3) instead of Q (4). Typing "qu" onto a Qu tile works naturally.
The perfect-word announcement lasts ~3.8 s (see startBanner / drawBanner in main.lua).
