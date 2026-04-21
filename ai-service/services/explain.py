"""Human-readable reasons and suggestions (LLM or template)."""

from __future__ import annotations

import json
import os
import re
from typing import Any

import requests


def template_explain(
    structured: dict[str, Any],
    cross: dict[str, Any],
    probability: float,
) -> tuple[list[str], list[str]]:
    reasons: list[str] = []
    for v in cross.get("violations") or []:
        reasons.append(f"{str(v.get('type', 'issue')).replace('_', ' ').title()}: {v.get('detail', '')}")
    for rf in cross.get("risk_factors") or []:
        reasons.append(f"Risk factor: {rf}")
    if not reasons:
        reasons.append("No major automated rule violations detected — insurer may still request clarifications.")

    suggestions: list[str] = []
    if any(v.get("type") == "exclusion" for v in cross.get("violations") or []):
        suggestions.append("Attach operative notes and discharge summary explicitly linking diagnosis to coverable indication")
        suggestions.append("Request clause-specific clarification from insurer on exclusion applicability")
    if any(v.get("type") == "waiting_period" for v in cross.get("violations") or []):
        suggestions.append("Provide policy inception date and prior continuity certificate to prove waiting period satisfaction")
    if any(v.get("type") == "sub_limit" for v in cross.get("violations") or []):
        suggestions.append("Split line items to match policy room category; consider voluntary co-pay if allowed")
    suggestions.append("Attach pre-authorization approval and final bill reconciliation")
    if structured.get("claim", {}).get("icd10"):
        suggestions.append("Cross-verify ICD-10 coding with clinical findings to avoid coding disputes")
    else:
        suggestions.append("Clarify diagnosis with supporting lab/imaging reports and ICD-10 from treating physician")
    suggestions.append("Reference specific policy sections in the claim form narrative")

    if probability > 0.65:
        suggestions.append("Prepare a concise medical necessity letter from the treating doctor")

    return reasons, list(dict.fromkeys(suggestions))


def llm_explain(
    structured: dict[str, Any],
    cross: dict[str, Any],
    probability: float,
) -> tuple[list[str], list[str]] | None:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    payload = {
        "structured": structured,
        "cross_reference": cross,
        "rejection_probability": probability,
    }
    prompt = f"""You help insured patients. Given this JSON, output JSON only with keys reasons (string array) and suggestions (string array). Short, actionable, cite policy-style phrasing where helpful.
INPUT:
{json.dumps(payload, indent=2)[:12000]}
"""
    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
            },
            timeout=90,
        )
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
        out = json.loads(content)
        rs = out.get("reasons") or []
        sg = out.get("suggestions") or []
        if isinstance(rs, list) and isinstance(sg, list):
            return [str(x) for x in rs], [str(x) for x in sg]
    except Exception:
        return None
    return None


def build_explanations(
    structured: dict[str, Any],
    cross: dict[str, Any],
    probability: float,
) -> tuple[list[str], list[str]]:
    llm = llm_explain(structured, cross, probability)
    if llm:
        return llm
    return template_explain(structured, cross, probability)
