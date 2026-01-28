import rateLimit from "express-rate-limit";

export const limiterMiddleware = rateLimit({
    // 1. LIMIT CONFIG
    limit: 100, // Ganti 'max' jadi 'limit' (Benar)
    windowMs: 15 * 60 * 1000, // 15 menit

    // 2. HEADER CONFIG
    standardHeaders: true,
    legacyHeaders: false,

    // 3. UX (JSON Response) - Ini sudah bagus
    message: {
        success: false,
        status: 429,
        error: "Too Many Requests",
        message: "Anda terlalu sering melakukan request. Silakan tunggu 15 menit lagi."
    },

    // 4. HANDLING PROXY (HAPUS keyGenerator MANUAL!)
    // Biarkan library menggunakan default 'req.ip'.
    // Kita akan setting 'trust proxy' di server.ts agar req.ip isinya benar.

    // 5. SKIP LOGIC (Sederhanakan)
    // Gunakan req.ip langsung karena kita akan set trust proxy nanti
    skip: (req) => {
        return req.ip === '::1' || req.ip === '127.0.0.1';
    },

    // 6. FAILURE HANDLING
    skipFailedRequests: false,
    skipSuccessfulRequests: false,

    // TAMBAHAN: Matikan validasi IP ganda biar gak error di log
    validate: {
        xForwardedForHeader: false,
    },
});