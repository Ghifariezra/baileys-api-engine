import { z } from 'zod';

// Skema Validasi
export const sendSchema = z.object({
    number: z.string()
        .min(10, "Nomor terlalu pendek")
        .max(15, "Nomor terlalu panjang")
        .regex(/^08[0-9]+$/, "Format nomor harus 08xxx dan angka saja"), // Hanya terima angka
    message: z.string()
        .min(1, "Pesan tidak boleh kosong")
        .max(2000, "Pesan maksimal 2000 karakter"),
    scheduleAt: z.string().datetime().optional()
});