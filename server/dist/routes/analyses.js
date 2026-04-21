import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
const router = Router();
router.get("/", authMiddleware, async (req, res) => {
    const userId = req.userId;
    const rows = await prisma.analysis.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
            id: true,
            policyFileName: true,
            hospitalFileName: true,
            createdAt: true,
            result: true,
        },
    });
    return res.json({
        analyses: rows.map((r) => ({
            id: r.id,
            createdAt: r.createdAt,
            policyFileName: r.policyFileName,
            hospitalFileName: r.hospitalFileName,
            probability: r.result?.probability,
            risk_level: r.result?.risk_level,
        })),
    });
});
router.get("/:id", authMiddleware, async (req, res) => {
    const userId = req.userId;
    const id = String(req.params.id);
    const row = await prisma.analysis.findFirst({
        where: { id, userId },
    });
    if (!row) {
        return res.status(404).json({ error: "Not found" });
    }
    return res.json({ analysis: row });
});
export default router;
