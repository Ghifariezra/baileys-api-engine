import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    WASocket,
    ConnectionState
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { WAService } from '../contract/wa';
// HAPUS IMPORT BOTTLENECK

export class WAServiceImpl implements WAService {
    private static instance: WAServiceImpl;
    private sock: WASocket | undefined;
    private readonly AUTH_FOLDER = 'auth_info_baileys';

    // HAPUS constructor private yang ada Bottleneck-nya
    private constructor() { }

    public static getInstance(): WAServiceImpl {
        if (!WAServiceImpl.instance) {
            WAServiceImpl.instance = new WAServiceImpl();
        }
        return WAServiceImpl.instance;
    }

    /**
     * Memulai koneksi ke WhatsApp
     */
    public async connect(): Promise<void> {
        const { state, saveCreds } = await useMultiFileAuthState(this.AUTH_FOLDER);

        this.sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }) as any,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
        });

        // Event Listener: Update Creds
        this.sock.ev.on('creds.update', saveCreds);

        // Event Listener: Koneksi
        this.sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update));
    }

    // Method ini sekarang LANGSUNG kirim (BullMQ yang akan mengatur kapan manggilnya)
    public async sendMessage(number: string, message: string): Promise<boolean> {
        if (!this.sock) throw new Error('WA Client belum terhubung!');

        const jid = this.formatToJID(number);

        // Simulasi ngetik (Opsional, aman dilakukan di sini karena Worker BullMQ yang nunggu)
        await this.sock.sendPresenceUpdate('composing', jid);
        await new Promise(resolve => setTimeout(resolve, 500));

        await this.sock.sendMessage(jid, { text: message });
        return true;
    }


    /**
     * Method baru untuk Graceful Shutdown
     * @param clearSession Jika true, folder auth akan dihapus (harus scan ulang nanti)
     */
    public stop(clearSession: boolean = false): void {
        console.log('Menghentikan layanan WhatsApp...');

        try {
            // 1. Tutup koneksi socket (tanpa logout ke server WA, cuma putus koneksi lokal)
            // undefined artinya tidak mengirim alasan disconnect khusus
            this.sock?.end(undefined);
            this.sock = undefined;
        } catch (error) {
            console.error('Gagal menutup socket:', error);
        }

        // 2. Hapus folder jika diminta
        if (clearSession) {
            this.removeAuthFolder();
        }
    }

    /**
     * Fitur Logout Manual
     */
    public async logout(): Promise<void> {
        try {
            await this.sock?.logout();
            this.removeAuthFolder();
        } catch (error) {
            console.error('Gagal logout:', error);
        }
    }

    // --- PRIVATE HELPER METHODS (Optimasi Logic) ---

    /**
     * Logic penanganan koneksi dipisah biar rapi
     */
    private handleConnectionUpdate(update: Partial<ConnectionState>) {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\nScan QR Code di bawah ini:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`Koneksi terputus. Reconnect? ${shouldReconnect}`);

            if (shouldReconnect) {
                this.connect(); // Panggil diri sendiri untuk reconnect
            } else {
                console.log('Sesi Logout. Menghapus kredensial dan restart...');
                this.removeAuthFolder();
                this.connect(); // Mulai ulang untuk generate QR baru
            }
        } else if (connection === 'open') {
            console.log('✅ Berhasil terhubung ke WhatsApp!');
        }
    }

    /**
     * Format nomor HP ke JID (628xxx@s.whatsapp.net)
     */
    private formatToJID(number: string): string {
        let formatted = number.replace(/\D/g, ''); // Hapus karakter non-angka
        if (formatted.startsWith('0')) {
            formatted = '62' + formatted.slice(1);
        }
        return formatted + '@s.whatsapp.net';
    }

    /**
     * Hapus folder sesi dengan aman
     */
    private removeAuthFolder() {
        const folderPath = path.resolve(this.AUTH_FOLDER);

        try {
            // 1. Pastikan socket benar-benar mati dulu
            if (this.sock) {
                this.sock.end(undefined);
                this.sock = undefined;
            }

            if (fs.existsSync(folderPath)) {
                // 2. Coba hapus folder
                fs.rmSync(folderPath, { recursive: true, force: true });
                console.log('Folder sesi berhasil dihapus.');
            }
        } catch (error: any) {
            // 3. TANGKAP ERROR EBUSY AGAR SERVER TIDAK CRASH
            if (error.code === 'EBUSY' || error.code === 'EPERM') {
                console.warn('[WARNING] Gagal menghapus folder sesi (EBUSY/Locked).');
                console.warn('Tips: Hapus isi folder "auth_info_baileys" secara manual jika perlu.');

                // Opsional: Coba hapus isi dalamnya saja (file per file)
                try {
                    const files = fs.readdirSync(folderPath);
                    for (const file of files) {
                        try {
                            fs.unlinkSync(path.join(folderPath, file));
                        } catch (e) { }
                    }
                    console.log('[INFO] Isi folder berhasil dikosongkan.');
                } catch (e) {
                    console.error('[ERROR] Gagal mengosongkan folder:', e);
                }

            } else {
                console.error('[ERROR] Gagal reset sesi:', error);
            }
        }
    }

    public async sendPresenceUpdate(number: string, status: 'composing' | 'paused'): Promise<void> {
        // Cek jika socket belum siap
        if (!this.sock) {
            console.warn('[WA] Socket disconnect, skip presence update.');
            return;
        }

        try {
            // Gunakan formatToJID yang sudah ada di class ini
            const jid = this.formatToJID(number);
            await this.sock.sendPresenceUpdate(status, jid);
        } catch (error) {
            console.error('[WA] Gagal kirim presence:', error);
        }
    }
}