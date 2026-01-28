import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis'; // Import Class-nya saja
import { WAServiceImpl } from './wa.service'; // Sesuaikan path

export class BullService {
    private static instance: BullService;

    // Public agar bisa diakses Controller (this.bullService.waQueue.add)
    public waQueue: Queue;
    public waWorker: Worker;

    // Private connection agar tidak bocor
    private connection: IORedis;
    private readonly WA_QUEUE_NAME = 'whatsapp-queue';

    private constructor() {
        // 1. Validasi ENV di sini (atau di server.ts)
        if (!process.env.REDIS_HOST || !process.env.REDIS_PASSWORD) {
            throw new Error('Redis Config Missing!');
        }

        // 2. Buat Koneksi Redis (Di dalam constructor)
        this.connection = new IORedis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD,
            // Username dihapus (sesuai diskusi kita tadi)
            maxRetriesPerRequest: null,
            connectTimeout: 10000,
        });

        // 3. Listener Error Koneksi
        this.connection.on('error', (err) => {
            console.error('[REDIS ERROR]:', err.message);
        });
        this.connection.on('connect', () => {
            console.log('[REDIS] Berhasil terhubung ke Cloud! 🚀');
        });

        // 4. Initialize Queue (Producer)
        this.waQueue = new Queue(this.WA_QUEUE_NAME, { connection: this.connection });

        // 5. Initialize Worker (Consumer)
        this.waWorker = new Worker(this.WA_QUEUE_NAME, async (job: Job) => {
            console.log(`[JOB START] Memproses pesan ke: ${job.data.number}`);

            const waService = WAServiceImpl.getInstance();
            // Kirim pesan
            await waService.sendMessage(job.data.number, job.data.message);

            return true;
        }, {
            connection: this.connection,

            // 1. TETAP SATU (Wajib)
            concurrency: 1,

            // 2. RATE LIMITER (Jantung Keamanan)
            // Ini menjaga agar WA tidak memblokir Anda karena spam
            limiter: {
                max: 1,         // Maksimal 1 pesan
                duration: 2000, // Per 2 detik
            },

            // 3. LOCK DURATION (Penting untuk File Besar)
            // Defaultnya 30 detik. Jika Anda kirim Video 50MB, mungkin butuh >30 detik.
            // Jika lock habis sebelum kirim selesai, job akan dianggap gagal dan diulang worker lain.
            // Set ke 60 detik atau lebih biar aman.
            lockDuration: 60000,

            // 4. CLEANUP (Hemat RAM Redis)
            // Jangan simpan ribuan riwayat job sukses di Redis (Mahal/Penuh).
            // Simpan 100 terakhir saja, sisanya hapus otomatis.
            removeOnComplete: {
                count: 100, // Simpan 100 job sukses terakhir
                age: 3600,  // Atau hapus yang lebih tua dari 1 jam
            },

            // Simpan failure lebih banyak untuk keperluan debugging log
            removeOnFail: {
                count: 1000,
            }
        });

        // Worker Events
        this.waWorker.on('completed', (job) => {
            console.log(`[JOB DONE] Job ${job.id} selesai.`);
        });

        this.waWorker.on('failed', (job, err) => {
            console.error(`[JOB FAILED] Job ${job?.id}: ${err.message}`);
        });
    }

    public static getInstance(): BullService {
        if (!BullService.instance) {
            BullService.instance = new BullService();
        }
        return BullService.instance;
    }

    // Optional: Method untuk menutup koneksi (Clean Shutdown)
    public async close() {
        await this.waQueue.close();
        await this.waWorker.close();
        await this.connection.quit();
    }
}