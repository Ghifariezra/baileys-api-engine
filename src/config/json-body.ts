import express, { Request, Response, NextFunction } from 'express';

// 1. CONFIGURATION
export const jsonBodyMiddleware = express.json({
    limit: '100kb',  // Cukup untuk payload teks biasa. Naikkan ke '1mb' jika kirim gambar base64.
    strict: true,    // Bagus! Mencegah input primitif (string/int) sebagai body.
    inflate: true,   // Standard.
    // Hapus 'reviver', 'verify', dan 'type' karena defaultnya sudah optimal.
});

// 2. ERROR HANDLING (OPTIMASI UTAMA)
// Middleware ini wajib ditaruh SETELAH 'jsonBodyMiddleware' di server.ts
// Fungsinya: Menangkap error jika JSON yang dikirim client RUSAK/INVALID.
export const handleJsonErrors = (err: any, req: Request, res: Response, next: NextFunction) => {
    // Cek apakah error berasal dari JSON parser
    if (err instanceof SyntaxError && 'body' in err) {
        console.error(`[Bad Request] IP: ${req.ip} mengirim JSON rusak.`);
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON Format',
            message: 'Format JSON yang Anda kirim salah/rusak. Cek tanda kurung atau koma.'
        });
    }
    next();
};