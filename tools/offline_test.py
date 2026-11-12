import subprocess, sys, time
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable, "-I", "-m", "http.server", "8772", "--bind", "127.0.0.1", "--directory", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
fails = []
def check(c, what):
    print(("ok   " if c else "FAIL ") + what)
    if not c: fails.append(what)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        ctx = b.new_context(viewport={"width": 412, "height": 763})
        pg = ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8772/")
        pg.wait_for_function("window.beatPoe && beatPoe.S.mode === 'fight'")
        pg.evaluate("() => navigator.serviceWorker.ready.then(() => true)")
        pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=20000)
        n = 0
        for _ in range(40):
            n = pg.evaluate("async () => { const c = await caches.open('beat-poe-v1'); return (await c.keys()).length }")
            if n >= 30: break
            pg.wait_for_timeout(500)
        check(n >= 30, f"all {n} files saved for offline play")
        man = pg.evaluate("async () => { const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json(); const ok = await Promise.all(m.icons.map(i => fetch(i.src).then(r => r.ok))); return {name: m.name, display: m.display, icons: m.icons.length, ok: ok.every(Boolean)} }")
        check(man["name"] == "Beat Poe!" and man["display"] == "standalone" and man["icons"] == 3 and man["ok"], f"manifest and its icons load {man}")
        # now pull the plug: stop the server AND tell the browser it is offline
        srv.terminate(); srv.wait()
        ctx.set_offline(True)
        pg.reload()
        pg.wait_for_function("window.beatPoe && beatPoe.S.mode === 'fight'", timeout=30000)
        check(True, "the game starts with no network at all")
        check(pg.evaluate("() => beatPoe.L.wordArr.length") == 271684, "word list loaded from the saved copy")
        pg.wait_for_function("!document.getElementById('faceImg').hidden", timeout=5000)
        check(pg.evaluate("() => document.getElementById('faceImg').naturalWidth > 0"), "Twain's portrait shows offline")
        check(pg.evaluate("async () => { await document.fonts.ready; return document.fonts.check('20px \"Alfa Slab One\"') }"), "Twain's font loads offline")
        pg.evaluate("() => { beatPoe.S.fight.hp = 1; }")
        best = pg.evaluate("() => beatPoe.L.bestWord(beatPoe.S.fight.grid)")
        for i in best["tiles"]: pg.locator(".tile").nth(i).click()
        pg.locator("#btnPlay").click(); pg.locator("#ovBtn").click()
        pg.wait_for_function("beatPoe.S.mode === 'fight' && beatPoe.S.fight.idx === 1 && !document.getElementById('faceImg').hidden", timeout=5000)
        check(pg.evaluate("() => document.getElementById('faceImg').naturalWidth > 0 && document.getElementById('faceImg').getAttribute('src').includes('dickinson')"), "the next foe's portrait shows offline too")
        check(not errs, f"no script errors {errs[:1]}")
        b.close()
finally:
    if srv.poll() is None: srv.terminate()
print("\nFAILURES: " + str(fails) if fails else "\nALL OFFLINE CHECKS PASSED")
