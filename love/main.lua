-- Wordfight : a word-duel prototype for LÖVE 11.x
local Logic = require("logic")

---------------------------------------------------------------------------
-- Layout and colours
---------------------------------------------------------------------------
local TILE, GAP = 84, 10
local GRID_X = 550 - (4 * TILE + 3 * GAP) / 2
local GRID_Y = 318

local C = {
  bg      = { 0.09, 0.07, 0.10 },
  panel   = { 0.15, 0.12, 0.17 },
  edge    = { 0.35, 0.28, 0.38 },
  text    = { 0.93, 0.89, 0.80 },
  dim     = { 0.62, 0.58, 0.55 },
  tile    = { 0.86, 0.77, 0.58 },
  tileSel = { 1.00, 0.90, 0.40 },
  ink     = { 0.20, 0.13, 0.08 },
  curse   = { 0.42, 0.17, 0.58 },
  good    = { 0.45, 0.85, 0.50 },
  bad     = { 0.95, 0.40, 0.38 },
  warn    = { 0.95, 0.75, 0.30 },
  hp      = { 0.80, 0.22, 0.25 },
  ehp     = { 0.55, 0.30, 0.80 },
}

local BODY = {
  { 0.35, 0.60, 0.30 }, { 0.55, 0.65, 0.75 }, { 0.20, 0.20, 0.35 }, { 0.75, 0.25, 0.20 },
}

local function col(c, a) love.graphics.setColor(c[1], c[2], c[3], a or 1) end
local function rnd(n) return love.math.random(n) end

---------------------------------------------------------------------------
-- State
---------------------------------------------------------------------------
local fonts = {}
local mode            -- "fight" | "victory" | "defeat" | "won"
local fight, sel, selSet
local phase, timer    -- "player" | "enemy"
local playerHp, pHpShown, eHpShown
local logLines, popups, flash, reveal
local shakeE, shakeP = 0, 0
local toastText, toastT = "", 0
local totalPlays, totalPerfect = 0, 0
local lives = 0       -- bonus lives: +1 per best-word hit, spent only in the final fight
local banner, confetti = nil, {}   -- celebratory pop-up graphics
local buttons = {}

-- The game is laid out on a fixed 1100x720 canvas and scaled to fit the window
local VW, VH = 1100, 720
local view = { s = 1, ox = 0, oy = 0 }

local function updateView()
  local w, h = love.graphics.getDimensions()
  view.s = math.min(w / VW, h / VH)
  view.ox = (w - VW * view.s) / 2
  view.oy = (h - VH * view.s) / 2
end

-- window pixels -> canvas coordinates
local function toCanvas(x, y)
  return (x - view.ox) / view.s, (y - view.oy) / view.s
end

local function buildFonts()
  -- render fonts at the current scale so text stays sharp when enlarged
  local dpi = math.max(1, view.s * love.graphics.getDPIScale())
  fonts.giant = love.graphics.newFont(76, "normal", dpi)
  fonts.huge = love.graphics.newFont(44, "normal", dpi)
  fonts.big  = love.graphics.newFont(30, "normal", dpi)
  fonts.mid  = love.graphics.newFont(20, "normal", dpi)
  fonts.sm   = love.graphics.newFont(15, "normal", dpi)
  fonts.tiny = love.graphics.newFont(12, "normal", dpi)
end

local function addLog(text, color)
  table.insert(logLines, 1, { text = text, color = color or C.text })
  while #logLines > 40 do table.remove(logLines) end
end

local function toast(msg) toastText, toastT = msg, 2.0 end

local function popup(text, x, y, color)
  popups[#popups + 1] = { text = text, x = x, y = y, t = 1.2, color = color }
end

local lastQu = nil   -- a Qu tile just picked by typing "q" (so the following "u" is swallowed)

local function spawnConfetti(n, x, y)
  local cols = { C.warn, C.good, { 0.95, 0.45, 0.75 }, { 0.45, 0.75, 1.0 }, { 1, 1, 1 } }
  local function r() return rnd(10000) / 10000 end
  for _ = 1, n do
    local ang = r() * math.pi * 2
    local sp = 180 + r() * 560
    confetti[#confetti + 1] = {
      x = x, y = y,
      vx = math.cos(ang) * sp, vy = math.sin(ang) * sp - 260,
      rot = r() * 6.28, vr = (r() - 0.5) * 14,
      c = cols[rnd(#cols)],
      w = 7 + r() * 7, h = 12 + r() * 9,
    }
  end
end

-- kind "life": a = lives now saved.   kind "close": a = damage missed by, b = best word
local function startBanner(kind, a, b)
  banner = { kind = kind, t = 0, dur = (kind == "life") and 3.8 or 2.4, a = a, b = b }
  confetti = {}
  if kind == "life" then spawnConfetti(110, 550, 370) end
end

local function clearSel() sel, selSet, lastQu = {}, {}, nil end

local function startFight(idx)
  fight = Logic.newFight(idx, rnd)
  fight.plays, fight.perfect, fight.longest = 0, 0, ""
  clearSel()
  flash = {}
  reveal = nil
  phase, timer = "player", 0
  mode = "fight"
  eHpShown = fight.hp
  addLog("A " .. fight.enemy.name .. " blocks the way!", C.warn)
end

local function startCampaign()
  playerHp = Logic.PLAYER_MAX_HP
  pHpShown = playerHp
  logLines, popups = {}, {}
  totalPlays, totalPerfect = 0, 0
  lives = 0
  banner, confetti = nil, {}
  startFight(1)
end

---------------------------------------------------------------------------
-- Actions
---------------------------------------------------------------------------
local function canAct() return mode == "fight" and phase == "player" end

local function removeLast()
  if not canAct() or #sel == 0 then return end
  local idx = table.remove(sel)
  selSet[idx] = nil
  lastQu = nil
end

local function toggleTile(i)
  if not canAct() then return end
  lastQu = nil
  if selSet[i] then
    for k, v in ipairs(sel) do
      if v == i then table.remove(sel, k); break end
    end
    selSet = {}
    for k, v in ipairs(sel) do selSet[v] = k end
  else
    sel[#sel + 1] = i
    selSet[i] = #sel
  end
end

local function typeLetter(ch)
  if not canAct() then return end
  ch = ch:upper()
  -- typing "qu" onto a Qu tile: the tile already spells QU, so the "u" is swallowed
  if ch == "U" and lastQu and sel[#sel] == lastQu then lastQu = nil; return end
  lastQu = nil
  local function pick(i)
    sel[#sel + 1] = i
    selSet[i] = #sel
  end
  if ch == "Q" then
    -- prefer a plain Q while a U tile is free (Q + U scores more than a Qu tile);
    -- otherwise use a Qu tile
    local plain, qu, uFree
    for i, t in ipairs(fight.grid) do
      if not selSet[i] then
        if t.ch == "Q" and not t.qu then plain = plain or i end
        if t.ch == "Q" and t.qu then qu = qu or i end
        if t.ch == "U" then uFree = true end
      end
    end
    if plain and uFree then pick(plain)
    elseif qu then pick(qu); lastQu = qu
    elseif plain then pick(plain) end
    return
  end
  for i, t in ipairs(fight.grid) do
    if t.ch == ch and not selSet[i] then pick(i); return end
  end
end

local function beginEnemyPhase()
  phase, timer = "enemy", 0.7
end

local function submit()
  if not canAct() then return end
  local res, err = Logic.playWord(fight, sel, rnd)
  if not res then toast(err); return end

  fight.plays = fight.plays + 1
  totalPlays = totalPlays + 1
  local perfect = res.dmg >= res.bestDmg
  if perfect then
    fight.perfect = fight.perfect + 1
    totalPerfect = totalPerfect + 1
    lives = lives + 1
  end
  if #res.word > #fight.longest then fight.longest = res.word end
  reveal = res

  for _, idx in ipairs(res.used) do flash[idx] = 0.45 end
  shakeE = 0.35
  popup("-" .. res.dmg, 550, 120, C.warn)
  addLog(string.format("You: %s  (%d dmg)", res.word, res.dmg), C.text)
  if perfect then
    addLog("Perfect word!  +1 bonus life  (" .. lives .. ")", C.warn)
    startBanner("life", lives)
  else
    addLog(string.format("Best was %s  (%d dmg)", res.bestWord, res.bestDmg), C.dim)
    if res.dmg >= res.bestDmg * Logic.CLOSE_FRAC then
      startBanner("close", res.bestDmg - res.dmg, res.bestWord)
    end
  end
  clearSel()

  if fight.hp <= 0 then
    fight.hp = 0
    mode = "victory"
    local heal = math.floor(Logic.PLAYER_MAX_HP * Logic.HEAL_BETWEEN)
    playerHp = math.min(Logic.PLAYER_MAX_HP, playerHp + heal)
    fight.healed = heal
    addLog(fight.enemy.name .. " is defeated!", C.good)
  else
    beginEnemyPhase()
  end
end

local function scramble()
  if not canAct() then return end
  clearSel()
  Logic.scramble(fight, rnd)
  for i = 1, Logic.GRID do flash[i] = 0.4 end
  reveal = nil
  addLog("You scramble the grid - the foe gets a free swing.", C.warn)
  beginEnemyPhase()
end

local function enemyTurn()
  local dmg, replaced = Logic.enemyAct(fight, rnd)
  playerHp = playerHp - dmg
  shakeP = 0.35
  popup("-" .. dmg, 140, 90, C.bad)
  addLog(string.format("%s hits you for %d.", fight.enemy.name, dmg), C.bad)
  if replaced then
    for _, i in ipairs(replaced) do flash[i] = 0.7 end
    addLog("CURSE WAVE! " .. #replaced .. " tiles turn to hard letters.", { 0.75, 0.45, 0.95 })
  end
  if playerHp <= 0 and lives > 0 and fight.idx == #Logic.ENEMIES then
    -- spend a bonus life in the final fight
    lives = lives - 1
    playerHp = math.floor(Logic.PLAYER_MAX_HP * Logic.REVIVE_FRAC)
    popup("+" .. playerHp, 140, 90, C.good)
    addLog("BONUS LIFE used! Back with " .. playerHp .. " HP.  (" .. lives .. " left)", C.warn)
    phase = "player"
  elseif playerHp <= 0 then
    playerHp = 0
    mode = "defeat"
    addLog("You have been spelled to death...", C.bad)
  else
    phase = "player"
  end
end

local function advance()
  if mode == "victory" then
    if fight.idx >= #Logic.ENEMIES then mode = "won" else startFight(fight.idx + 1) end
  elseif mode == "defeat" or mode == "won" then
    startCampaign()
  end
end

local function saveSettings()
  love.filesystem.write("settings.txt", "common=" .. (Logic.commonOnly and "1" or "0") .. "\n")
end

local function toggleCommon()
  if #Logic.commonArr == 0 then toast("common.txt is missing."); return end
  Logic.commonOnly = not Logic.commonOnly
  saveSettings()
  toast(Logic.commonOnly and "Best-word check: common words only"
                          or "Best-word check: every valid word")
end

buttons = {
  { label = function() return Logic.commonOnly and "Best-word: common only  [F2]"
                                                or "Best-word: all words  [F2]" end,
    x = 24, y = 496, w = 276, h = 40, always = true, fn = function() toggleCommon() end },
  { label = "Play word  [Enter]", x = 24, y = 544, w = 276, h = 40, fn = function() submit() end },
  { label = "Clear  [Esc]",       x = 24, y = 592, w = 276, h = 40, fn = function() clearSel() end },
  { label = "Scramble [Tab] - costs a turn", x = 24, y = 640, w = 276, h = 40, fn = function() scramble() end },
}

---------------------------------------------------------------------------
-- LÖVE callbacks
---------------------------------------------------------------------------
function love.load()
  love.graphics.setBackgroundColor(C.bg)
  updateView()
  buildFonts()
  Logic.loadWords(love.filesystem.lines("words.txt"))
  if love.filesystem.getInfo("common.txt") then
    Logic.loadCommon(love.filesystem.lines("common.txt"))
    -- default: common words only, unless the player saved a different choice
    Logic.commonOnly = true
    local saved = love.filesystem.getInfo("settings.txt") and love.filesystem.read("settings.txt")
    if saved and saved:match("common=0") then Logic.commonOnly = false end
  end
  startCampaign()
end

function love.resize()
  updateView()
  buildFonts()
end

function love.update(dt)
  if toastT > 0 then toastT = toastT - dt end
  if shakeE > 0 then shakeE = shakeE - dt end
  if shakeP > 0 then shakeP = shakeP - dt end
  for i, v in pairs(flash) do
    v = v - dt
    flash[i] = v > 0 and v or nil
  end
  for i = #popups, 1, -1 do
    local p = popups[i]
    p.t = p.t - dt
    p.y = p.y - 40 * dt
    if p.t <= 0 then table.remove(popups, i) end
  end
  if banner then
    banner.t = banner.t + dt
    if banner.kind == "life" and not banner.burst2 and banner.t > 1.2 then
      banner.burst2 = true
      spawnConfetti(80, 550, 370)
    end
    for _, p in ipairs(confetti) do
      p.vy = p.vy + 900 * dt
      p.x = p.x + p.vx * dt
      p.y = p.y + p.vy * dt
      p.rot = p.rot + p.vr * dt
    end
    if banner.t >= banner.dur then banner, confetti = nil, {} end
  end
  if fight then
    eHpShown = eHpShown + (fight.hp - eHpShown) * math.min(1, dt * 6)
  end
  pHpShown = pHpShown + (playerHp - pHpShown) * math.min(1, dt * 6)

  if mode == "fight" and phase == "enemy" then
    timer = timer - dt
    if timer <= 0 then enemyTurn() end
  end
end

function love.textinput(t)
  if t:match("^%a$") then typeLetter(t) end
end

function love.keypressed(key)
  if key == "f11" then
    love.window.setFullscreen(not love.window.getFullscreen(), "desktop")
    return
  end
  if key == "f2" then toggleCommon(); return end
  if mode ~= "fight" then
    if key == "return" or key == "kpenter" or key == "space" then advance() end
    return
  end
  if key == "return" or key == "kpenter" then submit()
  elseif key == "backspace" then removeLast()
  elseif key == "tab" then scramble()
  elseif key == "escape" then
    if #sel > 0 then clearSel() else love.event.quit() end
  end
end

local function inRect(px, py, x, y, w, h) return px >= x and px <= x + w and py >= y and py <= y + h end

function love.mousepressed(mx, my, button)
  if button ~= 1 then return end
  mx, my = toCanvas(mx, my)
  if mode ~= "fight" then advance(); return end
  for i = 1, Logic.GRID do
    local c = (i - 1) % 4
    local r = math.floor((i - 1) / 4)
    local x = GRID_X + c * (TILE + GAP)
    local y = GRID_Y + r * (TILE + GAP)
    if inRect(mx, my, x, y, TILE, TILE) then toggleTile(i); return end
  end
  for _, b in ipairs(buttons) do
    if inRect(mx, my, b.x, b.y, b.w, b.h) then b.fn(); return end
  end
end

---------------------------------------------------------------------------
-- Drawing
---------------------------------------------------------------------------
local function panel(x, y, w, h)
  col(C.panel); love.graphics.rectangle("fill", x, y, w, h, 10, 10)
  col(C.edge);  love.graphics.rectangle("line", x, y, w, h, 10, 10)
end

local function bar(x, y, w, h, frac, color, label)
  frac = math.max(0, math.min(1, frac))
  col({ 0.05, 0.04, 0.06 }); love.graphics.rectangle("fill", x, y, w, h, 6, 6)
  col(color);                love.graphics.rectangle("fill", x, y, w * frac, h, 6, 6)
  col(C.edge);               love.graphics.rectangle("line", x, y, w, h, 6, 6)
  if label then
    love.graphics.setFont(fonts.sm)
    col(C.text)
    love.graphics.printf(label, x, y + (h - fonts.sm:getHeight()) / 2, w, "center")
  end
end

local function drawEnemy()
  local e = fight.enemy
  local ox = shakeE > 0 and (rnd(9) - 5) or 0
  local cx, cy = 550 + ox, 140
  local c = BODY[fight.idx] or BODY[1]
  col(c);                 love.graphics.ellipse("fill", cx, cy, 62, 54)
  col({ 0, 0, 0 }, 0.35); love.graphics.ellipse("line", cx, cy, 62, 54)
  if fight.idx == 4 then
    col(c); love.graphics.polygon("fill", cx - 50, cy - 30, cx - 36, cy - 78, cx - 20, cy - 44)
    love.graphics.polygon("fill", cx + 50, cy - 30, cx + 36, cy - 78, cx + 20, cy - 44)
  end
  col({ 1, 1, 1 })
  love.graphics.circle("fill", cx - 20, cy - 10, 11)
  love.graphics.circle("fill", cx + 20, cy - 10, 11)
  col({ 0.05, 0.05, 0.05 })
  love.graphics.circle("fill", cx - 18, cy - 8, 5)
  love.graphics.circle("fill", cx + 22, cy - 8, 5)
  love.graphics.setLineWidth(3)
  love.graphics.line(cx - 22, cy + 22, cx - 8, cy + 30, cx + 8, cy + 24, cx + 22, cy + 32)
  love.graphics.setLineWidth(1)

  love.graphics.setFont(fonts.mid)
  col(C.text)
  love.graphics.printf(e.name, 350, 14, 400, "center")
  bar(350, 44, 400, 22, eHpShown / e.hp, C.ehp, math.max(0, math.ceil(fight.hp)) .. " / " .. e.hp)

  love.graphics.setFont(fonts.sm)
  if fight.waveIn <= 1 then
    local pulse = 0.6 + 0.4 * math.sin(love.timer.getTime() * 8)
    love.graphics.setColor(0.8, 0.5, 1.0, pulse)
    love.graphics.printf("CURSE WAVE on the next enemy turn!", 350, 208, 400, "center")
  else
    col(C.dim)
    love.graphics.printf("Curse wave in " .. fight.waveIn .. " enemy turns  ("
      .. e.waveSize .. " tiles)", 350, 208, 400, "center")
  end
end

local function drawWordLine()
  local word, selDmg = Logic.selDamage(fight.grid, sel)
  love.graphics.setFont(fonts.huge)
  if #word == 0 then
    col(C.dim)
    love.graphics.printf("spell a word...", 300, 232, 500, "center")
  else
    local valid = #word >= Logic.MIN_WORD and Logic.isWord(word)
    col(valid and C.good or C.tileSel)
    love.graphics.printf(word, 300, 232, 500, "center")
  end
  love.graphics.setFont(fonts.sm)
  if #word >= Logic.MIN_WORD then
    if Logic.isWord(word) then
      col(C.good)
      love.graphics.printf(string.format("%d letters  x%.2f  =  %d damage",
        #word, Logic.lengthMult(#word), selDmg), 300, 288, 500, "center")
    else
      col(C.bad)
      love.graphics.printf("not in the word list", 300, 288, 500, "center")
    end
  end
  if toastT > 0 then
    love.graphics.setColor(C.warn[1], C.warn[2], C.warn[3], math.min(1, toastT))
    love.graphics.printf(toastText, 300, 300, 500, "center")
  end
end

local function drawGrid()
  for i = 1, Logic.GRID do
    local t = fight.grid[i]
    local c = (i - 1) % 4
    local r = math.floor((i - 1) / 4)
    local x = GRID_X + c * (TILE + GAP)
    local y = GRID_Y + r * (TILE + GAP)
    local picked = selSet[i]
    if picked then y = y - 6 end

    col({ 0, 0, 0 }, 0.35)
    love.graphics.rectangle("fill", x + 3, y + 6, TILE, TILE, 12, 12)
    if t.cursed then col(C.curse) elseif picked then col(C.tileSel) else col(C.tile) end
    love.graphics.rectangle("fill", x, y, TILE, TILE, 12, 12)
    if t.cursed then
      col({ 0.85, 0.55, 1.0 }); love.graphics.setLineWidth(3)
      love.graphics.rectangle("line", x, y, TILE, TILE, 12, 12)
      love.graphics.setLineWidth(1)
    end
    if flash[i] then
      love.graphics.setColor(1, 1, 1, math.min(0.8, flash[i] * 1.6))
      love.graphics.rectangle("fill", x, y, TILE, TILE, 12, 12)
    end

    love.graphics.setFont(fonts.big)
    if t.cursed then col({ 1, 0.95, 1 }) else col(C.ink) end
    love.graphics.printf(Logic.tileLabel(t), x, y + (TILE - fonts.big:getHeight()) / 2 - 3, TILE, "center")

    love.graphics.setFont(fonts.tiny)
    if t.cursed then col({ 0.9, 0.8, 1 }) else col({ 0.45, 0.33, 0.20 }) end
    love.graphics.print(string.format("%g", Logic.tileValue(t)), x + TILE - 22, y + TILE - 18)
    if picked then
      col(C.ink)
      love.graphics.print(tostring(picked), x + 7, y + 5)
    end
  end
end

local function drawLeft()
  panel(14, 14, 296, 690)
  love.graphics.setFont(fonts.mid)
  col(C.text)
  love.graphics.print("YOU", 30, 28)
  local sx = shakeP > 0 and (rnd(7) - 4) or 0
  bar(24 + sx, 60, 276, 24, pHpShown / Logic.PLAYER_MAX_HP, C.hp,
    math.max(0, math.ceil(playerHp)) .. " / " .. Logic.PLAYER_MAX_HP)

  love.graphics.setFont(fonts.sm)
  col(C.dim)
  local y = 104
  local lines = {
    "Foe " .. fight.idx .. " of " .. #Logic.ENEMIES,
    "Turn " .. fight.turn,
    "Longest word this fight: " .. (fight.longest ~= "" and fight.longest or "-"),
    string.format("Best-word hits: %d / %d", fight.perfect, fight.plays),
  }
  for _, l in ipairs(lines) do love.graphics.print(l, 28, y); y = y + 20 end
  col(lives > 0 and C.warn or C.dim)
  love.graphics.print("Bonus lives: " .. lives .. "  (final fight)", 28, y)

  local paras = {
    { "Click tiles or type letters.\nBackspace = undo a letter.\nF11 = fullscreen.", C.text },
    { "Long words and rare letters hit much harder. Purple tiles are curse letters: " ..
      "hard, but worth a lot. Qu tiles spell QU (worth 3).", C.text },
    { "Play the best word available (often the longest) to win a bonus life for the final fight.", C.warn },
    { "Scrambling costs your turn: the foe gets a free hit. It does clear curses.", C.text },
  }
  local ty = 216
  love.graphics.setFont(fonts.sm)
  for _, para in ipairs(paras) do
    local _, wrapped = fonts.sm:getWrap(para[1], 264)
    col(para[2])
    love.graphics.printf(para[1], 28, ty, 264, "left")
    ty = ty + #wrapped * fonts.sm:getHeight() + 8
  end

  local mx, my = toCanvas(love.mouse.getPosition())
  for _, b in ipairs(buttons) do
    local enabled = b.always or canAct()
    local hot = inRect(mx, my, b.x, b.y, b.w, b.h) and enabled
    col(hot and { 0.30, 0.24, 0.36 } or { 0.22, 0.18, 0.26 })
    love.graphics.rectangle("fill", b.x, b.y, b.w, b.h, 8, 8)
    col(C.edge); love.graphics.rectangle("line", b.x, b.y, b.w, b.h, 8, 8)
    love.graphics.setFont(fonts.sm)
    col(enabled and C.text or C.dim)
    local label = type(b.label) == "function" and b.label() or b.label
    love.graphics.printf(label, b.x, b.y + (b.h - fonts.sm:getHeight()) / 2, b.w, "center")
  end
end

local function drawRight()
  panel(790, 14, 296, 690)
  love.graphics.setFont(fonts.mid)
  col(C.text)
  love.graphics.print("LAST WORD CHECK", 806, 28)
  love.graphics.setFont(fonts.sm)
  if reveal then
    col(C.text)
    love.graphics.print(string.format("You:  %s  (%d)", reveal.word, reveal.dmg), 806, 62)
    if reveal.dmg >= reveal.bestDmg then
      col(C.good); love.graphics.print("Perfect - nothing beat it!", 806, 86)
    else
      col(C.warn)
      love.graphics.print(string.format("Best: %s  (%d)", reveal.bestWord, reveal.bestDmg), 806, 86)
      col(C.dim)
      love.graphics.print(string.format("Missed by %d damage", reveal.bestDmg - reveal.dmg), 806, 108)
    end
  else
    col(C.dim); love.graphics.print("Play a word to see the best one.", 806, 62)
  end

  love.graphics.setFont(fonts.tiny)
  col(C.dim)
  love.graphics.print(Logic.commonOnly and "(best word from common words only)"
                                        or "(best word from every valid word)", 806, 128)
  love.graphics.setFont(fonts.mid)
  col(C.text)
  love.graphics.print("LOG", 806, 150)
  love.graphics.setFont(fonts.sm)
  local y = 182
  for _, l in ipairs(logLines) do
    local _, wrapped = fonts.sm:getWrap(l.text, 264)
    local h = #wrapped * fonts.sm:getHeight() + 4
    if y + h > 696 then break end
    col(l.color)
    love.graphics.printf(l.text, 806, y, 264, "left")
    y = y + h
  end
end

local function overlay(title, sub, color)
  love.graphics.setColor(0, 0, 0, 0.72)
  love.graphics.rectangle("fill", 0, 0, 1100, 720)
  love.graphics.setFont(fonts.huge)
  col(color)
  love.graphics.printf(title, 0, 250, 1100, "center")
  love.graphics.setFont(fonts.mid)
  col(C.text)
  love.graphics.printf(sub, 250, 330, 600, "center")
end

local function easeOutBack(x)
  local c1, c3 = 1.70158, 2.70158
  return 1 + c3 * (x - 1) ^ 3 + c1 * (x - 1) ^ 2
end

local function outlinedText(text, x, y, w, color, alpha, th)
  th = th or 3
  for a = 0, 7 do
    local ang = a * math.pi / 4
    love.graphics.setColor(0.25, 0.10, 0.02, alpha)
    love.graphics.printf(text, x + math.cos(ang) * th, y + math.sin(ang) * th, w, "center")
  end
  love.graphics.setColor(color[1], color[2], color[3], alpha)
  love.graphics.printf(text, x, y, w, "center")
end

local function drawHeart(cx, cy, alpha)
  love.graphics.setColor(0.25, 0.05, 0.08, alpha)
  love.graphics.circle("fill", cx - 21, cy - 4, 29); love.graphics.circle("fill", cx + 21, cy - 4, 29)
  love.graphics.polygon("fill", cx - 49, cy + 4, cx + 49, cy + 4, cx, cy + 66)
  love.graphics.setColor(0.95, 0.22, 0.32, alpha)
  love.graphics.circle("fill", cx - 21, cy - 4, 25); love.graphics.circle("fill", cx + 21, cy - 4, 25)
  love.graphics.polygon("fill", cx - 45, cy + 4, cx + 45, cy + 4, cx, cy + 60)
  love.graphics.setColor(1, 1, 1, alpha * 0.7)
  love.graphics.circle("fill", cx - 30, cy - 14, 7)
end

local function drawBanner()
  if not banner then return end
  local t, dur = banner.t, banner.dur
  local fade = (t > dur - 0.8) and math.max(0, (dur - t) / 0.8) or 1

  if banner.kind == "life" then
    local cx, cy = 550, 370
    -- darken the board so the celebration stands out, with a gold flash at the start
    love.graphics.setColor(0, 0, 0, 0.45 * fade)
    love.graphics.rectangle("fill", 0, 0, VW, VH)
    if t < 0.4 then
      love.graphics.setColor(1, 0.85, 0.3, 0.55 * (1 - t / 0.4))
      love.graphics.rectangle("fill", 0, 0, VW, VH)
    end
    local s = easeOutBack(math.min(1, t / 0.45))

    -- two counter-rotating sunbursts
    for layer = 1, 2 do
      local half = (layer == 1) and 34 or 22
      love.graphics.push()
      love.graphics.translate(cx, cy)
      love.graphics.rotate(t * ((layer == 1) and 0.7 or -0.45))
      for i = 0, 15 do
        love.graphics.push()
        love.graphics.rotate(i * (2 * math.pi / 16))
        love.graphics.setColor(1, (layer == 1) and 0.85 or 0.6, 0.25,
          ((layer == 1) and 0.34 or 0.22) * fade * math.min(1, s))
        love.graphics.polygon("fill", 0, 0, 700, -half, 700, half)
        love.graphics.pop()
      end
      love.graphics.pop()
    end
    -- pulsing ring
    love.graphics.setLineWidth(6)
    love.graphics.setColor(1, 0.9, 0.4, 0.6 * fade)
    love.graphics.circle("line", cx, cy - 20, (150 + 22 * math.sin(t * 6)) * s)
    love.graphics.setLineWidth(1)

    -- heart and text pop in with overshoot, then pulse gently
    local pulse = 1 + 0.035 * math.sin(t * 9)
    love.graphics.push()
    love.graphics.translate(cx, cy)
    love.graphics.scale(s * pulse, s * pulse)
    love.graphics.translate(-cx, -cy)
    love.graphics.push()
    love.graphics.translate(cx, cy - 175)
    love.graphics.scale(1.7, 1.7)
    drawHeart(0, 0, fade)
    love.graphics.pop()
    love.graphics.setFont(fonts.giant)
    outlinedText("BONUS LIFE!", cx - 450, cy - 62, 900, C.tileSel, fade, 5)
    love.graphics.setFont(fonts.big)
    outlinedText("PERFECT WORD!   +1 LIFE", cx - 450, cy + 40, 900, { 1, 1, 1 }, fade, 3)
    love.graphics.setFont(fonts.mid)
    love.graphics.setColor(C.text[1], C.text[2], C.text[3], fade)
    love.graphics.printf("Lives saved for the final fight: " .. banner.a, cx - 450, cy + 92, 900, "center")
    love.graphics.pop()

    for _, p in ipairs(confetti) do
      love.graphics.push()
      love.graphics.translate(p.x, p.y)
      love.graphics.rotate(p.rot)
      love.graphics.setColor(p.c[1], p.c[2], p.c[3], fade)
      love.graphics.rectangle("fill", -p.w / 2, -p.h / 2, p.w, p.h)
      love.graphics.pop()
    end
  else   -- "close"
    local k = math.min(1, t / 0.3)
    local s = easeOutBack(k)
    local w, h = 520, 100
    love.graphics.push()
    love.graphics.translate(550, 262)
    love.graphics.rotate(math.sin(t * 14) * 0.03 * (1 - k))
    love.graphics.scale(s, s)
    love.graphics.setColor(0.10, 0.16, 0.28, 0.94 * fade)
    love.graphics.rectangle("fill", -w / 2, -h / 2, w, h, 16, 16)
    love.graphics.setColor(0.45, 0.75, 1.0, fade)
    love.graphics.setLineWidth(3)
    love.graphics.rectangle("line", -w / 2, -h / 2, w, h, 16, 16)
    love.graphics.setLineWidth(1)
    love.graphics.setFont(fonts.big)
    love.graphics.setColor(0.85, 0.94, 1.0, fade)
    love.graphics.printf("Nice try, you were close!", -w / 2, -h / 2 + 14, w, "center")
    love.graphics.setFont(fonts.sm)
    love.graphics.setColor(0.65, 0.80, 0.95, fade)
    love.graphics.printf(string.format("%d damage short of %s", banner.a, banner.b),
      -w / 2, -h / 2 + 62, w, "center")
    love.graphics.pop()
  end
end

local function drawGame()
  drawLeft()
  drawRight()
  drawEnemy()
  drawWordLine()
  drawGrid()

  for _, p in ipairs(popups) do
    love.graphics.setFont(fonts.big)
    love.graphics.setColor(p.color[1], p.color[2], p.color[3], math.min(1, p.t * 2))
    love.graphics.printf(p.text, p.x - 100, p.y, 200, "center")
  end

  if mode == "victory" then
    overlay(fight.enemy.name .. " defeated!",
      string.format("You recovered %d HP.\nLongest word: %s    Best-word hits: %d / %d\n\nPress Enter or click to continue",
        fight.healed or 0, fight.longest ~= "" and fight.longest or "-", fight.perfect, fight.plays),
      C.good)
  elseif mode == "defeat" then
    overlay("You were spelled to death",
      string.format("Best-word hits this run: %d / %d\n\nPress Enter or click to try again", totalPerfect, totalPlays),
      C.bad)
  elseif mode == "won" then
    overlay("The library is yours!",
      string.format("Best-word hits this run: %d / %d\n\nPress Enter or click to play again", totalPerfect, totalPlays),
      C.warn)
  end

  drawBanner()
end

function love.draw()
  love.graphics.push()
  love.graphics.translate(view.ox, view.oy)
  love.graphics.scale(view.s, view.s)
  drawGame()
  love.graphics.pop()
end
