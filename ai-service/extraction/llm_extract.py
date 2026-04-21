"""Structured extraction via OpenAI, Hugging Face, or heuristic fallback."""

from __future__ import annotations

import json
import os
import re
from typing import Any

import requests

DEFAULT_STRUCTURE = {
    "policy": {
        "coverage": [],
        "exclusions": [],
        "waiting_periods": [],
        "sub_limits": [],
    },
    "claim": {
        "diagnosis": "",
        "procedures": [],
        "bill_amount": 0.0,
        "icd10": [],
    },
}


def _heuristic_extract(policy_text: str, claim_text: str) -> dict[str, Any]:
    data = json.loads(json.dumps(DEFAULT_STRUCTURE))

    pol = (policy_text or "").lower()
    clm = (claim_text or "").lower()

    # Policy patterns
    if "pre-existing" in pol or "ped" in pol:
        data["policy"]["exclusions"].append("Pre-existing diseases (PED) waiting / exclusion as per policy wording")
    if "waiting period" in pol:
        m = re.search(r"waiting\s+period\s*(?:of)?\s*(\d+)\s*(year|month|yr|mo)s?", pol)
        if m:
            data["policy"]["waiting_periods"].append(f"{m.group(1)} {m.group(2)}(s) for specified conditions")
        else:
            data["policy"]["waiting_periods"].append("Standard waiting periods apply per policy schedule")
    if "sub-limit" in pol or "sub limit" in pol or "sublimit" in pol:
        data["policy"]["sub_limits"].append("Room rent / ICU / specific procedure sub-limits per policy schedule")
    data["policy"]["coverage"].append("In-patient hospitalization as per policy terms (subject to exclusions)")

    # Claim patterns
    bill = 0.0
    for m in re.finditer(r"(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)", clm, re.I):
        try:
            bill = max(bill, float(m.group(1).replace(",", "")))
        except ValueError:
            pass
    if bill == 0.0:
        m = re.search(r"total\s*(?:amount|bill)?\s*[:=]?\s*([\d,]+(?:\.\d+)?)", clm)
        if m:
            try:
                bill = float(m.group(1).replace(",", ""))
            except ValueError:
                bill = 0.0

    icd_matches = re.findall(r"\b([A-TV-Z][0-9]{2}(?:\.[0-9A-TV-Z]{1,4})?)\b", claim_text or "")
    data["claim"]["icd10"] = list(dict.fromkeys(icd_matches))[:12]

    diag = ""
    for line in (claim_text or "").splitlines():
        low = line.lower()
        if "diagnosis" in low or "dx" in low:
            diag = line.split(":", 1)[-1].strip()
            break
    if not diag and "appendicitis" in clm:
        diag = "Acute appendicitis"
    if not diag and "fracture" in clm:
        diag = "Fracture"
    if not diag:
        diag = "Unspecified diagnosis (from hospital documents)"

    procs: list[str] = []
    if "surgery" in clm or "procedure" in clm:
        procs.append("Surgical / interventional procedure (details in bill)")
    if "appendectomy" in clm:
        procs.append("Appendectomy")
    if not procs:
        procs.append("Medical management / diagnostics as billed")

    data["claim"]["diagnosis"] = diag
    data["claim"]["procedures"] = procs
    data["claim"]["bill_amount"] = float(bill or 150000.0)
    return data


def _openai_extract(policy_text: str, claim_text: str) -> dict[str, Any] | None:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    prompt = f"""You are a health insurance analyst. Extract JSON only (no markdown) with this shape:
{json.dumps(DEFAULT_STRUCTURE, indent=2)}
Rules:
- policy.* arrays: short strings from the policy text
- claim.diagnosis: primary diagnosis
- claim.icd10: ICD-10 codes if present else []
- claim.bill_amount: numeric total if found else 0
- claim.procedures: list of procedures

POLICY TEXT:
{policy_text[:12000]}

CLAIM / HOSPITAL TEXT:
{claim_text[:12000]}
"""
    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
            },
            timeout=120,
        )
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
        parsed = json.loads(content)
        return parsed
    except Exception:
        return None


def _hf_extract(policy_text: str, claim_text: str) -> dict[str, Any] | None:
    token = os.getenv("HUGGINGFACE_API_TOKEN", "").strip()
    model = os.getenv("HF_MODEL", "meta-llama/Meta-Llama-3-8B-Instruct")
    if not token:
        return None
    prompt = f"""Return ONLY valid JSON matching: {json.dumps(DEFAULT_STRUCTURE)}
POLICY:\n{policy_text[:8000]}\n\nCLAIM:\n{claim_text[:8000]}"""
    try:
        r = requests.post(
            f"https://api-inference.huggingface.co/models/{model}",
            headers={"Authorization": f"Bearer {token}"},
            json={"inputs": prompt, "parameters": {"max_new_tokens": 800, "return_full_text": False}},
            timeout=120,
        )
        if r.status_code != 200:
            return None
        body = r.json()
        text = ""
        if isinstance(body, list) and body:
            text = body[0].get("generated_text", "") or ""
        elif isinstance(body, dict):
            text = body.get("generated_text", "") or str(body)
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return None
        return json.loads(m.group(0))
    except Exception:
        return None


def extract_structured(policy_text: str, claim_text: str) -> dict[str, Any]:
    for fn in (_openai_extract, _hf_extract):
        out = fn(policy_text, claim_text)
        if out and isinstance(out, dict) and "policy" in out and "claim" in out:
            return out
    return _heuristic_extract(policy_text, claim_text)
