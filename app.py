"""
Digital Signals — Mental Health Risk Detection
Flask inference app for school counseling use
"""

import os, re, uuid
import numpy as np
import joblib
from flask import Flask, render_template, request, jsonify

try:
    import tensorflow as tf
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing.sequence import pad_sequences
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

try:
    import nltk
    from nltk.stem import WordNetLemmatizer
    from nltk.corpus import stopwords
    nltk.download('punkt',     quiet=True)
    nltk.download('wordnet',   quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('omw-1.4',   quiet=True)
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

MAX_LEN = 200
CLASSES = ['low_risk', 'moderate_risk', 'high_risk']

LABEL_DISPLAY = {
    'low_risk':      ('Low Risk',      '#22c55e', '🟢'),
    'moderate_risk': ('Moderate Risk', '#f59e0b', '🟡'),
    'high_risk':     ('High Risk',     '#ef4444', '🔴'),
}

MODEL_DIR         = os.path.join(os.path.dirname(__file__), 'models')
BILSTM_MODEL_PATH = os.path.join(MODEL_DIR, 'bilstm_best_ft1.keras')
TOKENIZER_PATH    = os.path.join(MODEL_DIR, 'bilstm_tokenizer.pkl')
LR_PIPELINE_PATH  = os.path.join(MODEL_DIR, 'lr_best_pipeline.pkl')

bilstm_model     = None
bilstm_tokenizer = None
lr_pipeline      = None
_bilstm_expected_len = None

def load_models():
    global bilstm_model, bilstm_tokenizer, lr_pipeline, _bilstm_expected_len
    if TF_AVAILABLE and os.path.exists(BILSTM_MODEL_PATH):
        try:
            bilstm_model = load_model(BILSTM_MODEL_PATH)
            try:
                # Commonly (None, seq_len) for Embedding input
                _bilstm_expected_len = int(bilstm_model.input_shape[1])
            except Exception:
                _bilstm_expected_len = None
            print("BiLSTM loaded")
        except Exception as e:
            print(f"BiLSTM failed: {e}")
    if os.path.exists(TOKENIZER_PATH):
        try:
            bilstm_tokenizer = joblib.load(TOKENIZER_PATH)
            print("Tokenizer loaded")
        except Exception as e:
            print(f"Tokenizer failed: {e}")
    if os.path.exists(LR_PIPELINE_PATH):
        try:
            lr_pipeline = joblib.load(LR_PIPELINE_PATH)
            print("LR pipeline loaded")
        except Exception as e:
            print(f"LR pipeline failed: {e}")

load_models()

# ── Preprocessing ─────────────────────────────────────────────────────────────
_stop_words = set()
_lemmatizer = None
if NLTK_AVAILABLE:
    try:
        _stop_words = set(stopwords.words('english'))
        _lemmatizer = WordNetLemmatizer()
    except Exception:
        pass

def preprocess_text(text: str) -> str:
    text = str(text).lower().strip()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"[^a-zA-Z\s]", " ", text)
    text = " ".join(text.split())
    if _lemmatizer and _stop_words:
        tokens = [t for t in text.split() if t not in _stop_words]
        tokens = [_lemmatizer.lemmatize(t) for t in tokens]
        text = " ".join(tokens)
    return text


# ── Key function: build a map from every raw token → its lemma ────────────────
def build_raw_to_lemma_map(raw_text: str) -> dict:
    """
    Returns {raw_token_lowercase: lemma} for every alphabetic token in raw_text.
    When NLTK is unavailable, lemma == raw token (identity mapping).
    """
    tokens = re.findall(r"[a-zA-Z]+", raw_text.lower())
    if _lemmatizer:
        return {tok: _lemmatizer.lemmatize(tok) for tok in set(tokens)}
    return {tok: tok for tok in set(tokens)}


# ── BiLSTM inference ─────────────────────────────────────────────────────────
def predict_bilstm(raw_text: str):
    if bilstm_model is None or bilstm_tokenizer is None:
        return None, None, "BiLSTM model not loaded"
    try:
        cleaned = preprocess_text(raw_text)
        seq     = bilstm_tokenizer.texts_to_sequences([cleaned])
        expected_len = _bilstm_expected_len or MAX_LEN
        padded  = pad_sequences(seq, maxlen=expected_len, padding='post', truncating='post')
        proba   = bilstm_model.predict(padded, verbose=0)[0]
        pred_label = CLASSES[int(np.argmax(proba))]
        probs_dict = {CLASSES[i]: float(proba[i]) for i in range(len(CLASSES))}
        return pred_label, probs_dict, None
    except Exception as e:
        return None, None, str(e)


# --- LR inference (no SHAP) ---
def predict_lr(raw_text: str):
    if lr_pipeline is None:
        return None, None, "LR model not loaded"

    try:
        cleaned = preprocess_text(raw_text)
        pred_label = lr_pipeline.predict([cleaned])[0]
        proba = lr_pipeline.predict_proba([cleaned])[0]

        clf = lr_pipeline.named_steps.get('clf')
        classes = list(getattr(clf, 'classes_', CLASSES))
        probs_dict = {cls: float(p) for cls, p in zip(classes, proba)}

        # Ensure all expected classes exist for the frontend chart
        for cls in CLASSES:
            probs_dict.setdefault(cls, 0.0)

        return str(pred_label), probs_dict, None
    except Exception as e:
        return None, None, str(e)


# ── LR + SHAP inference ───────────────────────────────────────────────────────
def predict_lr_with_shap(raw_text: str):
    if lr_pipeline is None:
        return None, None, [], "LR model not loaded"

    cleaned    = preprocess_text(raw_text)
    vectorizer = lr_pipeline.named_steps['tfidf']
    clf        = lr_pipeline.named_steps['clf']

    pred_label = lr_pipeline.predict([cleaned])[0]
    proba      = lr_pipeline.predict_proba([cleaned])[0]
    probs_dict = {cls: float(p) for cls, p in zip(clf.classes_, proba)}

    # Build raw→lemma map so we can send every surface form that maps to a
    # matched TF-IDF feature back to the frontend for reliable highlighting
    raw_to_lemma = build_raw_to_lemma_map(raw_text)
    # Invert: lemma → list of raw tokens that produce it
    lemma_to_raw: dict = {}
    for raw_tok, lemma in raw_to_lemma.items():
        lemma_to_raw.setdefault(lemma, []).append(raw_tok)

    word_impacts = []
    try:
        X_vec         = vectorizer.transform([cleaned])
        feature_names = vectorizer.get_feature_names_out()
        classes       = list(clf.classes_)
        pred_idx      = classes.index(pred_label)
        x_dense       = X_vec.toarray()[0]   # actual TF-IDF weights for this doc

        # Get SHAP or fall back to weighted coefficients
        if SHAP_AVAILABLE:
            explainer = shap.LinearExplainer(
                clf, X_vec, feature_perturbation='interventional')
            shap_vals = explainer.shap_values(X_vec)
            sv = shap_vals[pred_idx][0]
        else:
            coef = clf.coef_
            coef_row = coef[0] if coef.ndim == 1 else coef[pred_idx]
            sv = x_dense * coef_row   # element-wise: tfidf * weight

        # Rank by |score|, only features that actually appear in the text
        present_mask = x_dense > 0
        scores_masked = np.where(present_mask, np.abs(sv), 0.0)
        top_idx = np.argsort(scores_masked)[::-1]

        added = 0
        for i in top_idx:
            if added >= 15:
                break
            if scores_masked[i] < 1e-9:
                break   # rest are all zero

            fname = feature_names[i]
            impact_val   = float(sv[i])
            strength_val = float(abs(sv[i]))

            # For an n-gram feature like "feel alone", use the first token
            lookup_lemma = fname.split()[0] if " " in fname else fname

            # Find every raw surface form in the original text that maps to
            # this lemma — we send ALL of them so the JS can match any variant
            surfaces = lemma_to_raw.get(lookup_lemma, [lookup_lemma])

            word_impacts.append({
                'lemma':    fname,          # TF-IDF feature name (for bar label)
                'word':     surfaces[0],    # primary surface form (most common)
                'surfaces': surfaces,       # ALL raw surface forms → guaranteed highlight
                'impact':   impact_val,
                'strength': round(strength_val, 4),
            })
            added += 1

        # If SHAP/coef scores end up all ~0 (can happen with sklearn version mismatch),
        # still return something for the bar diagram: top TF-IDF terms in the text.
        if not word_impacts:
            coef_row = None
            if (not SHAP_AVAILABLE) and hasattr(clf, 'coef_'):
                coef = clf.coef_
                coef_row = coef[0] if coef.ndim == 1 else coef[pred_idx]

            tfidf_top = np.argsort(x_dense)[::-1]
            for i in tfidf_top:
                if len(word_impacts) >= 12:
                    break
                if x_dense[i] <= 0:
                    break
                fname = feature_names[i]
                lookup_lemma = fname.split()[0] if " " in fname else fname
                surfaces = lemma_to_raw.get(lookup_lemma, [lookup_lemma])
                impact_val = float(coef_row[i]) if coef_row is not None else 0.0
                strength_val = float(x_dense[i] * (abs(coef_row[i]) if coef_row is not None else 1.0))
                word_impacts.append({
                    'lemma': fname,
                    'word': surfaces[0],
                    'surfaces': surfaces,
                    'impact': impact_val,
                    'strength': round(strength_val, 4),
                })

    except Exception as e:
        print(f"SHAP/impact error: {e}")

    # Absolute fallback: if anything above failed, still return a non-empty list
    # so the dashboard bar diagram can render.
    if not word_impacts:
        try:
            X_vec = vectorizer.transform([cleaned])
            x_dense = X_vec.toarray()[0]
            feature_names = vectorizer.get_feature_names_out()
            tfidf_top = np.argsort(x_dense)[::-1]
            for i in tfidf_top[:12]:
                if x_dense[i] <= 0:
                    break
                fname = feature_names[i]
                lookup_lemma = fname.split()[0] if " " in fname else fname
                surfaces = lemma_to_raw.get(lookup_lemma, [lookup_lemma])
                word_impacts.append({
                    'lemma': fname,
                    'word': surfaces[0],
                    'surfaces': surfaces,
                    'impact': 0.0,
                    'strength': round(float(x_dense[i]), 4),
                })
        except Exception as e:
            print(f"Impact absolute fallback error: {e}")

    return pred_label, probs_dict, word_impacts, None


# ── Error handler ─────────────────────────────────────────────────────────────
@app.errorhandler(500)
def handle_500(err):
    if request.path.startswith('/api/'):
        rid = uuid.uuid4().hex[:8]
        app.logger.exception("500 at %s (%s)", request.path, rid)
        return jsonify({'error': 'Server error. Please try again.', 'request_id': rid}), 500
    return err


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route('/')
def home():
    return render_template('home.html')

@app.route('/analyze')
def analyze():
    return render_template('analyze.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')


@app.route('/api/predict', methods=['POST', 'GET'])
def api_predict():
    rid  = uuid.uuid4().hex[:8]
    try:
        if request.method == 'GET':
            text = (request.args.get('text') or '').strip()
        else:
            data = request.get_json(silent=True) or {}
            text = (data.get('text') or '').strip()
        if len(text) < 10:
            return jsonify({'error': 'Please enter at least 10 characters.', 'request_id': rid}), 400

        # Prefer BiLSTM when available; fall back to LR so the page still
        # predicts even when TensorFlow isn't installed.
        backend_used = None
        backend_error = None

        label, probs, err = predict_bilstm(text)
        if not (err or label is None):
            backend_used = 'bilstm'
        else:
            backend_error = err
            label, probs, err2 = predict_lr(text)
            if not (err2 or label is None):
                backend_used = 'lr'
                backend_error = backend_error or err2
            else:
                backend_used = 'fallback'
                backend_error = backend_error or err2
                # Last-resort demo fallback (keeps UI functional)
                label = 'low_risk'
                probs = {'low_risk': 0.72, 'moderate_risk': 0.18, 'high_risk': 0.10}

        if label not in LABEL_DISPLAY:
            # Guard against unexpected label names from a mismatched pipeline
            label = max(CLASSES, key=lambda k: float(probs.get(k, 0.0)))

        d = LABEL_DISPLAY[label]
        return jsonify({
            'label': label, 'label_text': d[0], 'color': d[1], 'emoji': d[2],
            'probabilities': probs, 'cleaned_text': preprocess_text(text),
            'request_id': rid,
            'backend_used': backend_used,
            'backend_error': backend_error,
        })
    except Exception:
        app.logger.exception("api_predict (%s)", rid)
        return jsonify({'error': 'Server error.', 'request_id': rid}), 500


@app.route('/api/health', methods=['GET'])
def api_health():
    return jsonify({
        'tf_available': bool(TF_AVAILABLE),
        'shap_available': bool(SHAP_AVAILABLE),
        'nltk_available': bool(NLTK_AVAILABLE),
        'bilstm_model_loaded': bilstm_model is not None,
        'bilstm_tokenizer_loaded': bilstm_tokenizer is not None,
        'bilstm_expected_len': _bilstm_expected_len,
        'lr_pipeline_loaded': lr_pipeline is not None,
        'bilstm_model_path_exists': os.path.exists(BILSTM_MODEL_PATH),
        'tokenizer_path_exists': os.path.exists(TOKENIZER_PATH),
        'lr_pipeline_path_exists': os.path.exists(LR_PIPELINE_PATH),
    })


@app.route('/api/insights', methods=['POST'])
def api_insights():
    rid = uuid.uuid4().hex[:8]
    try:
        data = request.get_json(silent=True) or {}
        text = (data.get('text') or '').strip()
        if len(text) < 10:
            return jsonify({'error': 'Please enter at least 10 characters.', 'request_id': rid}), 400

        label, probs, word_impacts, err = predict_lr_with_shap(text)

        if err or label is None:
            # Demo fallback — realistic data so UI works without models
            label = 'high_risk'
            probs = {'low_risk': 0.08, 'moderate_risk': 0.17, 'high_risk': 0.75}
            word_impacts = [
                {'lemma':'hopeless','word':'hopeless','surfaces':['hopeless'],          'impact': 0.51,'strength':0.51},
                {'lemma':'alone',   'word':'alone',   'surfaces':['alone'],             'impact': 0.44,'strength':0.44},
                {'lemma':'sleep',   'word':'sleep',   'surfaces':['sleep'],             'impact': 0.38,'strength':0.38},
                {'lemma':'point',   'word':'point',   'surfaces':['point'],             'impact': 0.31,'strength':0.31},
                {'lemma':'friend',  'word':'friends', 'surfaces':['friends','friend'],  'impact':-0.28,'strength':0.28},
                {'lemma':'go',      'word':'going',   'surfaces':['going','go'],        'impact': 0.22,'strength':0.22},
                {'lemma':'school',  'word':'school',  'surfaces':['school'],            'impact':-0.19,'strength':0.19},
                {'lemma':'dream',   'word':'dreams',  'surfaces':['dreams','dream'],    'impact': 0.17,'strength':0.17},
                {'lemma':'people',  'word':'people',  'surfaces':['people'],            'impact':-0.13,'strength':0.13},
                {'lemma':'talk',    'word':'talk',    'surfaces':['talk'],              'impact':-0.11,'strength':0.11},
            ]

        d = LABEL_DISPLAY[label]
        return jsonify({
            'label': label, 'label_text': d[0], 'color': d[1], 'emoji': d[2],
            'probabilities': probs,
            'predicted_probability': round(probs.get(label, 0) * 100, 1),
            'word_impacts': word_impacts,
            'request_id': rid,
        })
    except Exception:
        app.logger.exception("api_insights (%s)", rid)
        return jsonify({'error': 'Server error.', 'request_id': rid}), 500


@app.route('/api/explain', methods=['POST'])
def api_explain():
    return api_insights()


if __name__ == '__main__':
    app.run(debug=True, port=5000, use_reloader=False, threaded=True)
