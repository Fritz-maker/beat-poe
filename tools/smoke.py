import json, subprocess, sys, time
from playwright.sync_api import sync_playwright

import os
ROOT = sys.argv[1]
os.makedirs("shots", exist_ok=True)
srv = subprocess.Popen([sys.executable, "-I", "-m", "http.server", "8765", "--bind", "127.0.0.1", "--directory", ROOT],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
URL = "http://127.0.0.1:8765/"
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
            if page.locator("#btnShow").is_visible():
                page.locator("#btnShow").tap()
                check("coming soon" in page.locator("#wordInfo").inner_text(), "Show me button answers")
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
        seen = set(); shots = set(); plays = 0; outcome = None
        for step in range(400):
            st = page.evaluate("() => ({mode: beatPoe.S.mode, phase: beatPoe.S.phase, idx: beatPoe.S.fight.idx, lives: beatPoe.S.lives, hp: beatPoe.S.playerHp, banner: document.getElementById('banner').hidden ? '' : document.getElementById('banner').className, wave: document.getElementById('wave').className, cursed: beatPoe.S.fight.grid.filter(t=>t.cursed).length})")
            seen.add(st["mode"])
            for key, cond in [("banner-life", "life" in st["banner"]), ("banner-close", "close" in st["banner"]),
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
                    check(page.evaluate("() => document.getElementById('faceImg').hidden && !document.getElementById('facePlaceholder').hasAttribute('hidden')"), "Dickinson still shows the placeholder")
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
        check(fin["perfect"] == fin["plays"], "every best-word play was judged perfect")
        page.locator("#ovBtn").tap()
        check(page.evaluate("() => beatPoe.S.mode === 'fight' && beatPoe.S.fight.idx === 0 && beatPoe.S.lives === 0 && beatPoe.S.playerHp === 80"), "Play again starts a fresh run with 0 lives")
        check(not logs, f"no console errors {logs[:2]}")
        ctx.close()

        # ---- desktop + keyboard ----
        ctx = b.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        page.goto(URL)
        page.wait_for_function("window.beatPoe && window.beatPoe.S.mode === 'fight'", timeout=30000)
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
        check(page.evaluate("() => beatPoe.L.commonOnly") == after, "the setting survives a reload (localStorage)")
        t = page.evaluate("() => beatPoe.S.fight.turn")
        page.keyboard.press("Tab")
        check(page.evaluate("() => beatPoe.S.fight.turn") == t + 1, "Tab scrambles")
        ctx.close()
        b.close()
finally:
    srv.terminate()
print("\nFAILURES:" if errors else "\nALL SMOKE CHECKS PASSED", errors if errors else "")
