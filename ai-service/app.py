"""ClaimShield AI microservice — parse, extract, cross-reference, score, explain."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import uuid
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from engine.cross_reference import cross_reference
from extraction.llm_extract import extract_structured
from ml.model import predict_proba
from parsers.document_parser import parse_document
from services.appeal import generate_appeal
from services.explain import build_explanations

load_dotenv(_ROOT.parent / ".env")
load_dotenv()

app = Flask(__name__)
CORS(app)

TMP_ROOT = Path(tempfile.gettempdir()) / "claimshield_ai"
TMP_ROOT.mkdir(parents=True, exist_ok=True)


def _save_upload(fs, prefix: str) -> Path:
    suffix = Path(fs.filename or "file").suffix or ".bin"
    dest = TMP_ROOT / f"{prefix}_{uuid.uuid4().hex}{suffix}"
    fs.save(str(dest))
    return dest


def _risk_level(probability: float) -> str:
    if probability < 0.35:
        return "green"
    if probability < 0.65:
        return "yellow"
    return "red"


def _analyze_texts(policy_text: str, claim_text: str) -> dict:
    structured = extract_structured(policy_text, claim_text)
    xref = cross_reference(structured)
    features = xref.get("features") or {}
    probability = predict_proba(features)
    reasons, suggestions = build_explanations(structured, xref, probability)
    return {
        "probability": round(probability, 4),
        "risk_level": _risk_level(probability),
        "structured": structured,
        "cross_reference": {
            "risk_factors": xref.get("risk_factors"),
            "matched_clauses": xref.get("matched_clauses"),
            "violations": xref.get("violations"),
        },
        "reasons": reasons,
        "suggestions": suggestions,
        "model_features": features,
    }


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "claimshield-ai"})


@app.post("/analyze")
def analyze():
    policy_text = ""
    claim_text = ""

    if request.files:
        policy_files = request.files.getlist("policy")
        hospital_files = request.files.getlist("hospital")
        for f in policy_files:
            if f and f.filename:
                path = _save_upload(f, "policy")
                policy_text += "\n" + parse_document(path)
        for f in hospital_files:
            if f and f.filename:
                path = _save_upload(f, "hospital")
                claim_text += "\n" + parse_document(path)

    if not policy_text.strip():
        policy_text = request.form.get("policy_text") or ""
    if not claim_text.strip():
        claim_text = request.form.get("claim_text") or ""

    if request.is_json and request.json:
        body = request.json
        policy_text = policy_text or (body.get("policy_text") or "")
        claim_text = claim_text or (body.get("claim_text") or "")

    if not policy_text.strip() and not claim_text.strip():
        return (
            jsonify({"error": "Provide policy and hospital documents or policy_text/claim_text"}),
            400,
        )

    if not policy_text.strip():
        policy_text = "[Policy text not provided — using claim-only heuristic extraction]"
    if not claim_text.strip():
        claim_text = "[Hospital text not provided — using policy-only heuristic extraction]"

    result = _analyze_texts(policy_text, claim_text)
    return jsonify(result)


@app.post("/appeal")
def appeal():
    data = request.get_json(force=True, silent=True) or {}
    structured = data.get("structured") or {}
    cross = data.get("cross_reference") or {}
    probability = float(data.get("probability") or 0.5)
    letter = generate_appeal(structured, cross, probability)
    return jsonify({"appeal_letter": letter})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG") == "1")
