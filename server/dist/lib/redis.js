import { Redis } from "ioredis";
let client = null;
export function getRedis() {
    const url = process.env.REDIS_URL;
    if (!url)
        return null;
    if (!client) {
        client = new Redis(url, { maxRetriesPerRequest: 2 });
    }
    return client;
}
export async function cacheGet(key) {
    const r = getRedis();
    if (!r)
        return null;
    try {
        return await r.get(key);
    }
    catch {
        return null;
    }
}
export async function cacheSet(key, value, ttlSec) {
    const r = getRedis();
    if (!r)
        return;
    try {
        await r.set(key, value, "EX", ttlSec);
    }
    catch {
        /* ignore */
    }
}
export async function cacheDel(key) {
    const r = getRedis();
    if (!r)
        return;
    try {
        await r.del(key);
    }
    catch {
        /* ignore */
    }
}
