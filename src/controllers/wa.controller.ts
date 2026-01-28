import { Request, Response } from 'express';
import { BullService } from '../services/bull.service';
import { sendSchema } from '../schema/send.schema';

export class WAController {
    private bullService: BullService;

    constructor() {
        this.bullService = BullService.getInstance();
    }

    public healthCheck = (req: Request, res: Response) => {
        res.send('WA Service with BullMQ is Running!');
    };

    public sendMessage = async (req: Request, res: Response): Promise<Response> => {
        const validation = sendSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: validation.error.issues[0].message
            });
        }

        const { number, message, scheduleAt } = validation.data;

        try {
            // --- LOGIC BARU: ADD TO QUEUE ---

            // Hitung delay jika ada jadwal (scheduleAt)
            let delay = 0;
            if (scheduleAt) {
                const diff = new Date(scheduleAt).getTime() - new Date().getTime();
                if (diff > 0) delay = diff;
            }

            console.log(`[QUEUE] Memproses pesan ke: ${number}`);

            // Masukkan ke Redis
            const job = await this.bullService.waQueue.add('send-message', {
                number,
                message
            }, {
                delay: delay, // Fitur delay native BullMQ!
                attempts: 3,  // Kalau gagal, coba 3x
                backoff: {
                    type: 'exponential',
                    delay: 1000 // Jeda retry nambah terus (1s, 2s, 4s...)
                },
                removeOnComplete: true, // Hapus dari memori Redis kalau sukses (hemat RAM)
                removeOnFail: false // Simpan kalau gagal buat dicek
            });

            return res.json({
                success: true,
                message: delay > 0 ? 'Pesan dijadwalkan!' : 'Pesan masuk antrean!',
                jobId: job.id,
                status: 'queued'
            });

        } catch (error: any) {
            console.error('[QUEUE ERROR]:', error);
            return res.status(500).json({ success: false, error: 'Redis Error' });
        }
    };
}