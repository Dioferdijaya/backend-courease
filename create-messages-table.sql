-- Create Messages Table for Chat Feature
-- Run this SQL in Supabase SQL Editor

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    sender_role VARCHAR(10) CHECK (sender_role IN ('user', 'admin')),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX idx_messages_booking_id ON messages(booking_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Insert sample messages (optional)
-- Replace booking_id and sender_id with actual IDs from your database
-- INSERT INTO messages (booking_id, sender_id, sender_role, message) 
-- VALUES (1, 1, 'user', 'Halo admin, apakah lapangan tersedia?');
