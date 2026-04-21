import Link from "next/link";
import Appbar from "./components/Appbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <Appbar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-16">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            ClaimShield
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Predict claim rejection risk before you submit
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-300">
            Upload your policy and hospital paperwork. ClaimShield parses documents, compares your claim
            against coverage and exclusions, estimates rejection probability, explains likely reasons, and
            suggests corrective steps—including an appeal letter when you need it.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/dashboard/upload"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Start analysis
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            >
              View dashboard
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Document intelligence",
              body: "PDF text extraction with OCR fallback for scans; structured policy and claim fields.",
            },
            {
              title: "Policy cross-check",
              body: "Rule engine flags exclusions, waiting periods, and sub-limit pressure against your bill.",
            },
            {
              title: "Explain + act",
              body: "Readable reasons, actionable suggestions, and a formal appeal draft when risk is high.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{c.title}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{c.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
