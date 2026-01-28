import rateLimit from "express-rate-limit";

export const limiterMiddleware = rateLimit({
    // 1. UPDATE STANDAR (Penting)
    // 'max' sudah deprecated di versi terbaru, gunakan 'limit'.
    limit: 100,
    windowMs: 15 * 60 * 1000, // 15 menit

    // 2. HEADER CONFIG
    // Menggunakan standar header terbaru (RateLimit-Limit, RateLimit-Remaining, dll)
    standardHeaders: true,
    // Matikan header lama (X-RateLimit-*) agar respon lebih bersih
    legacyHeaders: false,

    // 3. UX & FRONTEND FRIENDLY (Penting buat API)
    // Daripada cuma teks string, kirim JSON agar Frontend Next.js mudah mengolahnya.
    message: {
        success: false,
        status: 429,
        error: "Too Many Requests",
        message: "Anda terlalu sering melakukan request. Silakan tunggu 15 menit lagi."
    },

    // 4. HANDLING PROXY (Wajib jika deploy di Vercel/Railway/VPS + Cloudflare)
    // Jika tidak di-set, semua user mungkin terdeteksi sebagai 1 IP (IP Load Balancer)
    // dan semua orang kena block barengan.
    keyGenerator: (req, res) => {
        // Ambil IP asli user jika di balik proxy/Cloudflare
        return req.headers['x-forwarded-for']?.toString() || req.ip || "unknown";
    },

    // 5. SKIP LOGIC (Opsional)
    // Jangan batasi request dari localhost atau IP Admin tertentu
    skip: (req, res) => {
        const myIp = req.headers['x-forwarded-for'] || req.ip;
        // Contoh: Skip jika IP adalah localhost
        return myIp === '::1' || myIp === '127.0.0.1';
    },

    // 6. FAILURE HANDLING
    // Tetap hitung request meskipun gagal (Error 4xx/5xx).
    // Ini bagus untuk mencegah brute-force login.
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
});