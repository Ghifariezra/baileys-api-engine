import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { WAServiceImpl } from './wa.service';

export class BullService {
    private static instance: BullService;

    public waQueue: Queue;
    public waWorker: Worker;

    private connection: IORedis;
    private readonly WA_QUEUE_NAME = 'whatsapp-queue';

    /**
     * Private constructor untuk membuat instance BullService.
     * Constructor ini akan melakukan inisialisasi koneksi Redis,
     * setup listener koneksi Redis, membuat Queue (Producer) WA,
     * dan membuat Worker (Consumer) WA.
     */
    private constructor() {
        this.validateEnv();

        // 1. Setup Koneksi Redis
        // Worker membutuhkan koneksi "Blocking", BullMQ akan otomatis menduplikasi 
        // koneksi ini secara internal untuk Worker, jadi aman.
        this.connection = new IORedis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: null, // Wajib untuk BullMQ
            keepAlive: 10000,           // Menjaga koneksi tetap hidup
            retryStrategy(times) {      // Auto reconnect jika Redis putus
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });

        this.setupConnectionListeners();

        // 2. Initialize Queue (Producer)
        this.waQueue = new Queue(this.WA_QUEUE_NAME, {
            connection: this.connection,
            defaultJobOptions: {
                attempts: 3,             // Default: Coba 3x jika gagal
                backoff: {
                    type: 'exponential',
                    delay: 2000,         // Delay retry: 2s, 4s, 8s
                },
                removeOnComplete: {
                    count: 100,          // Simpan 100 log terakhir saja
                    age: 24 * 3600,      // Atau max 24 jam
                },
                removeOnFail: {
                    count: 500,          // Simpan log gagal lebih banyak untuk debug
                }
            }
        });

        // 3. Initialize Worker (Consumer)
        // Logic dipisah ke method 'processJob' biar rapi
        this.waWorker = new Worker(this.WA_QUEUE_NAME, this.processJob.bind(this), {
            connection: this.connection,
            concurrency: 1,              // Wajib 1 untuk WA agar urutan terjaga
            
            // Rate Limiter: Maksimal 1 pesan per 5 detik (Sangat Aman)
            limiter: {
                max: 1,
                duration: 5000,
            },
            lockDuration: 60000, // 60 detik lock
        });

        this.setupWorkerListeners();
    }

    /**
     * Returns a singleton instance of the BullService.
     * The instance is created the first time this method is called,
     * and the same instance is returned on subsequent calls.
     * @returns {BullService} The singleton instance of the BullService.
     */
    public static getInstance(): BullService {
        if (!BullService.instance) {
            BullService.instance = new BullService();
        }
        return BullService.instance;
    }

    /**
     * Logic Utama Pemrosesan Pesan (Worker)
     * Dilengkapi fitur "Humanize" agar aman dari Banned
     */
    private async processJob(job: Job): Promise<boolean> {
        const { number, message } = job.data;
        const jobId = job.id;

        console.log(`[JOB START] #${jobId} Memproses ke: ${number}`);

        try {
            const waService = WAServiceImpl.getInstance();

            // A. Simulasi "Sedang Mengetik..." (Humanize)
            // Pastikan Anda sudah implement sendPresenceUpdate di wa.service.ts
            // Jika belum ada, bisa di-skip atau comment baris ini
            try {
                await waService.sendPresenceUpdate(number, 'composing');
            } catch (e) {
                // Abaikan error presence, jangan gagalkan pengiriman pesan
            }

            // B. Random Jitter (Jeda Acak) 2 - 5 Detik
            // Agar pola pengiriman tidak robotik
            const delay = Math.floor(Math.random() * 3000) + 2000;
            await new Promise(resolve => setTimeout(resolve, delay));

            // C. Kirim Pesan Utama
            await waService.sendMessage(number, message);

            // D. Matikan status "Mengetik"
            try {
                await waService.sendPresenceUpdate(number, 'paused');
            } catch (e) {}

            return true;

        } catch (error: any) {
            console.error(`[JOB ERROR] #${jobId}:`, error.message);
            // Lempar error agar BullMQ tahu job ini gagal dan melakukan Retry
            throw error;
        }
    }

    // --- Helpers ---

    private validateEnv() {
        if (!process.env.REDIS_HOST || !process.env.REDIS_PASSWORD) {
            throw new Error('[CONFIG ERROR] Redis Config Missing!');
        }
    }

    private setupConnectionListeners() {
        this.connection.on('error', (err) => console.error('[REDIS ERROR]:', err.message));
        this.connection.on('connect', () => console.log('[REDIS] Terhubung ke Cloud! 🚀'));
        this.connection.on('reconnecting', () => console.log('[REDIS] Mencoba reconnect...'));
    }

    private setupWorkerListeners() {
        this.waWorker.on('completed', (job) => {
            console.log(`[JOB DONE] #${job.id} Selesai.`);
        });

        this.waWorker.on('failed', (job, err) => {
            console.error(`[JOB FAILED] #${job?.id} Gagal: ${err.message}. Sisa retry: ${job?.attemptsMade}`);
        });
    }

    public async close() {
        console.log('[BULL] Menutup antrean...');
        await this.waQueue.close();
        await this.waWorker.close();
        await this.connection.quit();
        console.log('[BULL] Selesai.');
    }
}