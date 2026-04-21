import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();
import crypto from "node:crypto";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import authRoutes from "./routes/auth.js";
import analysesRoutes from "./routes/analyses.js";
import { optionalAuth, authMiddleware, type AuthedRequest } from "./middleware/auth.js";
import { prisma } from "./lib/prisma.js";
import { cacheGet, cacheSet } from "./lib/redis.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const AI_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:5000";

const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "claimshield-api" });
});

app.use("/auth", authRoutes);
app.use("/analyses", analysesRoutes);

app.post(
  "/upload",
  optionalAuth,
  upload.fields([
    { name: "policy", maxCount: 1 },
    { name: "hospital", maxCount: 10 },
  ]),
  async (req: AuthedRequest, res) => {
    const files = req.files as Record<string, Express.Multer.File[]>;
    const policy = files?.policy?.[0];
    const hospital = files?.hospital || [];
    if (!policy && hospital.length === 0) {
      return res.status(400).json({ error: "Upload at least one file" });
    }
    const sessionId = crypto.randomUUID();
    const payload = {
      sessionId,
      policyPath: policy?.path,
      policyFileName: policy?.originalname,
      hospitalPaths: hospital.map((h) => h.path),
      hospitalFileNames: hospital.map((h) => h.originalname),
      userId: req.userId ?? null,
    };
    await cacheSet(`upload:${sessionId}`, JSON.stringify(payload), 60 * 60);
    return res.json({
      uploadSessionId: sessionId,
      policyFileName: policy?.originalname,
      hospitalFileNames: hospital.map((h) => h.originalname),
    });
  },
);

app.post("/analyze", optionalAuth, async (req: AuthedRequest, res) => {
  try {
    const contentType = req.headers["content-type"] || "";
    let policyFile: Express.Multer.File | undefined;
    let hospitalFiles: Express.Multer.File[] = [];

    if (contentType.includes("multipart/form-data")) {
      await new Promise<void>((resolve, reject) => {
        upload.fields([
          { name: "policy", maxCount: 1 },
          { name: "hospital", maxCount: 10 },
        ])(req, res, (err) => (err ? reject(err) : resolve()));
      });
      const files = req.files as Record<string, Express.Multer.File[]>;
      policyFile = files?.policy?.[0];
      hospitalFiles = files?.hospital || [];
    }

    const uploadSessionId = (req.body as { uploadSessionId?: string }).uploadSessionId;
    let formForAi: FormData | null = null;

    if (uploadSessionId) {
      const raw = await cacheGet(`upload:${uploadSessionId}`);
      if (!raw) {
        return res.status(400).json({ error: "Upload session expired or invalid" });
      }
      const session = JSON.parse(raw) as {
        policyPath?: string;
        hospitalPaths?: string[];
      };
      formForAi = new FormData();
      if (session.policyPath && fs.existsSync(session.policyPath)) {
        formForAi.append("policy", fs.createReadStream(session.policyPath));
      }
      for (const p of session.hospitalPaths || []) {
        if (p && fs.existsSync(p)) {
          formForAi.append("hospital", fs.createReadStream(p));
        }
      }
    } else if (policyFile || hospitalFiles.length) {
      formForAi = new FormData();
      if (policyFile?.path) {
        formForAi.append("policy", fs.createReadStream(policyFile.path));
      }
      for (const h of hospitalFiles) {
        formForAi.append("hospital", fs.createReadStream(h.path));
      }
    }

    if (!formForAi) {
      return res.status(400).json({ error: "Provide files or uploadSessionId" });
    }

    const aiResp = await axios.post(`${AI_URL}/analyze`, formForAi, {
      headers: formForAi.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 180_000,
    });

    const data = aiResp.data as Record<string, unknown>;
    const result = {
      probability: data.probability,
      risk_level: data.risk_level,
      reasons: data.reasons,
      suggestions: data.suggestions,
      cross_reference: data.cross_reference,
      structured: data.structured,
      model_features: data.model_features,
    };

    if (req.userId) {
      await prisma.analysis.create({
        data: {
          userId: req.userId,
          policyFileName: policyFile?.originalname ?? null,
          hospitalFileName: hospitalFiles.map((h) => h.originalname).join(", ") || null,
          result: result as object,
        },
      });
    }

    return res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analyze failed";
    const detail = axios.isAxiosError(e) ? e.response?.data : undefined;
    console.error(msg, detail);
    return res.status(502).json({ error: msg, detail });
  }
});

app.post("/appeal", optionalAuth, async (req: AuthedRequest, res) => {
  try {
    const aiResp = await axios.post(`${AI_URL}/appeal`, req.body, {
      timeout: 120_000,
    });
    const letter = (aiResp.data as { appeal_letter?: string }).appeal_letter;
    if (req.userId && req.body?.analysisId) {
      await prisma.analysis.updateMany({
        where: { id: String(req.body.analysisId), userId: req.userId },
        data: { appealLetter: letter ?? undefined },
      });
    }
    return res.json({ appeal_letter: letter });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Appeal generation failed";
    return res.status(502).json({ error: msg });
  }
});

app.get("/analytics/summary", authMiddleware, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const rows = await prisma.analysis.findMany({
    where: { userId },
    select: { result: true, createdAt: true },
  });
  const probs = rows
    .map((r) => (r.result as { probability?: number })?.probability)
    .filter((p): p is number => typeof p === "number");
  const avg = probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : 0;
  const high = probs.filter((p) => p >= 0.65).length;
  return res.json({
    totalRuns: rows.length,
    averageProbability: Math.round(avg * 1000) / 1000,
    highRiskCount: high,
  });
});

app.listen(PORT, () => {
  console.log(`ClaimShield API listening on :${PORT}`);
});
