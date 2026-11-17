// stats.js : counts a few game moments with GoatCounter (no cookies, no personal data).
// The counting script itself is loaded in index.html. When it is missing (offline, an
// ad blocker, or testing on this computer) these calls quietly do nothing.
// Results: https://wardostudio.goatcounter.com

export function track(name) {
  try {
    const gc = window.goatcounter;
    if (gc && typeof gc.count === 'function') gc.count({ path: name, title: name, event: true });
  } catch (e) { /* never let counting break the game */ }
}
