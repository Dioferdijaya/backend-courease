-- Update users table to add username and phone columns
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Optional: Create index for faster username lookup
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
