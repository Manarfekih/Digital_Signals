// dashboard.js — Digital Signals

const SAMPLES = {
  low:      `Today was actually a pretty good day. I had lunch with my friends and we laughed a lot. I finished my homework early and had time to play football. I feel okay about the upcoming exam. My family had dinner together and it felt nice.`,
  moderate: `Lately I have been feeling a bit off. I find it hard to concentrate in class and keep forgetting things. Some days I feel fine but other days everything feels heavy. I still go to school and talk to friends but something feels different. I am not sure how to explain it.`,
  high:     `I don't see the point of anything anymore. I feel completely alone even surrounded by people. I can't sleep and when I do I have bad dreams. I don't want to go to school or talk to anyone. Everything feels hopeless and I don't know how much longer I can keep going.`
};

const GUIDANCE = {
  low_risk:      `<strong>🟢 Low Risk</strong><br/><br/>No significant distress signals detected. Maintain regular check-ins and encourage the student to keep expressing themselves. Positive engagement and emotional literacy activities are appropriate.`,
  moderate_risk: `<strong>🟡 Moderate Risk</strong><br/><br/>Some signs of emotional difficulty are present. Schedule a private conversation within the next few days. Explore stressors, sleep quality, and social connections. Connect the student with available support resources.`,
  high_risk:     `<strong>🔴 High Risk — Immediate Action Recommended</strong><br/><br/>The text contains language strongly associated with distress or hopelessness. <strong>Do not delay.</strong> Involve the school counselor or psychologist immediately, following your school's crisis protocol.`
};

let donutInstance = null;

function loadDashSample(level) {
  document.getElementById('dashInput').value = SAMPLES[level];
}

// ── Main run ──────────────────────────────────────────────────────────────────
async function runDashboard() {
  const text = document.getElementById('dashInput').value.trim();
  if (text.length < 10) { alert('Please enter at least 10 characters.'); return; }

  setDashLoading(true);
  document.getElementById('dashContent').classList.add('hidden');
  document.getElementById('dashEmpty').classList.add('hidden');

  let data = null;
  try {
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const raw = await res.text();
    try { data = JSON.parse(raw); } catch { /* fall through */ }

    if (!res.ok) {
      const msg = (data && data.error) ? data.error : `Server error (${res.status}).`;
      alert(msg); return;
    }
    if (!data || data.error) { alert((data && data.error) || 'Unexpected response.'); return; }
  } catch (e) {
    alert('Connection error. Please try again.'); return;
  } finally {
    setDashLoading(false);
  }

  try { renderDashboard(data, text); }
  catch (e) { console.error('Render error:', e); alert('Display error — please refresh.'); }
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderDashboard(data, rawText) {
  document.getElementById('dashEmoji').textContent = data.emoji;
  document.getElementById('dashLevel').textContent = data.label_text;
  document.getElementById('dashLevel').style.color = data.color;

  const probs = data.probabilities;
  const lowP  = (probs.low_risk      || 0) * 100;
  const modP  = (probs.moderate_risk || 0) * 100;
  const highP = (probs.high_risk     || 0) * 100;
  renderDonut(lowP, modP, highP, data.label, data.color);
  document.getElementById('legendLow').textContent  = lowP.toFixed(1)  + '%';
  document.getElementById('legendMod').textContent  = modP.toFixed(1)  + '%';
  document.getElementById('legendHigh').textContent = highP.toFixed(1) + '%';

  const words   = rawText.trim().split(/\s+/).filter(Boolean);
  const unique  = new Set(words.map(w => w.toLowerCase())).size;
  const impacts = data.word_impacts || [];
  document.getElementById('wordCount').textContent   = words.length;
  document.getElementById('uniqueWords').textContent = unique;

  const impactfulEl = document.getElementById('impactfulCount');
  if (impactfulEl) impactfulEl.textContent = impacts.length;

  const predProb    = typeof data.predicted_probability === 'number'
                      ? data.predicted_probability
                      : (probs[data.label] || 0) * 100;
  const predProbTxt = predProb.toFixed(1) + '%';

  const predProbEl  = document.getElementById('predProb');
  if (predProbEl)  predProbEl.textContent = predProbTxt;
  const predProbDEl = document.getElementById('predProbDisplay');
  if (predProbDEl) predProbDEl.textContent = predProbTxt;
  const predLblEl   = document.getElementById('predLabelDisplay');
  if (predLblEl)   predLblEl.textContent = data.label_text || data.label;
  const tgtEl       = document.getElementById('impactTarget');
  if (tgtEl)       tgtEl.textContent = (data.label_text || data.label).toLowerCase();

  renderWordBars(impacts, data.label);
  
  document.getElementById('dashGuidance').innerHTML = GUIDANCE[data.label] || '';
  document.getElementById('dashContent').classList.remove('hidden');
  document.getElementById('dashEmpty').classList.add('hidden');
  document.getElementById('dashContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Donut ─────────────────────────────────────────────────────────────────────
function renderDonut(low, mod, high, label, color) {
  const canvas = document.getElementById('donutChart');
  const ctx = canvas.getContext('2d');
  const cx = 100, cy = 100, R = 75, r = 52;
  const segments = [
    { value: low,  color: '#22c55e' },
    { value: mod,  color: '#f59e0b' },
    { value: high, color: '#ef4444' },
  ];
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let a = -Math.PI / 2;
  ctx.clearRect(0, 0, 200, 200);
  segments.forEach(seg => {
    const angle = (seg.value / total) * 2 * Math.PI;
    if (angle < 0.001) return;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a, a + angle); ctx.closePath();
    ctx.fillStyle = seg.color; ctx.fill();
    a += angle;
  });
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  const lm = { low_risk: 'Low', moderate_risk: 'Mod', high_risk: 'High' };
  const vm = { low_risk: low,  moderate_risk: mod,   high_risk: high  };
  document.getElementById('donutPct').textContent = (vm[label] || 0).toFixed(1) + '%';
  document.getElementById('donutCls').textContent = lm[label] || '';
  document.getElementById('donutPct').style.color = color;
}

// ── Word bars ─────────────────────────────────────────────────────────────────
function renderWordBars(impacts, label) {
  const container = document.getElementById('shapBars');
  container.innerHTML = '';
  if (!impacts.length) {
    container.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">No standout words detected.</p>';
    return;
  }
  document.getElementById('shapTitle').textContent =
    `Top words influencing "${label.replace(/_/g,' ')}" prediction`;
  const maxStr = Math.max(...impacts.map(c => c.strength), 0.001);

  impacts.forEach(c => {
    const isPos    = c.impact > 0;
    const widthPct = Math.min((c.strength / maxStr) * 46, 46);
    const row      = document.createElement('div');
    row.className  = 'shap-row';

    const wordEl   = document.createElement('div');
    wordEl.className  = 'shap-word';
    wordEl.textContent = c.word;                         // show surface form
    wordEl.title   = `Feature: "${c.lemma}" · SHAP: ${c.impact > 0 ? '+' : ''}${c.impact.toFixed(4)}`;

    const barWrap  = document.createElement('div');
    barWrap.className = 'shap-bar-wrap';
    const center   = document.createElement('div');
    center.className  = 'shap-bar-center';
    barWrap.appendChild(center);
    const fill     = document.createElement('div');
    fill.className = `shap-bar-fill ${isPos ? 'shap-bar-pos' : 'shap-bar-neg'}`;
    fill.style.width = '0%';
    barWrap.appendChild(fill);

    const valEl    = document.createElement('div');
    valEl.className   = `shap-val ${isPos ? 'positive' : 'negative'}`;
    valEl.textContent = (isPos ? '+' : '') + c.strength.toFixed(3);

    row.appendChild(wordEl); row.appendChild(barWrap); row.appendChild(valEl);
    container.appendChild(row);
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = widthPct + '%'; }));
  });
}

// ── Highlighted text — THE DEFINITIVE FIX ────────────────────────────────────
function renderHighlightedText(rawText, impacts, label) {
  // Deprecated: highlighted text view removed from dashboard.html.
  return;
}

// Impact diagram removed from dashboard per request.

/*
  /*
   * Build ONE flat lookup: every raw surface form (lowercase) → impact entry.
   *
   * The backend sends `surfaces`: the complete list of raw tokens from the
   * original text that map to this TF-IDF feature (e.g. ['dreams','dream']).
   * We register every surface so the JS never has to guess morphology.
   *
   * We also register the lemma and a few mechanical suffixes as extra safety.
    * /
  const lookup = new Map();  // lowercase token → impact item

  impacts.forEach(item => {
    // Register all surfaces the backend explicitly found
    const surfaces = Array.isArray(item.surfaces) ? item.surfaces : [item.word, item.lemma];
    surfaces.forEach(s => lookup.set(s.toLowerCase(), item));

    // Register the lemma itself
    lookup.set(item.lemma.toLowerCase(), item);

    // Register the displayed word
    lookup.set(item.word.toLowerCase(), item);

    // Safety: a few common suffix variants the lemmatizer catches
    const base = item.lemma.toLowerCase();
    for (const variant of [base + 's', base + 'es', base + 'ed', base + 'ing',
                            base + 'er', base + 'ly', base + 'd']) {
      if (!lookup.has(variant)) lookup.set(variant, item);
    }
  });

  const maxStr = Math.max(...impacts.map(i => i.strength), 0.001);

  /*
   * Tokenize preserving everything — words, punctuation, spaces — so the
   * reconstructed HTML is character-perfect.
   * Pattern: grab runs of letters (including apostrophes inside words)
   * OR any run of non-letter chars.
    * /
  const tokens = rawText.match(/[A-Za-z]+(?:'[A-Za-z]+)*|[^A-Za-z]+/g) || [];

  const html = tokens.map(token => {
    // Non-word tokens: pass through safely
    if (!/[A-Za-z]/.test(token)) return escHtml(token);

    // Strip trailing apostrophe-s for lookup (possessives)
    const key = token.toLowerCase().replace(/'s$/, '');

    const hit = lookup.get(key) || lookup.get(key.replace(/['']/g, "'"));
    if (!hit) return escHtml(token);

    // Determine visual direction:
    // positive SHAP = pushes toward predicted class
    // For low_risk prediction a positive SHAP means "more low risk" = green
    // For moderate/high_risk a positive SHAP means "more concern"   = red
    const isPos          = hit.impact > 0;
    const pushesConcern  = (label === 'low_risk') ? !isPos : isPos;

    const intensity = Math.min(hit.strength / maxStr, 1);
    const alpha     = (intensity * 0.50 + 0.20).toFixed(2);   // 0.20 – 0.70
    const cls       = pushesConcern ? 'hl-pos' : 'hl-neg';
    const rgb       = pushesConcern ? '239,68,68' : '34,197,94';
    const dir       = pushesConcern ? 'raises risk signal' : 'lowers risk signal';
    const tip       = `${dir} (${hit.impact > 0 ? '+' : ''}${hit.impact.toFixed(3)})`;

    return `<mark class="${cls}" title="${tip}" style="background:rgba(${rgb},${alpha})">${escHtml(token)}</mark>`;
  }).join('');

  box.innerHTML = html;
}
*/

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setDashLoading(on) {
  document.getElementById('dashBtnText').classList.toggle('hidden', on);
  document.getElementById('dashSpinner').classList.toggle('hidden', !on);
  document.getElementById('dashBtn').disabled = on;
}

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') runDashboard();
});
