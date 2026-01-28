// src/controllers/middleware-service.ts
import { Request, Response, NextFunction } from 'express';
import * as argon2 from 'argon2'; // Import argon2

export class MiddlewareService {
    private static instance: MiddlewareService;

    private constructor() { }

    public static getInstance(): MiddlewareService {
        if (!MiddlewareService.instance) {
            MiddlewareService.instance = new MiddlewareService();
        }
        return MiddlewareService.instance;
    }

    public apiKeyMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Ambil key yang dikirim user/client
        const incomingKey = req.headers['x-api-key'] as string;

        // Ambil Hash yang tersimpan di server
        const storedHash = process.env.API_SECRET_HASH;

        if (!incomingKey || !storedHash) {
            res.status(401).json({
                success: false,
                error: 'Unauthorized: API Key missing or server misconfigured.'
            });
            return;
        }

        try {
            // VERIFIKASI KUAT (Argon2)
            // Fungsi ini akan menghash 'incomingKey' dan mencocokkannya dengan 'storedHash'
            const isValid = await argon2.verify(storedHash, incomingKey);

            if (!isValid) {
                // Sengaja error message generik agar hacker bingung
                res.status(401).json({
                    success: false,
                    error: 'Unauthorized: Invalid credentials.'
                });
                return;
            }

            // Jika valid, lanjut
            next();

        } catch (err) {
            console.error('Middleware Error:', err);
            res.status(500).json({ success: false, error: 'Internal Auth Error' });
        }
    };
}