// analyze.js — Check-In page logic (teen-friendly, no technical terms)

// Sample messages for quick testing — warm and relatable
const SAMPLES = {
  low: `Today was actually a pretty good day! I had lunch with my friends and we laughed a lot. I finished my homework early and had time to play football. I feel okay about the upcoming exam. My family had dinner together and it felt nice. I think I'm doing alright overall.`,

  moderate: `Lately I've been feeling a bit off. I find it hard to concentrate in class and I keep forgetting things. Some days I feel fine but other days everything feels heavy and slow. I don't really know why. I still go to school and talk to my friends but something feels different. I'm not sure how to explain it.`,

  high: `I don't see the point of anything anymore. I feel completely alone even when I'm surrounded by people. I can't sleep and when I do I have bad dreams. I don't want to go to school, I don't want to talk to anyone. Everything feels hopeless and I don't know how much longer I can keep going like this. Nobody would even notice if I disappeared.`
};

// Supportive guidance messages — no clinical language
const GUIDANCE = {
  low_risk: `<strong>🌿 Feeling Well</strong><br/><br/>Your words suggest you're in a good place right now. Keep nurturing those positive feelings! Small steps like talking with friends, staying active, and resting well can help you stay balanced. 💚`,
  
  moderate_risk: `<strong>💭 Some Concerns</strong><br/><br/>It sounds like things might feel a bit heavy lately. That's okay — everyone has tough days. Consider talking with someone you trust: a friend, family member, or school counselor. You don't have to figure it out alone. 💙`,
  
  high_risk: `<strong>🤝 Needs Support — Please Reach Out</strong><br/><br/>Your words show you might be going through a really tough time. <strong>Please talk with a counselor or trusted adult today.</strong> You matter, and support is available. You deserve care and kindness right now. 💜`
};

// DOM element references (matching new HTML IDs)
const textInput = document.getElementById('textInput');
const charCount = document.getElementById('charCount');
const analyzeBtn = document.getElementById('analyzeBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const resultPanel = document.getElementById('resultPanel');
const errorPanel = document.getElementById('errorPanel');

// Character counter for textarea
textInput.addEventListener('input', () => {
  charCount.textContent = textInput.value.length;
});

// Clear input and reset UI
function clearInput() {
  textInput.value = '';
  charCount.textContent = '0';
  resultPanel.classList.add('hidden');
  errorPanel.classList.add('hidden');
  textInput.focus();
}

// Load sample text for testing
function loadSample(level) {
  textInput.value = SAMPLES[level];
  charCount.textContent = textInput.value.length;
  resultPanel.classList.add('hidden');
  errorPanel.classList.add('hidden');
  textInput.focus();
}

// Main analysis function
async function analyzeText() {
  const text = textInput.value.trim();
  
  if (text.length < 10) {
    showError('Please share a bit more — at least 10 words help us understand better.');
    return;
  }

  setLoading(true);
  resultPanel.classList.add('hidden');
  errorPanel.classList.add('hidden');

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      const raw = await response.text();
      const contentType = response.headers.get('content-type') || '';

      let data = null;
      if (raw && contentType.includes('application/json')) {
        try { data = JSON.parse(raw); } catch {}
      } else if (raw) {
        // Some servers forget the JSON content-type; try anyway.
        try { data = JSON.parse(raw); } catch {}
      }

      if (!response.ok) {
        const msg = (data && data.error) ? data.error : `Server error (${response.status}). Please try again.`;
        const rid = (data && data.request_id) ? ` (Ref: ${data.request_id})` : '';
        showError(msg + rid);
        return;
      }

      if (!data) {
        const hint = raw ? '' : ' (empty response)';
        showError('Unexpected server response. Please try again.' + hint);
        console.warn('Non-JSON response from /api/predict:', { status: response.status, contentType, raw: raw?.slice?.(0, 200) });
        return;
      }

      if (data.error) {
        const rid = data.request_id ? ` (Ref: ${data.request_id})` : '';
        showError(data.error + rid);
        return;
      }

      renderResult(data);
      
    } catch (error) {
      showError('Connection problem. Please try again in a moment.');
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
}

// Render the results with teen-friendly display
function renderResult(data) {
  // Update risk badge
  document.getElementById('riskEmoji').textContent = data.emoji;
  document.getElementById('riskLevelText').textContent = data.label_text;
  
  const badge = document.getElementById('riskBadge');
  badge.style.borderColor = data.color;
  document.getElementById('riskLevelText').style.color = data.color;

  // Animate probability bars
  const probs = data.probabilities;
  const total = Object.values(probs).reduce((a, b) => a + b, 1); // avoid division by zero

  const lowPct = ((probs.low_risk || 0) / total * 100).toFixed(1);
  const modPct = ((probs.moderate_risk || 0) / total * 100).toFixed(1);
  const highPct = ((probs.high_risk || 0) / total * 100).toFixed(1);

  animateBar('lowBar', lowPct);
  animateBar('modBar', modPct);
  animateBar('highBar', highPct);

  document.getElementById('lowPct').textContent = lowPct + '%';
  document.getElementById('modPct').textContent = modPct + '%';
  document.getElementById('highPct').textContent = highPct + '%';

  // Update guidance message
  const guidanceBox = document.getElementById('guidanceBox');
  guidanceBox.innerHTML = GUIDANCE[data.label] || data.message || '';
  guidanceBox.className = 'guidance-box guidance-' + data.label.replace('_risk', '');

  // Show results with smooth scroll
  resultPanel.classList.remove('hidden');
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Animate progress bars with easing
function animateBar(elementId, targetWidth) {
  const bar = document.getElementById(elementId);
  bar.style.width = '0%';
  
  // Double rAF for smooth start
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.transition = 'width 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)';
      bar.style.width = targetWidth + '%';
    });
  });
}

// Toggle loading state on button
function setLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  btnText.classList.toggle('hidden', isLoading);
  btnSpinner.classList.toggle('hidden', !isLoading);
}

// Show error message
function showError(message) {
  document.getElementById('errorMsg').textContent = message;
  errorPanel.classList.remove('hidden');
  resultPanel.classList.add('hidden');
}

// Copy summary to clipboard (for counselors)
function copyResult() {
  const level = document.getElementById('riskLevelText').textContent;
  const low = document.getElementById('lowPct').textContent;
  const mod = document.getElementById('modPct').textContent;
  const high = document.getElementById('highPct').textContent;

  const summary = `Digital Signals — Wellness Check
─────────────────────
Snapshot: ${level}

Confidence:
  🌿 Feeling Well: ${low}
  💭 Some Concerns: ${mod}
  🤝 Needs Support: ${high}

⚠️ This is an awareness tool only.
   Always involve a counselor for support decisions.`;

  navigator.clipboard.writeText(summary).then(() => {
    const originalText = btnText.textContent;
    btnText.textContent = '✓ Copied!';
    setTimeout(() => { btnText.textContent = originalText; }, 1500);
  }).catch(() => {
    alert('Copy failed — please select and copy manually.');
  });
}

// Keyboard shortcut: Ctrl+Enter to analyze
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    analyzeText();
  }
});

// Focus textarea on page load for quick start
window.addEventListener('load', () => {
  if (textInput && !textInput.value) {
    textInput.focus();
  }
});
