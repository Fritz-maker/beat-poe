import json, subprocess, sys, time
from playwright.sync_api import sync_playwright

import os
ROOT = sys.argv[1]
os.makedirs("shots", exist_ok=True)
srv = subprocess.Popen([sys.executable, "-I", "-m", "http.server", "8765", "--bind", "127.0.0.1", "--directory", ROOT],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
URL = "http://127.0.0.1:8765/"
def start(page):
    """Leave the title screen the way a player does: tap Play."""
    page.locator("#titlePlay").click()
    page.wait_for_function("document.getElementById('title').hidden", timeout=3000)

errors = []
def check(cond, what):
    print(("ok   " if cond else "FAIL ") + what)
    if not cond: errors.append(what)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        # ---- phone-sized, touch ----
        for name, w, h in [("se-with-bars", 375, 548), ("small-android", 360, 640), ("pixel-9a", 412, 763), ("iphone-14", 390, 844)]:
            ctx = b.new_context(viewport={"width": w, "height": h}, has_touch=True, is_mobile=True, device_scale_factor=2)
            page = ctx.new_page()
            logs = []
            page.on("console", lambda m: logs.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: logs.append(str(e)))
            t0 = time.time()
            page.goto(URL)
            page.wait_for_function("window.beatPoe && window.beatPoe.S.mode === 'fight'", timeout=30000)
            start(page)
            print(f"--- {name} {w}x{h}: ready in {time.time()-t0:.2f}s")
            m = page.evaluate("""() => {
              const r = (id) => document.getElementById(id).getBoundingClientRect();
              const t = document.querySelector('.tile').getBoundingClientRect();
              const kids = [...document.getElementById('app').children].filter(e => !e.classList.contains('overlay') && !e.hidden);
              const bottom = Math.max(...kids.map(e => e.getBoundingClientRect().bottom));
              return {tile: t.width, tileH: t.height, grid: r('grid').width, scrollH: document.documentElement.scrollHeight,
                      scrollW: document.documentElement.scrollWidth, innerH: innerHeight, innerW: innerWidth, bottom,
                      play: r('btnPlay').height, scr: r('btnScramble').height}
            }""")
            print("   ", json.dumps(m))
            check(m["scrollH"] <= m["innerH"] and m["scrollW"] <= m["innerW"], "no scrolling needed")
            check(m["bottom"] <= m["innerH"] + 0.5, "everything fits on screen")
            check(m["tile"] >= 48, f"tiles are thumb-sized ({m['tile']:.0f}px)")
            check(abs(m["tile"] - m["tileH"]) < 1, "tiles are square")
            page.screenshot(path=f"shots/{name}-start.png")

            # tap out the best word through the real UI
            best = page.evaluate("() => beatPoe.L.bestWord(beatPoe.S.fight.grid, {maxLen: 6})")
            hp0 = page.evaluate("() => beatPoe.S.fight.hp")
            for i in best["tiles"]:
                page.locator(".tile").nth(i).tap()
            check(page.locator("#word").inner_text() == best["word"], f"tray shows {best['word']}")
            check("damage" in page.locator("#wordInfo").inner_text(), "damage preview shown")
            page.screenshot(path=f"shots/{name}-word.png")
            # deselect the middle tile and put it back
            page.locator(".tile").nth(best["tiles"][1]).tap()
            check(len(page.locator("#word").inner_text()) < len(best["word"]), "tapping a picked tile removes it")
            page.locator("#btnClear").tap()
            check(page.evaluate("() => beatPoe.S.sel.length") == 0, "Clear empties the tray")
            for i in best["tiles"]:
                page.locator(".tile").nth(i).tap()
            page.locator("#btnBack").tap()
            check(page.evaluate("() => beatPoe.S.sel.length") == len(best["tiles"]) - 1, "undo removes one letter")
            page.locator(".tile").nth(best["tiles"][-1]).tap()
            page.locator("#btnPlay").tap()
            hp1 = page.evaluate("() => beatPoe.S.fight.hp")
            check(hp0 - hp1 == best["dmg"], f"foe took {best['dmg']} damage")
            check(page.evaluate("() => beatPoe.S.phase") == "enemy", "input locks for the foe's turn")
            # fire the touch immediately (Playwright's tap would wait for the tile animation to finish)
            page.evaluate("() => document.querySelector('.tile').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true}))")
            check(page.evaluate("() => beatPoe.S.phase === 'enemy' && beatPoe.S.sel.length === 0"), "tiles ignore taps during the foe's turn")
            page.screenshot(path=f"shots/{name}-after-play.png")
            page.wait_for_function("beatPoe.S.phase === 'player'", timeout=3000)
            check(page.evaluate("() => beatPoe.S.playerHp") < 80, "foe hit back")
            page.wait_for_timeout(500)
            page.screenshot(path=f"shots/{name}-foe-hit.png")
            # ---- missed-word review ----
            page.evaluate("""() => { const f = beatPoe.S.fight; f.waveIn = 9; 'R A I N E T S O Qu D L U Z E K C'.split(' ').forEach((c, i) => { f.grid[i] = c === 'Qu' ? {ch:'Q', qu:true, cursed:false} : {ch:c, qu:false, cursed: c === 'Z' || c === 'K'}; }); beatPoe.render(); }""")
            for i in (0, 1, 2, 3): page.locator(".tile").nth(i).tap()      # RAIN
            page.locator("#btnPlay").tap()
            page.wait_for_function("beatPoe.S.phase === 'player'", timeout=3000)
            check(page.locator("#btnShow").is_visible(), "Show me appears after a miss")
            page.locator("#btnShow").tap()
            rv = page.evaluate("""() => { const cols = [...document.querySelectorAll('#review .rv-col')]; const info = (c) => ({tiles: c.querySelectorAll('.rv-tile').length, lit: [...c.querySelectorAll('.rv-tile.on')].map(t => [t.firstChild.textContent, +t.querySelector('.ord').textContent]).sort((a, b) => a[1] - b[1]), word: c.querySelector('.rv-word').textContent, sub: c.querySelector('.rv-sub').textContent});
               const b = document.getElementById('reviewClose').getBoundingClientRect(), r = document.getElementById('review').getBoundingClientRect();
               return {open: !document.getElementById('review').hidden, mine: info(cols[0]), best: info(cols[1]), btnBottom: b.bottom, innerH: innerHeight, top: r.top, stageBottom: document.getElementById('foeBox').getBoundingClientRect().bottom, bw: beatPoe.S.reveal.best.word, bd: beatPoe.S.reveal.best.dmg} }""")
            spell = lambda lit: "".join(t[0].upper() for t in lit)
            check(rv["open"] and rv["mine"]["tiles"] == 16 and rv["best"]["tiles"] == 16, "review shows two copies of the old grid")
            check(spell(rv["mine"]["lit"]) == "RAIN" and rv["mine"]["word"] == "RAIN", "your tiles are lit in the order you played them")
            check(spell(rv["best"]["lit"]) == rv["bw"] and rv["best"]["word"] == rv["bw"], f"best word's tiles are lit and numbered in order ({rv['bw']})")
            check([t[1] for t in rv["best"]["lit"]] == list(range(1, len(rv["best"]["lit"]) + 1)), "numbers run 1..n")
            check(str(rv["bd"]) in rv["best"]["sub"] and "letters" in rv["best"]["sub"], f"the sum is shown ({rv['best']['sub']})")
            check(rv["btnBottom"] <= rv["innerH"] and rv["top"] >= rv["stageBottom"] - 8, "review fits on screen below the stage")
            page.screenshot(path=f"shots/{name}-review.png")
            turn = page.evaluate("() => beatPoe.S.fight.turn")
            page.locator("#reviewClose").tap()
            check(page.evaluate("() => document.getElementById('review').hidden && beatPoe.S.fight.turn") == turn, "Got it closes the review without using a turn")
            # bad word is refused and costs nothing
            turn = page.evaluate("() => beatPoe.S.fight.turn")
            page.evaluate("() => { const g = beatPoe.S.fight.grid; g[0].ch='X'; g[1].ch='Z'; g[2].ch='J'; g[0].qu=g[1].qu=g[2].qu=false; beatPoe.render(); }")
            for i in (0, 1, 2): page.locator(".tile").nth(i).tap()
            check("not in the word list" in page.locator("#wordInfo").inner_text(), "invalid word flagged")
            page.locator("#btnPlay").tap()
            check(page.evaluate("() => beatPoe.S.fight.turn") == turn, "invalid word does not use the turn")
            check("not in the word list" in page.locator("#wordInfo").inner_text(), "refused word is explained")
            # stage pieces
            st = page.evaluate("() => { const f = document.getElementById('face').getBoundingClientRect(), s = document.getElementById('foeBox').getBoundingClientRect(), b = document.getElementById('msg').getBoundingClientRect(); return {face: f.width, stage: s.height, bubbleBottom: b.bottom, stageBottom: s.bottom, bubble: document.getElementById('msg').textContent, beads: document.querySelectorAll('#beads i').length} }")
            print("    stage", json.dumps(st))
            check(st["face"] >= 70, f"face is big enough to read ({st['face']:.0f}px)")
            fi = page.evaluate("() => { const i = document.getElementById('faceImg'), r = i.getBoundingClientRect(); return {src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, h: r.height, hidden: i.hidden, ph: document.getElementById('facePlaceholder').hasAttribute('hidden')} }")
            check(fi["ok"] and not fi["hidden"] and fi["ph"] and fi["src"].endswith("twain-normal.webp"), "Twain's calm portrait is showing")
            check(abs(fi["h"] - st["stage"]) < 1.5, f"portrait fills the stage height ({fi['h']:.0f}px)")
            check(st["bubbleBottom"] <= st["stageBottom"] + 1, "speech bubble fits inside the stage")
            check(len(st["bubble"]) > 0 and st["beads"] == 4, "bubble has text and Twain has 4 countdown beads")
            # settings via the gear
            page.locator("#btnGear").tap()
            page.locator("#setAll").tap()
            check(page.evaluate("() => beatPoe.L.commonOnly") is False, "settings: All words")
            page.screenshot(path=f"shots/{name}-settings.png")
            page.locator("#setCommon").tap()
            page.locator("#setReviewOff").tap()
            check(page.evaluate("() => beatPoe.S.showReview === false && JSON.parse(localStorage.getItem('beatpoe.settings')).showReview === false"), "settings: review switched off and saved")
            check(page.evaluate("() => document.getElementById('btnShow').hidden"), "with the review off, the Show me button is gone")
            page.locator("#setReviewOn").tap()
            check(page.evaluate("() => !document.getElementById('btnShow').hidden"), "switching it back on brings the button back")
            page.locator("#setClose").tap()
            check(page.evaluate("() => beatPoe.L.commonOnly && document.getElementById('settings').hidden"), "settings: back to Common words and closed")
            # scramble needs two taps
            page.locator("#btnScramble").tap()
            check(page.evaluate("() => beatPoe.S.fight.turn") == turn, "first Scramble tap only arms")
            page.screenshot(path=f"shots/{name}-scramble-armed.png")
            page.locator("#btnScramble").tap()
            check(page.evaluate("() => beatPoe.S.fight.turn") == turn + 1, "second tap scrambles")
            page.wait_for_function("beatPoe.S.phase === 'player'", timeout=3000)
            check(not logs, f"no console errors {logs[:2]}")
            ctx.close()

        # ---- full run played through the UI by a bot (taps only) ----
        ctx = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        page = ctx.new_page()
        logs = []
        page.on("console", lambda m: logs.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: logs.append(str(e)))
        page.add_init_script("window.__fast = true")
        page.goto(URL)
        page.wait_for_function("window.beatPoe && window.beatPoe.S.mode === 'fight'", timeout=30000)
        start(page)
        seen = set(); shots = set(); plays = 0; outcome = None; said = set()
        for step in range(400):
            st = page.evaluate("() => ({mode: beatPoe.S.mode, phase: beatPoe.S.phase, idx: beatPoe.S.fight.idx, lives: beatPoe.S.lives, hp: beatPoe.S.playerHp, banner: document.getElementById('banner').hidden ? '' : document.getElementById('banner').className, splash: !!document.querySelector('.bl-zone'), wave: document.getElementById('wave').className, cursed: beatPoe.S.fight.grid.filter(t=>t.cursed).length})")
            seen.add(st["mode"])
            # whatever the foe is saying must be one of that foe's lines, and must fit inside the stage
            bub = page.evaluate("() => { const f = beatPoe.S.fight, set = beatPoe.LINES[f.enemy.id]; const all = Object.values(set).flat().map(l => l.replaceAll(' / ', '\\n')); const m = document.getElementById('msg'); return {ok: all.includes(m.textContent), text: m.textContent, fits: m.getBoundingClientRect().bottom <= document.querySelector('.foebar').getBoundingClientRect().top + 1} }")
            if not bub["ok"]: check(False, f"bubble shows a known line (got {bub['text']!r})")
            if not bub["fits"]: check(False, f"bubble fits in the stage ({bub['text']!r})")
            said.add(bub["text"])
            for key, cond in [("splash-life", st["splash"]), ("banner-close", "close" in st["banner"]),
                              ("wave-soon", "soon" in st["wave"] and st["cursed"] > 0), (st["mode"], st["mode"] != "fight")]:
                if cond and key not in shots:
                    shots.add(key); page.screenshot(path=f"shots/run-{key}.png")
            if st["mode"] == "victory":
                if st["idx"] == 0:
                    src = page.evaluate("() => document.getElementById('faceImg').getAttribute('src')")
                    check(src.endswith("twain-cross.webp"), "beaten Twain turns cross")
                    check(page.evaluate("() => document.getElementById('overlay').hidden"), "result card waits while the cross face shows")
                    page.wait_for_timeout(700); page.screenshot(path="shots/run-twain-cross.png")
                    page.locator("#ovBtn").wait_for(state="visible"); page.wait_for_timeout(200)
                    page.screenshot(path="shots/run-twain-card.png")
                    vis = page.evaluate("() => document.getElementById('overlay').getBoundingClientRect().top >= document.getElementById('foeBox').getBoundingClientRect().bottom")
                    check(vis, "result card leaves the stage visible")
                page.locator("#ovBtn").tap()
                if st["idx"] == 0:
                    page.wait_for_function("beatPoe.S.mode === 'fight'")
                    # the next foe shows either its portrait or, if it has none yet, the placeholder
                    page.wait_for_function("!document.getElementById('facePlaceholder').hasAttribute('hidden') || !document.getElementById('faceImg').hidden", timeout=3000)
                    src = page.evaluate("() => document.getElementById('faceImg').hidden ? 'placeholder' : document.getElementById('faceImg').getAttribute('src')")
                    check(src == "placeholder" or src.endswith("dickinson-normal.webp"), f"second foe shows {src}")
                    th = page.evaluate("async () => { await document.fonts.ready; const cs = getComputedStyle(document.body); return {foe: document.body.dataset.foe, bg: cs.getPropertyValue('--bg').trim(), font: document.fonts.check('20px \"Cormorant Garamond\"'), tileFont: getComputedStyle(document.querySelector('.tile')).fontFamily} }")
                    check(th["foe"] == "dickinson" and th["bg"] == "#141c17" and th["font"] and "Cormorant" in th["tileFont"], f"Dickinson's theme and font are applied {th}")
                continue
            if st["mode"] in ("won", "defeat"):
                outcome = st["mode"]; break
            if st["phase"] != "player":
                page.wait_for_function("beatPoe.S.phase === 'player' || beatPoe.S.mode !== 'fight'", timeout=3000); continue
            best = page.evaluate("() => beatPoe.L.bestWord(beatPoe.S.fight.grid, {common: true})")
            if not best["word"]:
                page.locator("#btnScramble").tap(); page.locator("#btnScramble").tap(); continue
            for i in best["tiles"]:
                page.locator(".tile").nth(i).tap()
            page.locator("#btnPlay").tap(); plays += 1
        fin = page.evaluate("() => ({idx: beatPoe.S.fight.idx, lives: beatPoe.S.lives, perfect: beatPoe.S.totalPerfect, plays: beatPoe.S.totalPlays})")
        print(f"--- full run by taps: outcome={outcome}, {plays} plays, {json.dumps(fin)}, screenshots={sorted(shots)}")
        check(outcome == "won", "a perfect-play bot wins a whole run through the UI")
        check(len(said) >= 8, f"the foes said {len(said)} different lines during the run")
        check(fin["perfect"] == fin["plays"], "every best-word play was judged perfect")
        page.locator("#ovBtn").tap()
        check(page.evaluate("() => beatPoe.S.mode === 'fight' && beatPoe.S.fight.idx === 0 && beatPoe.S.lives === 0 && beatPoe.S.playerHp === 80"), "Play again starts a fresh run with 0 lives")
        check(page.evaluate("() => document.getElementById('title').hidden"), "Play again goes straight to the fight (no title screen)")
        logs = [l for l in logs if "404" not in l]     # portraits that do not exist yet are expected to 404
        check(not logs, f"no console errors {logs[:2]}")
        ctx.close()

        # ---- title screen ----
        for name, w, h in [("se-with-bars", 375, 548), ("small-android", 360, 640), ("iphone-14", 390, 844)]:
            ctx = b.new_context(viewport={"width": w, "height": h}, has_touch=True, is_mobile=True, device_scale_factor=2)
            page = ctx.new_page(); logs = []
            page.on("pageerror", lambda e: logs.append(str(e)))
            page.on("console", lambda m: logs.append(m.text) if m.type == "error" else None)
            page.goto(URL)
            page.wait_for_function("window.beatPoe && window.beatPoe.S.mode === 'fight'", timeout=30000)
            page.wait_for_timeout(1800)
            check(not page.evaluate("() => document.getElementById('title').hidden"), f"title screen shows on a fresh launch ({name})")
            m = page.evaluate("""() => { const t = document.getElementById('title'); const kids = [...t.children].map(e => e.getBoundingClientRect());
              return {fits: Math.max(...kids.map(r => r.bottom)) <= innerHeight + 0.5 && Math.max(...kids.map(r => r.right)) <= innerWidth + 0.5,
                      scroll: document.documentElement.scrollHeight <= innerHeight, tiles: t.querySelectorAll('.lt').length, cards: t.querySelectorAll('.pc').length,
                      imgs: [...t.querySelectorAll('.pc img')].every(i => i.complete && i.naturalWidth > 0), play: document.getElementById('titlePlay').getBoundingClientRect().height} }""")
            check(m["fits"] and m["scroll"], f"title fits on screen with no scrolling ({name})")
            check(m["tiles"] == 8 and m["cards"] == 4 and m["imgs"], f"title shows 8 logo tiles and 4 author portraits ({name})")
            check(m["play"] >= 44, f"Play is thumb-sized ({m['play']:.0f}px)")
            page.screenshot(path=f"shots/{name}-title.png")
            if name == "iphone-14":
                page.locator("#titleHow").tap()
                check(not page.evaluate("() => document.getElementById('howPanel').hidden"), "How to play opens")
                page.screenshot(path=f"shots/{name}-title-how.png")
                page.locator("#howClose").tap()
                check(page.evaluate("() => document.getElementById('howPanel').hidden && !document.getElementById('title').hidden"), "Got it closes How to play and the title stays")
                page.locator("#titleGear").tap()
                check(page.evaluate("() => { const s = document.getElementById('settings'); const r = s.getBoundingClientRect(); return !s.hidden && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).closest('#settings') !== null; }"), "Settings opens above the title screen")
                page.locator("#setClose").tap()
                tiles_before = page.evaluate("() => beatPoe.S.sel.length")
                page.keyboard.type("abc")
                check(page.evaluate("() => beatPoe.S.sel.length") == tiles_before, "typing does nothing while the title is up")
                page.locator(".lt").first.tap()
                check(page.evaluate("() => document.querySelector('.lt').classList.contains('up')"), "a logo tile lifts when tapped")
                hp = page.evaluate("() => beatPoe.S.fight.hp"); grid0 = page.evaluate("() => JSON.stringify(beatPoe.S.fight.grid)")
                page.locator("#titlePlay").tap()
                page.wait_for_function("document.getElementById('title').hidden", timeout=3000)
                check(page.evaluate("() => beatPoe.S.mode === 'fight' && beatPoe.S.phase === 'player' && beatPoe.S.lives === 0 && beatPoe.S.playerHp === 80"), "Play starts a fresh run")
                check(page.evaluate("() => { const r = document.querySelector('.tile').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).classList.contains('tile'); }"), "the board is reachable once the title is gone")
                page.reload()
                page.wait_for_function("window.beatPoe && window.beatPoe.S.mode === 'fight'", timeout=30000)
                check(not page.evaluate("() => document.getElementById('title').hidden"), "reopening the game shows the title again")
                page.keyboard.press("Enter")
                page.wait_for_function("document.getElementById('title').hidden", timeout=3000)
                check(True, "Enter starts the game from the title")
            check(not logs, f"no console errors on the title ({name}) {logs[:2]}")
            ctx.close()

        # ---- BONUS LIFE splash ----
        for calm in (False, True):
            ctx = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, reduced_motion="reduce" if calm else "no-preference")
            page = ctx.new_page(); logs = []
            page.on("pageerror", lambda e: logs.append(str(e)))
            page.goto(URL)
            page.wait_for_function("window.beatPoe && window.beatPoe.S.mode === 'fight'", timeout=30000)
            start(page)
            tag = "reduced motion: " if calm else ""
            best = page.evaluate("() => beatPoe.L.bestWord(beatPoe.S.fight.grid, {common: true})")
            page.evaluate("() => { beatPoe.S.fight.hp = 9999; }")          # a long fight: this play cannot kill
            layout = lambda: page.evaluate("() => [...document.getElementById('app').children].filter(e => !e.hidden && !e.classList.contains('bl-root')).map(e => Math.round(e.getBoundingClientRect().height)).join()")
            before = layout()
            for i in best["tiles"]: page.locator(".tile").nth(i).tap()
            t0 = time.time(); page.locator("#btnPlay").tap()
            check(page.evaluate("() => beatPoe.S.lives") == 1, tag + "a perfect word earns a bonus life")
            check(page.locator(".bl-zone").count() == 1 and page.locator(".bl-title").inner_text().replace("\n", " ").upper().startswith("BONUS"), tag + "the BONUS LIFE splash appears")
            check(page.evaluate("() => document.getElementById('banner').hidden"), tag + "the old tray banner is not used for bonus lives")
            check(page.evaluate("() => document.getElementById('livesNum').textContent") == "0", tag + "counter keeps its old number while the splash plays")
            check(page.locator(".bl-confetti").count() == (0 if calm else 1), tag + ("no confetti" if calm else "confetti canvas present"))
            check(layout() == before, tag + "the splash does not shift the layout")
            check(page.evaluate("() => { const r = document.querySelector('.tile').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).classList.contains('tile'); }"), tag + "taps reach the tiles through the splash")
            page.wait_for_function("document.querySelectorAll('.bl-root').length === 0", timeout=6000)
            took = time.time() - t0
            check((2.2 <= took <= 3.0) if calm else (3.6 <= took <= 4.3), tag + f"the splash ends by itself ({took:.1f}s)")
            check(page.evaluate("() => document.getElementById('livesNum').textContent") == "1" and page.evaluate("() => document.getElementById('lives').classList.contains('has')"), tag + "counter reads 1 afterwards")
            # a second perfect word in the middle of the first splash leaves just one splash
            page.wait_for_function("beatPoe.S.phase === 'player'", timeout=3000)
            best = page.evaluate("() => beatPoe.L.bestWord(beatPoe.S.fight.grid, {common: true})")
            for i in best["tiles"]: page.locator(".tile").nth(i).tap()
            page.locator("#btnPlay").tap(); page.wait_for_timeout(1200)
            page.wait_for_function("beatPoe.S.phase === 'player'", timeout=3000)
            best = page.evaluate("() => beatPoe.L.bestWord(beatPoe.S.fight.grid, {common: true})")
            for i in best["tiles"]: page.locator(".tile").nth(i).tap()
            page.locator("#btnPlay").tap(); page.wait_for_timeout(300)
            check(page.locator(".bl-root").count() == 1, tag + "a new bonus life restarts the splash instead of stacking")
            page.wait_for_function("document.querySelectorAll('.bl-root').length === 0", timeout=6000)
            check(page.evaluate("() => document.getElementById('livesNum').textContent") == "3", tag + "counter reads 3 after three perfect words")
            # a perfect killing blow: the result card waits for the splash
            page.wait_for_function("beatPoe.S.phase === 'player'", timeout=3000)
            best = page.evaluate("() => beatPoe.L.bestWord(beatPoe.S.fight.grid, {common: true})")
            page.evaluate("(d) => { beatPoe.S.fight.hp = d; }", best["dmg"])
            for i in best["tiles"]: page.locator(".tile").nth(i).tap()
            t0 = time.time(); page.locator("#btnPlay").tap()
            check(page.evaluate("() => beatPoe.S.mode") == "victory", tag + "the killing blow wins the fight")
            page.wait_for_timeout(2200 if not calm else 2000)
            check(page.evaluate("() => document.getElementById('overlay').hidden"), tag + "result card is still waiting while the splash plays")
            page.locator("#ovBtn").wait_for(state="visible", timeout=6000)
            check(page.locator(".bl-root").count() == 0, tag + "splash is gone when the result card appears")
            page.locator("#ovBtn").tap()
            page.wait_for_function("beatPoe.S.mode === 'fight'")
            check(page.locator(".bl-root").count() == 0, tag + "starting the next foe leaves no splash behind")
            check(not logs, tag + f"no page errors {logs[:2]}")
            ctx.close()

        # ---- desktop + keyboard ----
        ctx = b.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        page.goto(URL)
        page.wait_for_function("window.beatPoe && window.beatPoe.S.mode === 'fight'", timeout=30000)
        start(page)
        page.evaluate("""() => { const g = beatPoe.S.fight.grid; const set = (i, ch, qu) => { g[i].ch = ch; g[i].qu = !!qu; g[i].cursed = false; };
           for (let i = 0; i < 16; i++) set(i, 'B'); set(0,'Q',true); set(1,'I'); set(2,'T'); set(3,'E'); set(4,'U'); set(5,'Q'); beatPoe.render(); }""")
        page.keyboard.type("quit")
        check(page.locator("#word").inner_text() == "QUIT", "typing quit spells QUIT")
        check(page.evaluate("() => beatPoe.S.sel.join()") == "5,4,1,2", "typing prefers plain Q + U over the Qu tile")
        page.keyboard.press("Escape")
        page.evaluate("() => { beatPoe.S.fight.grid[4].ch = 'A'; beatPoe.render(); }")
        page.keyboard.type("quite")
        check(page.evaluate("() => beatPoe.S.sel.join()") == "0,1,2,3", "with no U free, q picks the Qu tile and the typed u is swallowed")
        check(page.locator("#word").inner_text() == "QUITE", "tray shows QUITE")
        page.keyboard.press("Backspace")
        check(page.locator("#word").inner_text() == "QUIT", "Backspace removes a letter")
        hp0 = page.evaluate("() => beatPoe.S.fight.hp")
        page.keyboard.press("Enter")
        check(page.evaluate("() => beatPoe.S.fight.hp") == hp0 - 7, "Enter plays QUIT with a Qu tile for 7")
        page.wait_for_function("beatPoe.S.phase === 'player'", timeout=3000)
        page.screenshot(path="shots/desktop.png")
        before = page.evaluate("() => beatPoe.L.commonOnly")
        page.keyboard.press("F2")
        after = page.evaluate("() => beatPoe.L.commonOnly")
        check(before != after, f"F2 toggles the best-word list ({before} -> {after})")
        page.reload()
        page.wait_for_function("window.beatPoe && window.beatPoe.S.mode === 'fight'", timeout=30000)
        start(page)
        check(page.evaluate("() => beatPoe.L.commonOnly") == after, "the setting survives a reload (localStorage)")
        t = page.evaluate("() => beatPoe.S.fight.turn")
        page.keyboard.press("Tab")
        check(page.evaluate("() => beatPoe.S.fight.turn") == t + 1, "Tab scrambles")
        ctx.close()
        b.close()
finally:
    srv.terminate()
print("\nFAILURES:" if errors else "\nALL SMOKE CHECKS PASSED", errors if errors else "")
