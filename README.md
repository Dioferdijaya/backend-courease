# Backend Courease

Backend API untuk aplikasi Courease - platform booking kursus online.

## Tech Stack

- Node.js 18+
- Express.js
- Supabase (Database & Auth)
- Socket.io (Real-time messaging)
- Mayar.id (Payment Gateway)
- Winston (Logging)

## Setup Local Development

1. **Clone repository**
   ```bash
   git clone https://github.com/Dioferdijaya/backend-courease.git
   cd backend-courease
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` dan isi dengan credentials yang sesuai:
   - `SUPABASE_URL` dan `SUPABASE_ANON_KEY` - Wajib! Dapatkan dari dashboard Supabase
   - `JWT_SECRET` - Generate random string untuk keamanan
   - `MAYAR_API_KEY` - Untuk payment gateway
   - `FRONTEND_URL` - URL frontend untuk CORS

4. **Run development server**
   ```bash
   npm start
   ```

Server akan berjalan di `http://localhost:3000`

## Deploy ke Railway

### Environment Variables yang Diperlukan:

**WAJIB:**
- `SUPABASE_URL` - URL Supabase project Anda
- `SUPABASE_ANON_KEY` - Anonymous key dari Supabase
- `JWT_SECRET` - Secret key untuk JWT token

**Optional:**
- `PORT` - Default: 3000
- `NODE_ENV` - Default: production
- `FRONTEND_URL` - URL frontend untuk CORS
- `MAYAR_API_KEY` - Untuk payment gateway
- `LOKI_HOST` - Untuk centralized logging

### Langkah Deploy:

1. Push code ke GitHub
2. Connect repository ke Railway
3. Set environment variables di Railway dashboard
4. Deploy otomatis akan berjalan

## API Endpoints

### Authentication
- `POST /register` - Register user baru
- `POST /register-admin` - Register admin
- `POST /login` - Login user/admin

### Courses
- `GET /courses` - Get all courses
- `POST /courses` - Create course (admin only)
- `GET /courses/:id` - Get course detail
- `PUT /courses/:id` - Update course (admin only)
- `DELETE /courses/:id` - Delete course (admin only)

### Bookings
- `POST /bookings` - Create booking
- `GET /bookings` - Get user bookings
- `GET /bookings/:id` - Get booking detail
- `PUT /bookings/:id` - Update booking status

### Payments
- `POST /payment` - Create payment
- `POST /payment-callback` - Payment callback from Mayar.id

### Messaging (Socket.io)
- Real-time chat antara user dan admin

## Troubleshooting

### Error: "supabaseUrl is required"
- Pastikan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` sudah di-set di environment variables

### CORS Error
- Set `FRONTEND_URL` dengan URL frontend yang benar
- Jika deploy di Vercel, pastikan URL Vercel sudah ditambahkan di array `allowedOrigins` di server.js (line ~20)
- Edit `allowedOrigins` array dan ganti `'https://your-vercel-app.vercel.app'` dengan URL Vercel Anda yang sebenarnya

### Cara Setup CORS untuk Vercel
1. Buka [server.js](server.js) line 20-24
2. Ganti `'https://your-vercel-app.vercel.app'` dengan URL Vercel frontend Anda
3. Commit dan push ke GitHub
4. Railway akan auto-deploy

**Contoh:**
```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'https://courease-frontend.vercel.app', // URL Vercel Anda
  process.env.FRONTEND_URL
].filter(Boolean);
```

## License

ISC
