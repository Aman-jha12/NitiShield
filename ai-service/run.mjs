/**
 * Cross-platform dev runner: starts Flask from repo root (`npm run dev:ai`).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const python =
  process.env.PYTHON ??
  (process.platform === "win32" ? "py" : process.platform === "darwin" ? "python3" : "python3");

const child = spawn(python, ["-u", "app.py"], {
  cwd: dir,
  stdio: "inherit",
  env: { ...process.env },
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
