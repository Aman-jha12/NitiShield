import jwt from "jsonwebtoken";
export function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const payload = jwt.verify(token, secret);
        req.userId = payload.sub;
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid token" });
    }
}
export function optionalAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) {
        return next();
    }
    try {
        const payload = jwt.verify(token, secret);
        req.userId = payload.sub;
    }
    catch {
        /* ignore */
    }
    next();
}
