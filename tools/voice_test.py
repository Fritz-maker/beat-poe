import subprocess, sys, time, json
from playwright.sync_api import sync_playwright
from PIL import Image
srv = subprocess.Popen([sys.executable, "-I", "-m", "http.server", "8770", "--bind", "127.0.0.1", "--directory", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
import os
os.makedirs("shots", exist_ok=True)
fails = []
def check(c, what):
    print(("ok   " if c else "FAIL ") + what)
    if not c: fails.append(what)
shots = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        for name, w, h in [("small", 375, 548), ("pixel", 412, 763)]:
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
            errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto("http://127.0.0.1:8770/")
            pg.wait_for_function("window.beatPoe && beatPoe.S.mode === 'fight'")
            pg.evaluate("() => document.fonts.ready")
            line = lambda foe, key: pg.evaluate("([f,k]) => [].concat(beatPoe.LINES[f][k]).map(l => l.replaceAll(' / ', '\\n'))", [foe, key])
            bubble = lambda: pg.evaluate("() => document.getElementById('msg').textContent")
            fits = lambda: pg.evaluate("() => document.getElementById('msg').getBoundingClientRect().bottom <= document.querySelector('.foebar').getBoundingClientRect().top + 1")
            def snap(tag):
                pg.wait_for_timeout(350)
                path = f"/tmp/v-{name}-{tag}.png"; pg.screenshot(path=path, clip={"x": 0, "y": 0, "width": w, "height": 250}); shots.append(path)
            def play(max_len):
                best = pg.evaluate("(n) => beatPoe.L.bestWord(beatPoe.S.fight.grid, {maxLen: n})", max_len)
                for i in best["tiles"]: pg.locator(".tile").nth(i).click()
                pg.locator("#btnPlay").click(); return best
            def wait_turn(): pg.wait_for_function("beatPoe.S.phase === 'player' || beatPoe.S.mode !== 'fight'")
            def calm(): pg.evaluate("() => { const f = beatPoe.S.fight; f.waveIn = 9; f.hp = f.enemy.hp; beatPoe.S.playerHp = 80; f.saidLow = false; }")
            def next_foe():
                pg.evaluate("() => { beatPoe.S.fight.hp = 1; }"); play(8); pg.locator("#ovBtn").click()
                pg.wait_for_function("beatPoe.S.mode === 'fight' && beatPoe.S.phase === 'player'"); pg.evaluate("() => document.fonts.ready"); pg.wait_for_timeout(300)

            # --- Twain ---
            check(bubble() in line("twain", "intro") and fits(), f"{name}: Twain intro")
            snap("twain-intro")
            calm(); play(3)
            check(bubble() in line("twain", "weak") + line("twain", "close") + line("twain", "perfect"), f"{name}: reaction to a 3-letter word ({bubble()!r})")
            held = bubble(); wait_turn()
            check(bubble() == held, f"{name}: the reaction stays up through the foe's quiet turn")
            check(pg.evaluate("() => document.getElementById('wordInfo').textContent").endswith("."), f"{name}: note under the tray")
            calm(); play(5); wait_turn()
            b5 = bubble()
            check(b5 in line("twain", "hit") + line("twain", "close") + line("twain", "perfect"), f"{name}: plain turn draws a hit line ({b5!r})")
            calm(); pg.evaluate("() => { beatPoe.S.fight.waveIn = 1; }"); pg.keyboard.press("Tab")
            check(bubble() in line("twain", "scramble"), f"{name}: scramble line"); snap("twain-scramble")
            wait_turn(); check(bubble() in line("twain", "curse") and fits(), f"{name}: curse line overrides when the wave lands ({bubble()!r})")
            calm(); pg.evaluate("() => { beatPoe.S.playerHp = 22; }"); play(5); wait_turn()
            check(bubble() in line("twain", "low") and fits(), f"{name}: nearly-dead line ({bubble()!r})"); snap("twain-low")
            pg.evaluate("() => { beatPoe.S.fight.waveIn = 9; beatPoe.S.playerHp = 20; }"); play(5); wait_turn()
            check(bubble() not in line("twain", "low"), f"{name}: nearly-dead line is said only once")
            # --- Dickinson: the three-line verse on a small stage ---
            next_foe(); check(bubble() in line("dickinson", "intro") and fits(), f"{name}: Dickinson intro fits"); snap("emily-intro")
            calm(); pg.evaluate("() => { const g = beatPoe.S.fight.grid; 'CATQZXJKVWBDFGHM'.split('').forEach((c, i) => { g[i] = {ch: c, qu: false, cursed: false}; }); g[3] = {ch:'S',qu:false,cursed:false}; g[4]={ch:'E',qu:false,cursed:false}; g[5]={ch:'R',qu:false,cursed:false}; g[6]={ch:'O',qu:false,cursed:false}; g[7]={ch:'N',qu:false,cursed:false}; beatPoe.render(); }")
            for ch in "cat": pg.keyboard.press(ch)
            pg.keyboard.press("Enter")
            check(bubble() in line("dickinson", "weak") and fits(), f"{name}: Dickinson three-line verse fits ({bubble()!r})"); snap("emily-weak")
            wait_turn()
            # --- Shelley, then Poe ---
            next_foe(); next_foe()
            check(bubble() in line("poe", "intro") and fits(), f"{name}: Poe entrance fits"); snap("poe-intro")
            calm(); play(16)
            check(bubble() in line("poe", "perfect") and fits(), f"{name}: Poe's longest line fits"); snap("poe-perfect")
            wait_turn()
            calm(); pg.evaluate("() => { beatPoe.S.lives = 1; beatPoe.S.playerHp = 1; }"); play(5); wait_turn()
            check(bubble() in line("poe", "life") and fits(), f"{name}: bonus-life line ({bubble()!r})")
            check("Bonus life used" in pg.evaluate("() => document.getElementById('wordInfo').textContent") and pg.evaluate("() => beatPoe.S.playerHp") == 40, f"{name}: life spent, back at 40")
            snap("poe-life")
            pg.evaluate("() => { beatPoe.S.fight.waveIn = 9; beatPoe.S.lives = 0; beatPoe.S.playerHp = 1; }"); play(5)
            pg.locator("#ovBtn").wait_for(state="visible"); pg.wait_for_timeout(300)
            card = pg.evaluate("() => document.getElementById('ovText').textContent")
            check("In pace requiescat!" in card, f"{name}: defeat card carries Poe's last word")
            path = f"/tmp/v-{name}-defeat.png"; pg.screenshot(path=path); shots.append(path)
            check(not errs, f"{name}: no script errors {errs[:1]}")
            pg.close()
        b.close()
finally:
    srv.terminate()
for grp in ("small", "pixel"):
    ims = [Image.open(s) for s in shots if f"v-{grp}-" in s and "defeat" not in s]
    w = ims[0].width; cols = 2; rows = (len(ims) + 1) // 2
    sheet = Image.new("RGB", (w * cols + 20, sum(i.height for i in ims[::2]) + 10 * rows), "#555")
    y = 0
    for r in range(rows):
        for c in range(cols):
            k = r * 2 + c
            if k < len(ims): sheet.paste(ims[k], (c * (w + 20), y))
        y += ims[r * 2].height + 10
    sheet = sheet.resize((sheet.width // 2, sheet.height // 2)); sheet.save(f"shots/voice-{grp}.png")
Image.open("/tmp/v-pixel-defeat.png").resize((412, 763)).save("shots/voice-defeat.png")
print("\nFAILURES: " + json.dumps(fails) if fails else "\nALL VOICE CHECKS PASSED")
