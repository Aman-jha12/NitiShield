"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Appbar from "../../components/Appbar";
import { analyzeFiles, getToken } from "@/lib/api";
import type { AnalyzeResult } from "@/lib/api";

export default function UploadDashboardPage() {
  const router = useRouter();
  const [policy, setPolicy] = useState<File | null>(null);
  const [hospital, setHospital] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getToken());
  }, []);

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!policy && hospital.length === 0) {
      setError("Add at least a policy PDF or hospital documents.");
      return;
    }
    setLoading(true);
    try {
      const result = await analyzeFiles(policy, hospital);
      sessionStorage.setItem("claimshield_last_result", JSON.stringify(result as AnalyzeResult));
      router.push("/dashboard/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Appbar />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Upload documents</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Add your insurance policy and hospital bills / discharge summary (PDF or images). Analysis runs on the ClaimShield
          AI service; sign in to save history on your dashboard.
        </p>
        {!authed && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            You are not logged in — results will not be stored.{" "}
            <a href="/login" className="font-medium underline">
              Log in
            </a>{" "}
            to keep analyses.
          </p>
        )}

        <form onSubmit={onAnalyze} className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">Policy PDF</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setPolicy(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:text-slate-300 dark:file:bg-indigo-950 dark:file:text-indigo-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
              Hospital documents (PDF / images)
            </label>
            <input
              type="file"
              accept=".pdf,image/*"
              multiple
              onChange={(e) => setHospital(Array.from(e.target.files || []))}
              className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:text-slate-300 dark:file:bg-indigo-950 dark:file:text-indigo-200"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 text-center text-base font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? "Analyzing…" : "Analyze claim risk"}
          </button>
        </form>
      </main>
    </div>
  );
}
