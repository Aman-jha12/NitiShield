"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { jsPDF } from "jspdf";
import Appbar from "../../components/Appbar";
import ProbabilityGauge from "../../components/ProbabilityGauge";
import RiskBadge from "../../components/RiskBadge";
import { fetchAnalysisById, generateAppealPayload, type AnalyzeResult } from "@/lib/api";

function ResultsInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [data, setData] = useState<AnalyzeResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appeal, setAppeal] = useState<string | null>(null);
  const [appealLoading, setAppealLoading] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (id) {
        try {
          const row = await fetchAnalysisById(id);
          if (cancelled) return;
          setData(row);
          if (row.savedAppealLetter) {
            setAppeal(row.savedAppealLetter);
          }
          setLoadError(null);
        } catch (e) {
          if (!cancelled) {
            setLoadError(e instanceof Error ? e.message : "Failed to load");
            setData(null);
          }
        }
        return;
      }

      const raw = sessionStorage.getItem("claimshield_last_result");
      if (!raw) {
        if (!cancelled) setData(null);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as AnalyzeResult;
        if (!cancelled) {
          setData(parsed);
          setLoadError(null);
        }
      } catch {
        if (!cancelled) setData(null);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function downloadPdf() {
    if (!data) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 48;
    let y = margin;
    doc.setFontSize(18);
    doc.text("ClaimShield — Risk report", margin, y);
    y += 28;
    doc.setFontSize(11);
    doc.text(`Rejection probability: ${Math.round(data.probability * 100)}%`, margin, y);
    y += 18;
    doc.text(`Risk band: ${data.risk_level}`, margin, y);
    y += 24;
    doc.setFontSize(12);
    doc.text("Reasons", margin, y);
    y += 16;
    doc.setFontSize(10);
    for (const r of data.reasons) {
      const lines = doc.splitTextToSize(`• ${r}`, 500);
      doc.text(lines, margin, y);
      y += lines.length * 14 + 6;
      if (y > 720) {
        doc.addPage();
        y = margin;
      }
    }
    y += 10;
    doc.setFontSize(12);
    doc.text("Suggestions", margin, y);
    y += 16;
    doc.setFontSize(10);
    for (const s of data.suggestions) {
      const lines = doc.splitTextToSize(`• ${s}`, 500);
      doc.text(lines, margin, y);
      y += lines.length * 14 + 6;
      if (y > 720) {
        doc.addPage();
        y = margin;
      }
    }
    if (appeal) {
      y += 16;
      if (y > 680) {
        doc.addPage();
        y = margin;
      }
      doc.setFontSize(12);
      doc.text("Appeal letter", margin, y);
      y += 16;
      doc.setFontSize(10);
      for (const block of appeal.split("\n\n")) {
        const lines = doc.splitTextToSize(block, 500);
        doc.text(lines, margin, y);
        y += lines.length * 14 + 12;
        if (y > 720) {
          doc.addPage();
          y = margin;
        }
      }
    }
    doc.save("claimshield-report.pdf");
  }

  async function onAppeal() {
    if (!data) return;
    setAppealError(null);
    setAppealLoading(true);
    try {
      const res = await generateAppealPayload({
        structured: data.structured,
        cross_reference: data.cross_reference,
        probability: data.probability,
        analysisId: data.analysisId,
      });
      setAppeal(res.appeal_letter);
    } catch (e) {
      setAppealError(e instanceof Error ? e.message : "Failed to generate appeal");
    } finally {
      setAppealLoading(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-red-600 dark:text-red-400">{loadError}</p>
        <Link href="/dashboard" className="mt-4 inline-block font-medium text-indigo-600 hover:text-indigo-500">
          Back to dashboard
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-slate-600 dark:text-slate-400">No results yet.</p>
        <Link href="/dashboard/upload" className="mt-4 inline-block font-medium text-indigo-600 hover:text-indigo-500">
          Run an analysis
        </Link>
      </main>
    );
  }

  const violations = data.cross_reference?.violations || [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Results</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Rejection risk estimate and policy alignment summary</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RiskBadge level={data.risk_level} />
          <button
            type="button"
            onClick={downloadPdf}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Download PDF report
          </button>
          <Link
            href="/dashboard/upload"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            New analysis
          </Link>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Rejection probability</h2>
          <ProbabilityGauge probability={data.probability} riskLevel={data.risk_level} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Violations</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {violations.length === 0 && (
              <li className="text-slate-500 dark:text-slate-400">No structured violations flagged by the rules engine.</li>
            )}
            {violations.map((v, i) => (
              <li
                key={i}
                className={`rounded-lg border px-3 py-2 ${
                  v.severity === "high"
                    ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100"
                    : v.severity === "medium"
                      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
                      : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                <span className="font-medium capitalize">{v.type.replace("_", " ")}</span>
                <span className="text-slate-600 dark:text-slate-300"> — {v.detail}</span>
              </li>
            ))}
          </ul>
          {!!data.cross_reference?.matched_clauses?.length && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Matched clauses</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
                {data.cross_reference.matched_clauses.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reasons</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
            {data.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Suggestions</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
            {data.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Post-rejection assistance</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Generate a formal appeal letter referencing your structured claim and policy flags.
            </p>
          </div>
          <button
            type="button"
            onClick={onAppeal}
            disabled={appealLoading}
            className="shrink-0 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {appealLoading ? "Generating…" : appeal ? "Regenerate appeal letter" : "Generate appeal letter"}
          </button>
        </div>
        {appealError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{appealError}</p>}
        {appeal && (
          <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {appeal}
          </pre>
        )}
      </section>
    </main>
  );
}

export default function ResultsDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Appbar />
      <Suspense
        fallback={
          <main className="mx-auto max-w-xl px-4 py-20 text-center text-slate-600 dark:text-slate-400">Loading…</main>
        }
      >
        <ResultsInner />
      </Suspense>
    </div>
  );
}
