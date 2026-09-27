// scoring.js
// Heuristic scoring engine. Turns self-reported "effect tags" (the kind found
// in public strain databases) into three simple scales:
//   1. mentalEnergy   0 (calming)  -> 10 (energizing)
//   2. adhd           label: Focus | Hyperfocus | Calm Relaxation | Sedation
//   3. panicMeter      0 (low reported anxiety risk) -> 10 (high)
//
// IMPORTANT: this is a transparent, tag-weighted heuristic, not a clinical or
// lab-verified measurement. Effects for a given strain NAME vary a lot by
// grower, batch, and the person using it. Treat scores as a rough, editable
// starting point -- the weights below are the whole "model" and are meant to
// be tuned by whoever runs this.

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round1 = (n) => Math.round(n * 10) / 10;

function computeScores(effects = []) {
  const set = new Set(effects.map((e) => e.toLowerCase()));
  const has = (tag) => (set.has(tag.toLowerCase()) ? 1 : 0);

  // ---- 1. Mental energy: calming <-> energizing ----
  let energy =
    5 +
    has('Energetic') * 2.2 +
    has('Uplifted') * 1.2 +
    has('Focused') * 0.8 +
    has('Creative') * 1.0 +
    has('Talkative') * 0.8 +
    has('Giggly') * 0.5 -
    has('Relaxed') * 1.8 -
    has('Sleepy') * 2.2 -
    has('Sedated') * 2.5 -
    has('Calm') * 1.0;
  const mentalEnergy = round1(clamp(energy, 0, 10));

  // ---- 2. ADHD-oriented scale (pick the best-fitting label) ----
  const candidates = {
    Focus:
      has('Focused') * 2 + has('Creative') * 1 + has('Energetic') * 0.5 -
      has('Relaxed') * 1 - has('Sleepy') * 1.5,
    Hyperfocus:
      has('Focused') * 1.5 + has('Energetic') * 1.5 + has('Euphoric') * 1 +
      has('Creative') * 1 - has('Sleepy') * 1.5,
    'Calm Relaxation':
      has('Relaxed') * 2 + has('Happy') * 0.5 - has('Sleepy') * 0.5 -
      has('Energetic') * 1,
    Sedation:
      has('Sleepy') * 2.5 + has('Sedated') * 2.5 + has('Relaxed') * 0.5 -
      has('Energetic') * 1.5 - has('Focused') * 1,
  };
  let bestLabel = 'Calm Relaxation';
  let bestScore = -Infinity;
  for (const [label, score] of Object.entries(candidates)) {
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }

  // ---- 3. Panic meter ----
  let panic =
    1 +
    has('Anxious') * 4 +
    has('Paranoid') * 4 +
    (has('Energetic') && has('Euphoric') ? 1.5 : 0) +
    has('Energetic') * 0.5 -
    has('Relaxed') * 1.5 -
    has('Calm') * 1.5 -
    has('Sleepy') * 1;
  const panicMeter = round1(clamp(panic, 0, 10));

  return {
    mentalEnergy, // 0 = calming, 10 = energizing
    adhd: {
      label: bestLabel,
      scores: Object.fromEntries(
        Object.entries(candidates).map(([k, v]) => [k, round1(v)])
      ),
    },
    panicMeter, // 0 = low reported anxiety risk, 10 = high
  };
}

module.exports = { computeScores };
