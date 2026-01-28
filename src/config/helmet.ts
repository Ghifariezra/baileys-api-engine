import helmet from "helmet";

export const helmetMiddleware = helmet({
    // 1. Sembunyikan identitas server (Security by Obscurity)
    // Mencegah header "X-Powered-By: Express" muncul.
    xPoweredBy: false,

    // 2. Anti-Clickjacking
    // Karena ini API, tidak ada alasan endpoint ini dibuka lewat <iframe>/frame.
    // Kita tolak semua usaha embed (DENY).
    xFrameOptions: { action: "deny" },

    // 3. Content Security Policy (CSP)
    // Karena ini cuma API JSON, kita blokir browser agar tidak mencoba load 
    // script/gambar aneh jika tidak sengaja membuka URL ini di browser.
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'none'"], // Blokir semuanya secara default
            scriptSrc: ["'none'"],  // Tidak boleh ada script jalan
            styleSrc: ["'none'"],   // Tidak boleh ada CSS jalan
            // Izinkan koneksi API (jika perlu hit endpoint sendiri)
            connectSrc: ["'self'"],
        },
    },

    // 4. HTTP Strict Transport Security (HSTS)
    // Hanya aktifkan ini jika aplikasi sudah di-deploy dengan HTTPS (SSL).
    // Ini memaksa browser mengingat untuk selalu pakai HTTPS selama 1 tahun.
    strictTransportSecurity: {
        maxAge: 31536000, // 1 Tahun
        includeSubDomains: true,
        preload: true,
    },

    // 5. Mencegah MIME-Type Sniffing
    // Mencegah browser "menebak" tipe file. Browser harus patuh pada Content-Type dari server.
    // Sangat penting untuk API yang return JSON.
    xContentTypeOptions: true,

    // 6. DNS Prefetch Control
    // Mematikan prefetch DNS (kurangi tracking, hemat resource)
    dnsPrefetchControl: { allow: false },

    // 7. Cross-Origin Resource Policy (CORP)
    // Karena API ini dipanggil oleh Next.js (beda port/domain), kita set cross-origin.
    // Jika next.js dan express ada di domain yg sama persis, bisa pakai 'same-site'.
    crossOriginResourcePolicy: { policy: "cross-origin" },
})