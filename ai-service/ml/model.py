"""Train-on-first-run logistic regression for rejection probability."""

from __future__ import annotations

import os
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

MODEL_DIR = Path(__file__).resolve().parent
MODEL_PATH = MODEL_DIR / "rejection_model.joblib"


def _synthetic_xy(seed: int = 42, n: int = 400):
    rng = np.random.default_rng(seed)
    X = rng.normal(size=(n, 4))
    # Features: num_violations, exclusion_match, waiting_violation, amount_ratio
    X[:, 0] = np.abs(X[:, 0]) * 1.2
    X[:, 3] = np.clip(np.abs(X[:, 3]) * 0.8, 0, 3)
    z = (
        1.2 * X[:, 0]
        + 1.8 * X[:, 1]
        + 1.1 * X[:, 2]
        + 0.9 * X[:, 3]
        - 1.5
        + rng.normal(0, 0.4, size=n)
    )
    y = (z > 0).astype(int)
    return X, y


def ensure_model():
    if MODEL_PATH.exists():
        return
    X, y = _synthetic_xy()
    clf = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "lr",
                LogisticRegression(max_iter=200, class_weight="balanced"),
            ),
        ]
    )
    clf.fit(X, y)
    joblib.dump(clf, MODEL_PATH)


def predict_proba(features: dict) -> float:
    ensure_model()
    clf = joblib.load(MODEL_PATH)
    vec = np.array(
        [
            [
                float(features.get("num_violations", 0)),
                float(features.get("exclusion_match", 0)),
                float(features.get("waiting_period_violation", 0)),
                float(features.get("amount_ratio", 0)),
            ]
        ]
    )
    proba = float(clf.predict_proba(vec)[0][1])
    return max(0.03, min(0.97, proba))
