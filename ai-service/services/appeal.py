"""Appeal letter generation."""

from __future__ import annotations

import json
import os
import re
from typing import Any

import requests


def template_appeal(structured: dict[str, Any], cross: dict[str, Any], probability: float) -> str:
    claim = structured.get("claim") or {}
    pol = structured.get("policy") or {}
    lines = [
        "Re: Formal appeal regarding health insurance claim denial / adverse adjudication",
        "",
        "To,",
        "The Grievance / Claims Redressal Cell",
        "[Insurer Name]",
        "",
        "Dear Sir/Madam,",
        "",
        "I am writing to appeal the decision on my cashless / reimbursement claim. The treatment was medically necessary and falls within the scope of coverage described in the policy document, subject to the terms cited below.",
        "",
        "Claim summary:",
        f"- Diagnosis: {claim.get('diagnosis', 'As per medical records')}",
        f"- Procedures: {', '.join(claim.get('procedures') or []) or 'As per hospital bill'}",
        f"- Billed amount (as submitted): {claim.get('bill_amount', 0)}",
        "",
        "Policy references (for your review):",
    ]
    for c in (cross.get("matched_clauses") or [])[:6]:
        lines.append(f"- {c}")
    lines.extend(
        [
            "",
            "Grounds for appeal:",
            "- The clinical documentation supports medical necessity and aligns with standard treatment protocols.",
            "- Any exclusion or waiting period should be interpreted narrowly and in line with IRDAI guidelines on fair claims practices.",
            "- I request a re-evaluation with senior medical adjudication and a written rationale referencing specific policy clauses.",
            "",
            f"Automated risk screening estimate (for internal reference only): rejection risk score ~{probability:.0%}.",
            "",
            "I enclose / will provide upon request: discharge summary, itemized bills, investigation reports, pre-auth correspondence, and treating physician letter.",
            "",
            "Sincerely,",
            "[Policyholder Name]",
            "[Policy Number]",
            "[Contact]",
        ]
    )
    return "\n".join(lines)


def llm_appeal(structured: dict[str, Any], cross: dict[str, Any], probability: float) -> str | None:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    prompt = f"""Draft a formal insurance claim appeal letter in professional legal tone. Include claim details and policy clause references. Do not invent policy numbers. 4-6 short paragraphs.
DATA:
{json.dumps({"structured": structured, "cross": cross, "probability": probability}, indent=2)[:10000]}
"""
    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            },
            timeout=120,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return None


def generate_appeal(structured: dict[str, Any], cross: dict[str, Any], probability: float) -> str:
    out = llm_appeal(structured, cross, probability)
    if out:
        return out
    return template_appeal(structured, cross, probability)
