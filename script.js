// ── Math utilities ────────────────────────────────────────────────

/**
 * Error function approximation (Abramowitz & Stegun 7.1.26).
 * Maximum error: 1.5 × 10^-7.
 */
function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592
    + t * (-0.284496736
    + t * (1.421413741
    + t * (-1.453152027
    + t * 1.061405429))));
  return sign * (1 - poly * Math.exp(-x * x));
}

/** Standard normal CDF: Φ(z) */
function normalCDF(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Gaussian PDF value at x, used only for rendering the bell curve. */
function gaussianPDF(x, mean, stddev) {
  const exp = -0.5 * ((x - mean) / stddev) ** 2;
  return Math.exp(exp) / (stddev * Math.SQRT2 * Math.sqrt(Math.PI));
}

/**
 * Compute z-score and percentile.
 * Throws if stddev <= 0.
 */
function computePercentile(score, center, stddev) {
  if (stddev <= 0) throw new RangeError('stddev must be positive');
  const z = (score - center) / stddev;
  const percentile = normalCDF(z) * 100;
  return { z, percentile };
}

/** Turn an integer into an ordinal string: 1 → "1st", 87 → "87th", etc. */
function ordinalSuffix(n) {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  const mod10  = abs % 10;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

/** Human-readable interpretation of a percentile. */
function interpret(percentile) {
  if (percentile >= 99) return 'Outstanding — top 1% of test-takers.';
  if (percentile >= 95) return 'Excellent — top 5% of test-takers.';
  if (percentile >= 90) return 'Great — top 10% of test-takers.';
  if (percentile >= 75) return 'Above average performance.';
  if (percentile >= 50) return 'Above the midpoint of the distribution.';
  if (percentile >= 25) return 'Below average — room to improve.';
  if (percentile >= 10) return 'Bottom quartile of test-takers.';
  return 'Bottom 10% — significant improvement needed.';
}

// ── DOM references ────────────────────────────────────────────────

const els = {
  form:            document.getElementById('calc-form'),
  scoreInput:      document.getElementById('score'),
  centerInput:     document.getElementById('center'),
  centerLabel:     document.getElementById('center-label'),
  stddevInput:     document.getElementById('stddev'),
  toggleMean:      document.getElementById('toggle-mean'),
  toggleMedian:    document.getElementById('toggle-median'),
  resultCard:      document.getElementById('result'),
  percentileValue: document.getElementById('percentile-value'),
  zScoreDisplay:   document.getElementById('z-score-display'),
  interpretation:  document.getElementById('interpretation'),
  chartContainer:  document.getElementById('chart-container'),
  bellSvg:         document.getElementById('bell-curve'),
  scoreError:      document.getElementById('score-error'),
  centerError:     document.getElementById('center-error'),
  stddevError:     document.getElementById('stddev-error'),
};

// ── App state ─────────────────────────────────────────────────────

const state = { mode: 'mean' };

// ── Validation ────────────────────────────────────────────────────

function parseField(value) {
  if (value.trim() === '') return { ok: false, msg: 'This field is required.' };
  const n = Number(value);
  if (!isFinite(n)) return { ok: false, msg: 'Please enter a valid number.' };
  return { ok: true, value: n };
}

function validateInputs() {
  const score  = parseField(els.scoreInput.value);
  const center = parseField(els.centerInput.value);
  const stddev = parseField(els.stddevInput.value);

  if (stddev.ok && stddev.value <= 0) {
    stddev.ok  = false;
    stddev.msg = 'Must be greater than zero.';
  }

  return { score, center, stddev };
}

function applyErrors({ score, center, stddev }) {
  setFieldError(els.scoreInput,  els.scoreError,  score);
  setFieldError(els.centerInput, els.centerError, center);
  setFieldError(els.stddevInput, els.stddevError, stddev);
}

function setFieldError(input, errorEl, result) {
  if (result.ok) {
    input.classList.remove('invalid');
    errorEl.textContent = '';
  } else {
    input.classList.add('invalid');
    errorEl.textContent = result.msg;
  }
}

function clearErrors() {
  [els.scoreInput, els.centerInput, els.stddevInput].forEach(i => i.classList.remove('invalid'));
  [els.scoreError, els.centerError, els.stddevError].forEach(e => e.textContent = '');
}

// ── Result rendering ──────────────────────────────────────────────

function renderResult(percentile, z) {
  let label;
  if (percentile > 99.9) {
    label = '> 99.9th';
  } else if (percentile < 0.1) {
    label = '< 0.1st';
  } else {
    label = ordinalSuffix(Math.round(percentile));
  }

  els.percentileValue.classList.remove('pop-animate');
  void els.percentileValue.offsetWidth;
  els.percentileValue.textContent = label;
  els.percentileValue.classList.add('pop-animate');

  els.zScoreDisplay.textContent = `Z-score: ${z.toFixed(4)}`;
  els.interpretation.textContent = interpret(percentile);

  showCard(els.resultCard);
}

function showCard(card) {
  card.classList.remove('hidden');
  requestAnimationFrame(() => card.classList.add('visible'));
}

// ── Bell curve SVG ────────────────────────────────────────────────

const SVG_NS  = 'http://www.w3.org/2000/svg';
const W       = 500;
const H       = 210;
const PAD_L   = 30;
const PAD_R   = 20;
const PAD_TOP = 20;
const PAD_BOT = 36;
const PLOT_W  = W - PAD_L - PAD_R;
const PLOT_H  = H - PAD_TOP - PAD_BOT;
const SAMPLES = 300;

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function renderBellCurve(mean, stddev, userScore) {
  const svg = els.bellSvg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const xMin = mean - 4 * stddev;
  const xMax = mean + 4 * stddev;
  const peakPDF = gaussianPDF(mean, mean, stddev);

  function xToSVG(x) {
    return PAD_L + ((x - xMin) / (xMax - xMin)) * PLOT_W;
  }
  function yToSVG(y) {
    return PAD_TOP + PLOT_H - (y / peakPDF) * PLOT_H;
  }

  const baseline = PAD_TOP + PLOT_H;

  const points = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = xMin + (i / SAMPLES) * (xMax - xMin);
    points.push({ x, y: gaussianPDF(x, mean, stddev) });
  }

  const clampedScore = Math.max(xMin, Math.min(xMax, userScore));
  const scoreX = xToSVG(clampedScore);

  // Shaded area left of user score
  const shadePoints = points.filter(p => p.x <= clampedScore);
  let shadePath = `M ${xToSVG(xMin)},${baseline}`;
  for (const p of shadePoints) {
    shadePath += ` L ${xToSVG(p.x).toFixed(2)},${yToSVG(p.y).toFixed(2)}`;
  }
  shadePath += ` L ${scoreX.toFixed(2)},${baseline} Z`;

  svg.appendChild(svgEl('path', {
    d: shadePath,
    fill: 'var(--accent)',
    'fill-opacity': '0.18',
  }));

  // Curve
  const curvePoints = points.map(p => `${xToSVG(p.x).toFixed(2)},${yToSVG(p.y).toFixed(2)}`).join(' ');
  svg.appendChild(svgEl('polyline', {
    points: curvePoints,
    fill: 'none',
    stroke: 'var(--accent)',
    'stroke-width': '2.5',
    'stroke-linejoin': 'round',
  }));

  // Baseline
  svg.appendChild(svgEl('line', {
    x1: PAD_L, y1: baseline, x2: W - PAD_R, y2: baseline,
    stroke: 'var(--border)',
    'stroke-width': '1.5',
  }));

  // Sigma tick marks
  const ticks = [-2, -1, 0, 1, 2];
  const tickLabels = { '-2': 'μ−2σ', '-1': 'μ−σ', 0: 'μ', 1: 'μ+σ', 2: 'μ+2σ' };
  for (const t of ticks) {
    const tx = xToSVG(mean + t * stddev);
    svg.appendChild(svgEl('line', {
      x1: tx, y1: baseline, x2: tx, y2: baseline + 5,
      stroke: 'var(--text-secondary)',
      'stroke-width': '1',
    }));
    const label = svgEl('text', {
      x: tx, y: baseline + 16,
      'text-anchor': 'middle',
      'font-size': '10',
      fill: 'var(--text-secondary)',
      'font-family': 'system-ui, sans-serif',
    });
    label.textContent = tickLabels[t];
    svg.appendChild(label);
  }

  // Vertical line at score
  const lineTopY = yToSVG(gaussianPDF(clampedScore, mean, stddev));
  svg.appendChild(svgEl('line', {
    x1: scoreX, y1: lineTopY, x2: scoreX, y2: baseline,
    stroke: 'var(--accent-dark)',
    'stroke-width': '2',
    'stroke-dasharray': '4 3',
  }));

  // Score label
  const labelY = Math.max(lineTopY - 8, PAD_TOP + 10);
  const scoreLabel = svgEl('text', {
    x: scoreX,
    y: labelY,
    'text-anchor': 'middle',
    'font-size': '11',
    'font-weight': '700',
    fill: 'var(--accent-dark)',
    'font-family': 'system-ui, sans-serif',
  });
  scoreLabel.textContent = userScore;
  svg.appendChild(scoreLabel);

  showCard(els.chartContainer);
}

// ── Toggle handler ────────────────────────────────────────────────

function setMode(newMode) {
  state.mode = newMode;
  els.toggleMean.setAttribute('aria-pressed',   String(newMode === 'mean'));
  els.toggleMedian.setAttribute('aria-pressed', String(newMode === 'median'));
  els.centerLabel.textContent = newMode === 'mean' ? 'Mean' : 'Median';
  els.centerInput.placeholder = newMode === 'mean' ? 'e.g. 70' : 'e.g. 72';

  if (els.resultCard.classList.contains('visible')) {
    const v = validateInputs();
    if (v.score.ok && v.center.ok && v.stddev.ok) {
      runCalculation(v.score.value, v.center.value, v.stddev.value);
    }
  }
}

// ── Core calculation ──────────────────────────────────────────────

function runCalculation(score, center, stddev) {
  const { z, percentile } = computePercentile(score, center, stddev);
  renderResult(percentile, z);
  renderBellCurve(center, stddev, score);
}

// ── Event listeners ───────────────────────────────────────────────

els.toggleMean.addEventListener('click', () => setMode('mean'));
els.toggleMedian.addEventListener('click', () => setMode('median'));

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = validateInputs();
  applyErrors(v);
  if (!v.score.ok || !v.center.ok || !v.stddev.ok) return;
  clearErrors();
  runCalculation(v.score.value, v.center.value, v.stddev.value);
});

[els.scoreInput, els.centerInput, els.stddevInput].forEach(input => {
  input.addEventListener('input', () => {
    input.classList.remove('invalid');
    const errorEl = document.getElementById(`${input.id}-error`);
    if (errorEl) errorEl.textContent = '';
  });
});
