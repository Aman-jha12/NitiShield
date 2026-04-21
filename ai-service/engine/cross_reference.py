"""Rule-based cross-reference of claim vs policy."""

from __future__ import annotations

import re
from typing import Any


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def cross_reference(structured: dict[str, Any]) -> dict[str, Any]:
    policy = structured.get("policy") or {}
    claim = structured.get("claim") or {}

    exclusions = policy.get("exclusions") or []
    waiting = policy.get("waiting_periods") or []
    sub_limits = policy.get("sub_limits") or []

    diagnosis = _norm(str(claim.get("diagnosis", "")))
    procedures = [_norm(str(p)) for p in (claim.get("procedures") or [])]
    bill = float(claim.get("bill_amount") or 0)

    risk_factors: list[str] = []
    matched_clauses: list[str] = []
    violations: list[dict[str, Any]] = []

    # Exclusion keyword scan
    excl_text = " ".join(_norm(x) for x in exclusions)
    ped_hit = "pre-existing" in excl_text or "ped" in excl_text
    cosmetic_hit = "cosmetic" in excl_text or "aesthetic" in excl_text

    if ped_hit and ("pre-existing" in diagnosis or "ped" in diagnosis):
        violations.append(
            {
                "type": "exclusion",
                "severity": "high",
                "detail": "Diagnosis or documentation may trigger pre-existing disease exclusion",
            }
        )
        matched_clauses.append("Pre-existing disease clause")
    if cosmetic_hit and any("cosmetic" in p for p in procedures):
        violations.append(
            {"type": "exclusion", "severity": "high", "detail": "Procedure may fall under cosmetic exclusion"}
        )
        matched_clauses.append("Cosmetic / aesthetic exclusion")

    # Demo: common exclusion match on appendectomy + generic exclusion wording
    if "append" in diagnosis and any("exclusion" in _norm(e) for e in exclusions):
        violations.append(
            {
                "type": "exclusion",
                "severity": "medium",
                "detail": "Verify whether procedure is excluded or subject to specific policy riders",
            }
        )
        matched_clauses.append("General exclusions schedule")

    # Waiting period heuristic
    if waiting:
        risk_factors.append("Policy lists waiting periods — verify membership duration and condition-specific clocks")
        violations.append(
            {
                "type": "waiting_period",
                "severity": "medium",
                "detail": "Waiting period may not be satisfied for this condition or procedure",
            }
        )
        matched_clauses.extend(waiting[:2])

    # Sub-limit ratio (assume synthetic cap if none parsed)
    cap = 200000.0
    for sl in sub_limits:
        m = re.search(r"(\d{2,3}(?:,\d{3})*(?:\.\d+)?)", str(sl))
        if m:
            try:
                cap = min(cap, float(m.group(1).replace(",", "")))
            except ValueError:
                pass
    ratio = (bill / cap) if cap > 0 else 0.0
    if ratio > 0.85:
        violations.append(
            {
                "type": "sub_limit",
                "severity": "high" if ratio > 1 else "medium",
                "detail": f"Claim amount ({bill:,.0f}) is close to or above inferred sub-limit context ({cap:,.0f})",
            }
        )
        matched_clauses.append("Sub-limit / sum insured utilization")
    elif sub_limits:
        risk_factors.append("Sub-limits apply — validate room category and procedure caps")

    if not violations and bill > 500000:
        risk_factors.append("High claim amount may trigger enhanced scrutiny / manual adjudication")

    return {
        "risk_factors": risk_factors,
        "matched_clauses": list(dict.fromkeys(matched_clauses)),
        "violations": violations,
        "features": {
            "num_violations": len(violations),
            "exclusion_match": 1.0 if any(v.get("type") == "exclusion" for v in violations) else 0.0,
            "waiting_period_violation": 1.0 if any(v.get("type") == "waiting_period" for v in violations) else 0.0,
            "amount_ratio": min(ratio, 3.0),
        },
    }
