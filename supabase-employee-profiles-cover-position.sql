-- Add cover and profile picture placement to employee_profiles (run in Supabase SQL Editor).
-- Profile picture: 0–100 horizontal and vertical (object-position in circle).
-- Cover photo: 0–100 vertical (object-position for wide crop).
ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS profile_picture_position_x INTEGER DEFAULT 50;
ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS profile_picture_position_y INTEGER DEFAULT 50;
ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS cover_photo_position INTEGER DEFAULT 50;
