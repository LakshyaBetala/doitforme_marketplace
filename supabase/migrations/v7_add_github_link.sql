-- V7: ADD GITHUB LINK TO GIGS
-- Run this in the Supabase SQL Editor

ALTER TABLE gigs 
ADD COLUMN IF NOT EXISTS github_link TEXT;

COMMENT ON COLUMN gigs.github_link IS 'Optional GitHub repository link for Hustle posts';
