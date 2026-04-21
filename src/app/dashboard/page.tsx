"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Appbar from "../components/Appbar";
import { fetchAnalyses, fetchAnalytics, getToken } from "@/lib/api";

export default function DashboardPage() {
  const [summary, setSummary] = useState<{
    totalRuns: number;
    averageProbability: number;
    highRiskCount: number;
  } | null>(null);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      createdAt: string;
      policyFileName: string | null;
      hospitalFileName: string | null;
      probability?: number;
      risk_level?: string;
    }>
  >([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setChecked(true);
        return;
      }
      const [s, a] = await Promise.all([fetchAnalytics(), fetchAnalyses()]);
      if (cancelled) return;
      setSummary(s);
      setRows(a as typeof rows);
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Appbar />
        <main className="mx-auto max-w-4xl px-4 py-20 text-center text-slate-600 dark:text-slate-400">Loading…</main>
      </div>
    );
  }

  if (!getToken()) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Appbar />
        <main className="mx-auto max-w-xl px-4 py-20 text-center">
          <p className="text-slate-600 dark:text-slate-400">Log in to view saved analyses and analytics.</p>
          <Link href="/login" className="mt-4 inline-block font-medium text-indigo-600 hover:text-indigo-500">
            Log in
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Appbar />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">Simple analytics for your past ClaimShield runs</p>
          </div>
          <Link
            href="/dashboard/upload"
            className="inline-flex justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            New analysis
          </Link>
        </div>

        {summary && (
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total analyses", value: String(summary.totalRuns) },
              { label: "Avg. rejection probability", value: `${Math.round(summary.averageProbability * 100)}%` },
              { label: "High-risk runs (≥65%)", value: String(summary.highRiskCount) },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50"
              >
                <p className="text-sm text-slate-500 dark:text-slate-400">{c.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent analyses</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Policy file</th>
                  <th className="px-4 py-3 font-medium">Hospital files</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                  <th className="px-4 py-3 font-medium">Probability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No saved analyses yet.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="text-slate-800 dark:text-slate-200">
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">{r.policyFileName || "—"}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{r.hospitalFileName || "—"}</td>
                    <td className="px-4 py-3 capitalize">{r.risk_level || "—"}</td>
                    <td className="px-4 py-3">
                      {typeof r.probability === "number" ? `${Math.round(r.probability * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
