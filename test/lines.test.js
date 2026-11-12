import { test } from 'node:test';
import assert from 'node:assert/strict';
import L from '../js/logic.js';
import { LINES, reactionKey, foeTurnKey } from '../js/lines.js';

const KEYS = ['intro', 'hit', 'weak', 'big', 'perfect', 'close', 'warn', 'curse', 'scramble', 'low', 'life', 'beaten', 'win'];

test('every foe has every line, short enough for the speech bubble', () => {
  for (const e of L.ENEMIES) {
    const set = LINES[e.id];
    assert.ok(set, `lines for ${e.id}`);
    assert.deepEqual(Object.keys(set).sort(), [...KEYS].sort());
    for (const k of KEYS) {
      for (const line of [].concat(set[k])) {
        assert.equal(typeof line, 'string');
        assert.ok(line.length > 0 && line.length <= 90, `${e.id}.${k} is ${line.length} characters`);
        if (k !== 'win') assert.ok(line.length <= 70, `${e.id}.${k} must fit the bubble (${line.length})`);
      }
    }
    assert.ok(set.hit.length >= 2, 'more than one hit line, since it is said most often');
  }
});

test('reaction to the word just played', () => {
  assert.equal(reactionKey('perfect', 3), 'perfect');
  assert.equal(reactionKey('close', 8), 'close');
  assert.equal(reactionKey('miss', 7), 'big');
  assert.equal(reactionKey('miss', 3), 'weak');
  assert.equal(reactionKey('miss', 5), null);
});

test('what the foe says on its own turn, in priority order', () => {
  const base = { lifeUsed: false, cursed: false, waveNext: false, low: false, held: false };
  assert.equal(foeTurnKey(base), 'hit');
  assert.equal(foeTurnKey({ ...base, waveNext: true }), 'warn');
  assert.equal(foeTurnKey({ ...base, held: true }), null);
  assert.equal(foeTurnKey({ ...base, held: true, waveNext: true }), null);
  assert.equal(foeTurnKey({ ...base, held: true, low: true }), 'low');
  assert.equal(foeTurnKey({ ...base, held: true, cursed: true, low: true }), 'curse');
  assert.equal(foeTurnKey({ ...base, lifeUsed: true, cursed: true }), 'life');
});
