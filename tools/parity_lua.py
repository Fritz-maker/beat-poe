"""Replay a JS trace in the original LÖVE logic.lua and check both agree.

    node tools/make-trace.mjs > /tmp/trace.json
    python3 tools/parity_lua.py /tmp/trace.json love/

Needs: pip install lupa
"""
import json
import sys

from lupa import LuaRuntime

trace_path, lua_dir = sys.argv[1], sys.argv[2].rstrip("/")
games = json.load(open(trace_path))

lua = LuaRuntime(unpack_returned_tuples=True)
lua.execute(f'package.path = "{lua_dir}/?.lua;" .. package.path')
lua.execute(
    """
L = require("logic")
L.loadWords(io.lines(DIR .. "/words.txt"))
L.loadCommon(io.lines(DIR .. "/common.txt"))
local s = 1
function seed(n) s = n % 2147483647; if s <= 0 then s = s + 2147483646 end end
function rand(n) s = (s * 48271) % 2147483647; return (s % n) + 1 end
function label(g)
  local t = {}
  for i, tile in ipairs(g) do t[i] = L.tileLabel(tile) .. (tile.cursed and "*" or "") end
  return table.concat(t, " ")
end
function play(fight, sel)
  local res, err = L.playWord(fight, sel, rand)
  if not res then return nil, err end
  return res.word, res.dmg, res.bestWord, res.bestDmg
end
function enemy(fight)
  local dmg, replaced = L.enemyAct(fight, rand)
  local r = ""
  if replaced then
    local t = {}
    for i, v in ipairs(replaced) do t[i] = tostring(v - 1) end
    r = table.concat(t, ",")
  end
  return dmg, replaced ~= nil, r
end
""".replace("DIR", f'"{lua_dir}"')
)
g = lua.globals()
checks = 0


def same(what, a, b, where):
    global checks
    checks += 1
    if a != b:
        print(f"MISMATCH {where}: {what}: lua={a!r} js={b!r}")
        sys.exit(1)


for game in games:
    g.seed(game["seed"])
    g.L.commonOnly = game["common"]
    fight = None
    for n, st in enumerate(game["steps"]):
        where = f"seed {game['seed']} step {n} ({st['op']})"
        if st["op"] == "fight":
            fight = g.L.newFight(st["idx"] + 1, g.rand)
        elif st["op"] == "scramble":
            g.L.scramble(fight, g.rand)
        elif st["op"] == "play":
            sel = lua.table(*[i + 1 for i in st["sel"]])
            word, dmg, best_word, best_dmg = g.play(fight, sel)
            same("word", word, st["word"], where)
            same("dmg", dmg, st["dmg"], where)
            same("bestDmg", best_dmg, st["bestDmg"], where)
            same("bestWord", best_word, st["bestWord"], where)
            same("hp", fight.hp, st["hp"], where)
        elif st["op"] == "enemy":
            dmg, waved, repl = g.enemy(fight)
            same("enemy dmg", dmg, st["dmg"], where)
            same("wave fired", waved, st["replaced"] is not None, where)
            if waved:
                same("wave tiles", repl, ",".join(str(i) for i in st["replaced"]), where)
            same("waveIn", fight.waveIn, st["waveIn"], where)
        same("grid", g.label(fight.grid), st["grid"], where)

plays = sum(1 for game in games for st in game["steps"] if st["op"] == "play")
print(f"OK: {len(games)} games, {plays} plays, {checks} checks - Lua and JS agree")
