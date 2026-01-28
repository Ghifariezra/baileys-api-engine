import cors from 'cors';

// 1. Ambil whitelist dari .env dan ubah jadi Array
// Default ke localhost jika .env kosong
const whitelist = (process.env.ALLOWED_ORIGIN || 'http://localhost:3000').split(',');

export const corsMiddleware = cors({
    // 2. Dynamic Origin Validation
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl/Postman requests)
        if (!origin) return callback(null, true);

        if (whitelist.indexOf(origin) !== -1) {
            // Jika domain pengirim ada di whitelist, izinkan
            callback(null, true);
        } else {
            // Jika tidak, blokir!
            console.error(`[CORS BLOCKED] Origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },

    methods: ['GET', 'POST', 'OPTIONS'], // OPTIONS wajib ada untuk Preflight
    allowedHeaders: ['Content-Type', 'x-api-key'],

    // 3. OPTIMASI PERFORMA: Preflight Caching (PENTING!)
    // Browser akan mengingat izin CORS selama 24 jam (86400 detik).
    // Jadi browser tidak perlu tanya "Boleh kirim gak?" berulang-ulang setiap request.
    maxAge: 86400,

    // 4. Kompatibilitas Browser Lama
    // Beberapa browser lama/proxy bermasalah dengan status 204 (No Content)
    optionsSuccessStatus: 200
});