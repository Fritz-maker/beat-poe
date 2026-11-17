// share.js : the "Share" button on the end-of-run screens.
// Builds a short, spoiler-free summary and hands it to the phone's share sheet,
// or copies it to the clipboard on a computer.

const NAMES = ['Twain', 'Dickinson', 'Shelley', 'Poe'];
const LINK = 'https://fritz-maker.github.io/beat-poe/';

// beaten: how many foes were beaten (4 = the whole run won); best/plays: best-word hits;
// longest: the longest word of the run; every: true when the "every word" dictionary setting was on.
export function shareText({ beaten, best, plays, longest, every }) {
  const track = NAMES.map((n, i) => (i < beaten ? '✅ ' : i === beaten ? '❌ ' : '⬜ ') + n).join('  ');
  const head = beaten >= NAMES.length ? 'I beat Poe! 🏆' : `${NAMES[beaten]} beat me.`;
  const lines = [`Beat Poe! — ${head}${every ? ' (every-word mode)' : ''}`, track,
    `⭐ Best words: ${best} of ${plays} plays`];
  if (longest) lines.push(`📖 Longest: ${longest} (${longest.length})`);
  lines.push(LINK);
  return lines.join('\n');
}

async function copy(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* fall through */ }
  const ta = document.createElement('textarea');            // older browsers
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}

// Returns 'shared', 'copied', 'cancelled' or 'failed'. The button shows "Copied!" for a moment.
export async function share(btn, text) {
  const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (navigator.share && touch) {
    try { await navigator.share({ text }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const ok = await copy(text);
  const label = btn.textContent;
  btn.textContent = ok ? 'Copied!' : 'Copy failed';
  btn.classList.toggle('done', ok);
  setTimeout(() => { btn.textContent = label; btn.classList.remove('done'); }, 2000);
  return ok ? 'copied' : 'failed';
}
