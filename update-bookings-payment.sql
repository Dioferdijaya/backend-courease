-- Update tabel bookings untuk menambahkan kolom pembayaran
-- Jalankan query ini di Supabase SQL Editor

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_url TEXT,
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

-- Menambahkan index untuk performa lebih baik
CREATE INDEX IF NOT EXISTS idx_bookings_payment_id ON bookings(payment_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

-- Keterangan status pembayaran:
-- 'unpaid' = belum bayar
-- 'pending' = menunggu pembayaran
-- 'paid' = sudah bayar
-- 'expired' = pembayaran kadaluarsa
-- 'failed' = pembayaran gagal
