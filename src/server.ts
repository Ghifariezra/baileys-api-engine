// src/server.ts
import express from 'express';
import dotenv from 'dotenv';
import { helmetMiddleware } from './config/helmet';
import { corsMiddleware } from './config/cors';
import { handleJsonErrors, jsonBodyMiddleware } from './config/json-body';
import { MiddlewareService } from './controllers/middleware.service';
import { limiterMiddleware } from './config/limiter';
import { WAServiceImpl } from './services/wa.service';
import { WAController } from './controllers/wa.controller'; // Import Controller baru
import { BullService } from './services/bull.service';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Inisialisasi Service & Controller
const middlewareService = MiddlewareService.getInstance();
const waService = WAServiceImpl.getInstance();
const bullService = BullService.getInstance();
const waController = new WAController();

// --- 1. GLOBAL MIDDLEWARES ---
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(limiterMiddleware);
app.use(jsonBodyMiddleware);
app.use(handleJsonErrors);

// --- 2. ROUTES ---

// Route: Health Check
app.get('/', waController.healthCheck);

// Route: Kirim Pesan (Dengan Middleware API Key)
// Perhatikan: kodenya jadi sangat pendek dan mudah dibaca!
app.post(
    '/send',
    middlewareService.apiKeyMiddleware.bind(middlewareService),
    waController.sendMessage
);

// --- 3. SERVER STARTUP ---
const server = app.listen(PORT, () => {
    console.log(`Server aman berjalan di http://localhost:${PORT}`);
    // Jalankan koneksi WA saat server start
    waService.connect();
});

// --- 4. GRACEFUL SHUTDOWN ---
const gracefulShutdown = async () => { // <--- 2. UBAH JADI ASYNC
    console.log('\n[SERVER] Mendeteksi Ctrl+C (SIGINT)...');
    console.log('[SERVER] Sedang mematikan layanan...');

    // A. Stop WhatsApp (Jangan hapus sesi)
    waService.stop(false);

    // B. Stop BullMQ & Redis (TAMBAHAN BARU)
    try {
        console.log('[SERVER] Menutup koneksi Redis & Worker...');
        await bullService.close();
        console.log('[SERVER] Redis & Worker berhasil ditutup.');
    } catch (err) {
        console.error('[SERVER] Gagal menutup Redis:', err);
    }

    // C. Stop HTTP Server
    server.close(() => {
        console.log('[SERVER] HTTP Server ditutup.');
        process.exit(0);
    });

    // Fallback force exit jika macet > 3 detik
    setTimeout(() => {
        console.error('[SERVER] Force Shutdown (Timeout)');
        process.exit(1);
    }, 3000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);