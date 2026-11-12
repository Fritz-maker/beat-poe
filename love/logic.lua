-- logic.lua : pure game rules. No love.* calls in here, so it can be tested in plain Lua.
local L = {}

---------------------------------------------------------------------------
-- Tuning knobs (change these to rebalance the game)
---------------------------------------------------------------------------
L.GRID = 16               -- number of tiles (shown as 4x4)
L.MIN_VOWELS = 5          -- fresh grids always have at least this many vowels
L.PLAYER_MAX_HP = 80
L.HEAL_BETWEEN = 0.40     -- fraction of max HP restored after each victory
L.QU_CHANCE = 0.5         -- chance that a Q tile appears as a "Qu" tile
L.QU_VALUE = 3            -- value of a Qu tile (a plain Q is worth 4)
L.CLOSE_FRAC = 0.70      -- a play worth at least this fraction of the best word shows "nice try, you were close"
L.REVIVE_FRAC = 0.50     -- HP (as a fraction of max) you come back with when a bonus life is used
L.MIN_WORD = 3
L.LENGTH_CURVE = 0.35     -- bigger = long words are rewarded more

-- Letter values: rarer letters hit harder.
local VAL = {}
local function setvals(letters, v) for c in letters:gmatch(".") do VAL[c] = v end end
setvals("EAIONRTLSUDG", 1)
setvals("BCFHMP", 1.5)
setvals("VWYK", 2)
setvals("JX", 3)
setvals("QZ", 4)
L.VALUES = VAL

-- How often each letter shows up in a normal grid (Scrabble-style distribution)
local NORMAL_FREQ = {
  A=9, B=2, C=2, D=4, E=12, F=2, G=3, H=2, I=9, J=1, K=1, L=4, M=2,
  N=6, O=8, P=2, Q=1, R=6, S=4, T=6, U=4, V=2, W=2, X=1, Y=2, Z=1,
}
-- Letters a curse wave can drop onto the grid
local CURSE_FREQ = { Q=2, Z=2, X=2, J=2, V=3, K=3, W=3 }

local VOWELS = { A=true, E=true, I=true, O=true, U=true }

-- Foes. dmgMin/dmgMax = damage per enemy turn. A curse wave hits every
-- `waveEvery` enemy turns and swaps `waveSize` tiles for hard letters.
L.ENEMIES = {
  { name = "Gutter Gnome",          hp = 70,  dmgMin = 4,  dmgMax = 7,  waveEvery = 4, waveSize = 2 },
  { name = "Mildew Wraith",         hp = 120, dmgMin = 6,  dmgMax = 9,  waveEvery = 3, waveSize = 3 },
  { name = "Ink-Blot Troll",        hp = 190, dmgMin = 8,  dmgMax = 12, waveEvery = 3, waveSize = 4 },
  { name = "The Dictionary Dragon", hp = 300, dmgMin = 10, dmgMax = 15, waveEvery = 2, waveSize = 5 },
}

---------------------------------------------------------------------------
-- Random helpers. `rand(n)` must return an integer in 1..n.
---------------------------------------------------------------------------
local function defaultRand(n) return math.random(n) end

local function makeBag(t)
  local keys = {}
  for k in pairs(t) do keys[#keys + 1] = k end
  table.sort(keys)
  local bag = { total = 0 }
  for _, k in ipairs(keys) do
    bag[#bag + 1] = { k, t[k] }
    bag.total = bag.total + t[k]
  end
  return bag
end

local NORMAL_BAG = makeBag(NORMAL_FREQ)
local CURSE_BAG = makeBag(CURSE_FREQ)

local function draw(bag, rand)
  local r = rand(bag.total)
  for _, e in ipairs(bag) do
    r = r - e[2]
    if r <= 0 then return e[1] end
  end
  return bag[#bag][1]
end

local function countVowels(grid)
  local n = 0
  for _, t in ipairs(grid) do if VOWELS[t.ch] then n = n + 1 end end
  return n
end

-- Tiles are { ch = "A".."Z", cursed = bool, qu = bool }. A "Qu" tile has ch = "Q"
-- and qu = true: it spells the two letters QU but is worth less than a plain Q.
local function newTile(bag, rand, cursed)
  local ch = draw(bag, rand)
  return { ch = ch, cursed = cursed or false,
           qu = (ch == "Q") and (rand(100) <= L.QU_CHANCE * 100) }
end
function L.tileText(t) return t.qu and "QU" or t.ch end    -- what it adds to the word
function L.tileLabel(t) return t.qu and "Qu" or t.ch end   -- what is drawn on the tile
function L.tileValue(t) return t.qu and L.QU_VALUE or VAL[t.ch] end

---------------------------------------------------------------------------
-- Word list
---------------------------------------------------------------------------
L.wordSet = {}
L.wordArr = {}

-- `iter` yields one word per call (e.g. io.lines / love.filesystem.lines).
function L.loadWords(iter)
  local set, arr = {}, {}
  for line in iter do
    local w = line:upper()
    w = w:gsub("%s", "")
    if #w >= L.MIN_WORD and #w <= L.GRID and w:match("^%u+$") then
      set[w] = true
      arr[#arr + 1] = w
    end
  end
  L.wordSet, L.wordArr = set, arr
  return #arr
end

function L.isWord(w) return L.wordSet[w] == true end

-- Optional "common words" subset, used only for the best-word check.
-- Any valid word can still be played; this just keeps SELAMLIK-style
-- obscurities out of the "best word available" panel.
L.commonArr = {}
L.commonOnly = false

function L.loadCommon(iter)
  local arr = {}
  for line in iter do
    local w = line:upper()
    w = w:gsub("%s", "")
    if L.wordSet[w] then arr[#arr + 1] = w end
  end
  L.commonArr = arr
  return #arr
end

---------------------------------------------------------------------------
-- Scoring
---------------------------------------------------------------------------
function L.lengthMult(n)
  if n <= L.MIN_WORD then return 1 end
  return 1 + L.LENGTH_CURVE * (n - L.MIN_WORD) ^ 1.5
end

function L.rawValue(word)
  local s = 0
  for i = 1, #word do s = s + VAL[word:sub(i, i)] end
  return s
end

-- quTiles = how many of the word's "QU" pairs came from single Qu tiles
-- (each one is worth QU_VALUE instead of Q + U).
function L.damage(word, quTiles)
  local raw = L.rawValue(word)
  if quTiles and quTiles > 0 then
    raw = raw - quTiles * (VAL.Q + VAL.U - L.QU_VALUE)
  end
  return math.floor(raw * L.lengthMult(#word) + 0.5)
end

-- Words containing Q: a "QU" pair can come from one Qu tile, or from a plain Q
-- tile plus a U tile (worth more). Use as few Qu tiles as the grid allows.
-- (Q is letter 17 and U is letter 21 when A = 1.)
local function qWordDamage(w, cnt, nQu)
  local need = {}
  for i = 1, #w do
    local b = w:byte(i) - 64
    need[b] = (need[b] or 0) + 1
  end
  local _, pairsInWord = w:gsub("QU", "")
  local j = math.max(0, need[17] - cnt[17], (need[21] or 0) - cnt[21])
  if j > pairsInWord or j > nQu then return nil end
  for b, n in pairs(need) do
    if b ~= 17 and b ~= 21 and cnt[b] < n then return nil end
  end
  return L.damage(w, j)
end

-- Search the dictionary for the highest-damage word the grid can spell.
function L.bestWord(grid)
  local cnt = {}
  for i = 1, 26 do cnt[i] = 0 end
  local nQu = 0
  for _, t in ipairs(grid) do
    if t.qu then
      nQu = nQu + 1
    else
      local b = t.ch:byte() - 64
      cnt[b] = cnt[b] + 1
    end
  end
  local best, bestD = nil, -1
  local arr = L.wordArr
  if L.commonOnly and #L.commonArr > 0 then arr = L.commonArr end
  for k = 1, #arr do
    local w = arr[k]
    local d
    if w:find("Q", 1, true) then
      d = qWordDamage(w, cnt, nQu)
    else
      local n = #w
      local used = 0
      local ok = true
      for i = 1, n do
        local b = w:byte(i) - 64
        if cnt[b] == 0 then ok = false; break end
        cnt[b] = cnt[b] - 1
        used = i
      end
      for i = 1, used do
        local b = w:byte(i) - 64
        cnt[b] = cnt[b] + 1
      end
      if ok then d = L.damage(w) end
    end
    if d and d > bestD then best, bestD = w, d end
  end
  return best, bestD
end

---------------------------------------------------------------------------
-- Grid and fights
---------------------------------------------------------------------------
function L.newGrid(rand)
  rand = rand or defaultRand
  local grid
  repeat
    grid = {}
    for i = 1, L.GRID do grid[i] = newTile(NORMAL_BAG, rand, false) end
  until countVowels(grid) >= L.MIN_VOWELS
  return grid
end

function L.newFight(idx, rand)
  local e = L.ENEMIES[idx]
  return {
    idx = idx, enemy = e, hp = e.hp,
    grid = L.newGrid(rand), waveIn = e.waveEvery, turn = 0,
  }
end

function L.wordFromSel(grid, sel)
  local t = {}
  for i, idx in ipairs(sel) do t[i] = L.tileText(grid[idx]) end
  return table.concat(t)
end

-- The word spelled by the selected tiles, and the damage it would do.
function L.selDamage(grid, sel)
  local nQu = 0
  for _, idx in ipairs(sel) do
    if grid[idx].qu then nQu = nQu + 1 end
  end
  local word = L.wordFromSel(grid, sel)
  return word, L.damage(word, nQu)
end

-- Play the tiles in `sel` (array of grid indices). Returns a result table, or
-- nil plus a reason if the play is not allowed (the turn is NOT used up then).
function L.playWord(fight, sel, rand)
  rand = rand or defaultRand
  if #sel < L.MIN_WORD then return nil, "Words need at least " .. L.MIN_WORD .. " letters." end
  local seen = {}
  for _, idx in ipairs(sel) do
    if seen[idx] then return nil, "A tile can only be used once." end
    seen[idx] = true
  end
  local word = L.wordFromSel(fight.grid, sel)
  if not L.isWord(word) then return nil, word .. " is not in the word list." end

  local _, dmg = L.selDamage(fight.grid, sel)
  local bestWord, bestDmg = L.bestWord(fight.grid)   -- computed BEFORE tiles refresh

  for _, idx in ipairs(sel) do
    fight.grid[idx] = newTile(NORMAL_BAG, rand, false)
  end
  -- keep the refreshed grid playable
  if countVowels(fight.grid) < L.MIN_VOWELS - 1 then
    for i = 1, #fight.grid do
      if not fight.grid[i].cursed and not VOWELS[fight.grid[i].ch] then
        local vs = { "A", "E", "I", "O" }
        fight.grid[i].ch = vs[rand(#vs)]
        fight.grid[i].qu = false
        break
      end
    end
  end
  fight.hp = fight.hp - dmg
  fight.turn = fight.turn + 1
  return { word = word, dmg = dmg, bestWord = bestWord, bestDmg = bestDmg, used = sel }
end

-- Throw the whole grid away (also clears curses). Costs the turn.
function L.scramble(fight, rand)
  fight.grid = L.newGrid(rand)
  fight.turn = fight.turn + 1
end

-- Swap some tiles for hard letters. Returns the list of changed tile indices.
function L.curseWave(fight, rand)
  rand = rand or defaultRand
  local grid = fight.grid
  local idx = {}
  for i = 1, #grid do idx[i] = i end
  for i = #idx, 2, -1 do
    local j = rand(i)
    idx[i], idx[j] = idx[j], idx[i]
  end
  local vowels = countVowels(grid)
  local replaced = {}
  for _, i in ipairs(idx) do
    if #replaced >= fight.enemy.waveSize then break end
    local t = grid[i]
    if not t.cursed then
      local isV = VOWELS[t.ch]
      if (not isV) or vowels > L.MIN_VOWELS - 1 then
        if isV then vowels = vowels - 1 end
        grid[i] = newTile(CURSE_BAG, rand, true)
        replaced[#replaced + 1] = i
      end
    end
  end
  return replaced
end

-- The enemy's turn. Returns damage dealt to the player and, if a curse wave
-- fired, the list of tiles it changed.
function L.enemyAct(fight, rand)
  rand = rand or defaultRand
  local e = fight.enemy
  local dmg = e.dmgMin + rand(e.dmgMax - e.dmgMin + 1) - 1
  fight.waveIn = fight.waveIn - 1
  local replaced = nil
  if fight.waveIn <= 0 then
    replaced = L.curseWave(fight, rand)
    fight.waveIn = e.waveEvery
  end
  return dmg, replaced
end

return L
