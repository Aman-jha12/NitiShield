"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearSession, getUser } from "@/lib/api";

export default function Appbar() {
  const [user, setUser] = useState<{ email: string; name?: string | null } | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          ClaimShield
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard/upload" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            Upload
          </Link>
          <Link href="/dashboard" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            Dashboard
          </Link>
          {user ? (
            <>
              <span className="hidden sm:inline text-slate-500 dark:text-slate-400">{user.email}</span>
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  setUser(null);
                  window.location.href = "/";
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
