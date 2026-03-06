-- Add category to gigs
ALTER TABLE gigs ADD COLUMN category text;

-- Add preferences to users
ALTER TABLE users ADD COLUMN preferences text[] DEFAULT '{}'::text[];
