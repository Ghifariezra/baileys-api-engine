# WA Gateway API (Baileys + BullMQ)

High-performance WhatsApp Gateway API built with TypeScript. Uses Redis Queue to handle high traffic and prevent WhatsApp bans.

## 🚀 Tech Stack

- **Core:** Node.js, Express, TypeScript
- **WA Library:** @whiskeysockets/baileys
- **Queue:** BullMQ + IORedis
- **Validation:** Zod
- **Security:** Helmet, CORS, Rate Limiting

## 🛠️ Prerequisites

- Node.js (v18+)
- Redis Server (Local or Upstash/Cloud)

## ⚙️ Environment Variables

Create `.env` file:

```env
PORT=3001
NODE_ENV=development
ALLOWED_ORIGIN=http://localhost:3000
REDIS_HOST=your-redis-host
REDIS_PORT=your-redis-port
REDIS_PASSWORD=your-redis-password
API_SECRET_KEY=your-secret-hash
```

## 🏃‍♂️ How to Run

1. Install dependencies: 
   ```bash 
    pnpm install
   ```
2. Run the server:
   ```bash
    pnpm dev
   ```
3. Build for production:
   ```bash
    pnpm build
    pnpm start
   ```

## 🐳 Deployment (Railway)
1. Set env variables in Railway dashboard.
2. Add Volume Mount at `/app/auth_info_baileyst` to persist session.