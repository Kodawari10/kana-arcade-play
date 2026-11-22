// 🐢 Catch-up pace: when kana keep hitting the ground, the game eases off for a moment so you can catch your breath.
// Pure logic (no DOM). 2 ground misses in a row → kana fall 25% slower; 4 in a row → 40% slower. Each kana you zap
// after that brings the speed back a step; after STEPS zaps you're at full speed again. Wrong guesses don't count,
// only kana that reach the ground. Nothing is saved.
(function (root) {
  var STEPS = 6, SLOW = 0.75, SLOWER = 0.6;
  function start() { return { missRun: 0, left: 0, min: 1, factor: 1, helps: 0 }; }
  function refresh(P) { P.factor = P.left > 0 ? 1 - (1 - P.min) * (P.left / STEPS) : 1; if (P.left <= 0) P.min = 1; return P.factor; }
  // a kana hit the ground: returns "slow" / "slower" when the pace just eased off, else null
  function miss(P) {
    P.missRun++;
    if (P.missRun >= 4 && P.min > SLOWER) { P.min = SLOWER; P.left = STEPS; refresh(P); return "slower"; }
    if (P.missRun >= 2 && P.left === 0) { P.min = SLOW; P.left = STEPS; P.helps++; refresh(P); return "slow"; }
    if (P.left > 0) { P.left = STEPS; refresh(P); } // still struggling: stay eased
    return null;
  }
  // a kana was zapped: returns "back" when the pace just returned to normal
  function hit(P) {
    P.missRun = 0;
    if (P.left <= 0) return null;
    P.left--; refresh(P);
    return P.left === 0 ? "back" : null;
  }
  function active(P) { return !!P && P.left > 0; }
  var API = { STEPS: STEPS, SLOW: SLOW, SLOWER: SLOWER, start: start, miss: miss, hit: hit, active: active };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.KA_PACE = API;
})(this);
