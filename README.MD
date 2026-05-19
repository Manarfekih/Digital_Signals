<div align="center">

# 🧠 Digital Signals
### *AI-Driven Mental Health Risk Awareness & Early Intervention System*

[![Python](https://img.shields.io/badge/Python-3.8%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.13-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.3-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![License](https://img.shields.io/badge/License-MIT-success?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

---

> ⚠️ **CRITICAL DISCLAIMER** ⚠️
> **Digital Signals is an awareness and early intervention tool ONLY.** It is **NOT** a medical diagnostic device, it does **NOT** provide clinical advice, and it is **NOT** a replacement for professional psychological or psychiatric care. All predictions must be reviewed and interpreted by a qualified human professional. False positives and false negatives can and will occur.

---

## 📑 Table of Contents
- [📖 Overview](#-overview)
- [✨ Key Features](#-key-features)
- [🛠️ Tech Stack](#-tech-stack)
- [🔄 The CRISP-DM Journey](#-the-crisp-dm-journey)
  - [1. Data Understanding & Preparation](#1-data-understanding--preparation)
  - [2. Modeling](#2-modeling)
  - [3. Deployment](#3-deployment)
  - [4. Ethics & Responsibility](#4-ethics--responsibility)
- [📊 Model Performance](#-model-performance)
- [🚀 Getting Started](#-getting-started)
- [📁 Project Structure](#-project-structure)
- [🛡️ Ethical Framework](#-ethical-framework)
- [🤝 Acknowledgements](#-acknowledgements)

---

## 📖 Overview

**Digital Signals** is an NLP-driven web application designed to assist school counselors in identifying early signs of mental health distress in students' written expressions. Built upon the **CRISP-DM** (Cross-Industry Standard Process for Data Mining) methodology, the system analyzes text to classify it into three risk tiers: **Low**, **Moderate**, and **High**.

By combining the sequential understanding of Deep Learning (BiLSTM) with the transparency of Explainable AI (SHAP + Logistic Regression), Digital Signals ensures high accuracy in detection while maintaining the interpretability required for sensitive, human-in-the-loop environments.

---

## ✨ Key Features

- 🎯 **Tri-Tier Risk Classification:** Categorizes text into `Low`, `Moderate`, or `High` risk with probability scores.
- 🧠 **Deep Learning Core:** Utilizes a fine-tuned Bidirectional LSTM (BiLSTM) optimized specifically to minimize critical false negatives (missing vulnerable individuals).
- 🔍 **Full Explainability (XAI):** Integrates SHAP to visually highlight which specific words drove the model's prediction, eliminating the "black box" problem.
- 🌐 **Counselor-Friendly UI:** A clean, responsive Flask web interface with color-coded risk badges and actionable guidance.
- 🔒 **Privacy-First Architecture:** Zero data retention. Texts are processed in-memory and immediately discarded; no database storage.

---

## 🛠️ Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Backend** | ![Flask](https://img.shields.io/badge/Flask-000000?style=flat-square&logo=flask&logoColor=white) ![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white) |
| **Deep Learning** | ![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?style=flat-square&logo=tensorflow&logoColor=white) ![Keras](https://img.shields.io/badge/Keras-D00000?style=flat-square&logo=keras&logoColor=white) |
| **Machine Learning** | ![scikit-learn](https://img.shields.io/badge/scikit_learn-F7931E?style=flat-square&logo=scikit-learn&logoColor=white) |
| **Explainability** | ![SHAP](https://img.shields.io/badge/SHAP-0000FF?style=flat-square&logo=python&logoColor=white) |
| **Frontend** | ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black) |
| **NLP Tooling** | ![NLTK](https://img.shields.io/badge/NLTK-3776AB?style=flat-square&logo=python&logoColor=white) |

---

## 🔄 The CRISP-DM Journey

### 1. Data Understanding & Preparation
The foundation of the project rests on an aggregated corpus of **11,917 samples** sourced from 5 distinct datasets (Kaggle, GitHub, Mendeley).
- **Schema Harmonization:** Unified disparate columns (`statement`, `text`, `content`) into a single `text` feature.
- **Semi-Supervised Labeling:** 911 unlabeled samples and ambiguous 'non-suicide' tags were pseudo-labeled using a high-confidence LightGBM thresholding strategy.
- **Preprocessing Pipeline:** Applied regex noise removal (URLs, mentions, special chars), lemmatization (NLTK WordNet), and filtered texts with < 3 words to ensure dense, meaningful linguistic input.

### 2. Modeling
The modeling phase prioritized **minimizing critical false negatives** (predicting `low_risk` for a `high_risk` individual) above standard accuracy.

| Model | Role | Rationale |
| :--- | :--- | :--- |
| **Logistic Regression** | Baseline & Explainer | High interpretability. Serves as the backbone for SHAP word-level explainability. |
| **Linear SVM** | Baseline | Evaluated for high-dimensional text margin maximization. |
| **Random Forest** | Baseline | Tested for non-linear feature combinations (underperformed on minority class). |
| **BiLSTM (FT-1)** | **Primary Predictor** | Captures sequential context ("I am *not* okay"). Chosen for its superior ability to halve critical false negatives compared to ML baselines. |

*Deep Learning Iterations:* The BiLSTM underwent rigorous tuning. V0 (Baseline) suffered severe overfitting. FT-2 (GlobalMaxPooling) lost nuanced context. FT-3 (Focal Loss) collapsed. **FT-1** (Reduced LR 1e-4, LSTM units 32, increased dropout) achieved the optimal balance, reducing the train/val loss gap to 0.29.

### 3. Deployment
The models were operationalized into a **Flask web application** designed for school counselors.
- **Dual-Model Inference:** The BiLSTM handles the primary risk prediction, while the Logistic Regression pipeline calculates real-time SHAP values.
- **Zero-Retention Privacy:** Texts are processed in RAM and never logged to disk.
- **Interactive UI:** Features include donut probability charts, color-coded SHAP text highlighting (Red for high-risk words, Green for low-risk), and dynamic counselor guidance panels.

### 4. Ethics & Responsibility
AI in mental health requires strict boundaries:
- **Human-in-the-Loop Mandate:** The system only provides signals; the counselor makes the decision.
- **Bias Awareness:** The model is limited by its Reddit-centric training data; it may not generalize perfectly across all cultural linguistics.
- **Transparency:** SHAP is not optional—it is mandatory for understanding *why* a flag was raised.

---

## 📊 Model Performance

Performance evaluated on the unseen test set (1,788 samples for DL, 2,384 for ML). The core metric of success is **High Risk Recall** and **Critical FN (High→Low)** minimization.

| Model | Macro F1 | ROC-AUC | High Risk Recall | Critical FN (High→Low) ↓ |
| :--- | :--- | :--- | :--- | :--- |
| **Logistic Regression** | 0.834 | 0.956 | 0.87 | 53 |
| Linear SVM | 0.829 | 0.948 | 0.89 | 57 |
| Random Forest | 0.764 | 0.937 | 0.90 | N/A (Poor Mod Recall) |
| **BiLSTM (FT-1)** 🏆 | **0.837** | **0.947** | **0.85** | **26** |

> 💡 **Key Insight:** While ML models achieved slightly higher overall recall, the BiLSTM **cut the most dangerous errors (Critical FNs) exactly in half** (from 53 to 26), making it the safest model for deployment.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- pip

### Installation & Execution

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/digital-signals.git
   cd digital-signals
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Ensure model artifacts are in place:**  
   Place the following trained models in the `models/` directory (or run training notebooks):
   - `bilstm_best_ft1.keras`
   - `bilstm_tokenizer.pkl`
   - `lr_best_pipeline.pkl`

4. **Run the Flask application:**
   ```bash
   python app.py
   ```

5. **Access the Interface:**  
   Open your browser and navigate to `http://localhost:5000`

---

## 📁 Project Structure

```text
digital-signals/
│
├── app.py                      # Flask web server & API endpoints
├── requirements.txt            # Python dependencies
├── README.md                   
│
├── models/                     # Serialized model artifacts
│   ├── bilstm_best_ft1.keras
│   ├── bilstm_tokenizer.pkl
│   └── lr_best_pipeline.pkl
│
├── notebooks/                  # Jupyter notebooks (CRISP-DM phases)
│   ├── 1_Data_Understanding.ipynb
│   ├── 2_Data_Preparation.ipynb
│   ├── 3_ML_Baseline_Models.ipynb
│   └── 4_Deep_Learning_BiLSTM.ipynb
│
├── data/                      
│   ├── raw/
│   └── processed/
│       └── df_all_clean.csv
│
├── static/                     # Frontend assets
│   ├── css/style.css
│   ├── js/main.js
│   └── images/
│
└── templates/                  # Flask HTML templates
|   ├── homex.html
|   ├── analyze.html
|   └── dashboard.html
├── static/                     # Frontend assets
│   ├── css/style.css
│   ├── js/main.js
│   └── images/
│
└── js/                  
    ├── home.js
    ├── analyze.js
    └── dashboard.js
```

---

## 🛡️ Ethical Framework

This project adheres to strict ethical guidelines regarding AI in sensitive domains:

1. 🔴 **No Diagnostic Claims:** The system outputs a *risk probability*, not a diagnosis.
2. 👁️ **Transparency via XAI:** Predictions are accompanied by SHAP feature importance to prevent blind trust.
3. 🚫 **Zero Data Retention:** Student texts are processed transiently and never stored.
4. 🤝 **Human-in-the-Loop:** The application is a decision-support tool, not an automated decision-maker.
5. ⚖️ **Bias Awareness:** Acknowledging that training data skew may affect performance across different sociolects and cultures.

---

## 🤝 Acknowledgements

- **Data Sources:** Kaggle (Mental Health Sentiment, Suicide & Depression Detection, Mental Health Corpus), GitHub (Reddit Mental Health), Mendeley.
- **Libraries:** Scikit-learn, TensorFlow, SHAP, NLTK, Flask.

---
<div align="center">
Made with ❤️ and responsibility by <b>Manar El Fakih Romdhane</b>
<br/>
<sub>If you or someone you know is struggling, please reach out to a professional or contact a local crisis line.</sub>
</div>
