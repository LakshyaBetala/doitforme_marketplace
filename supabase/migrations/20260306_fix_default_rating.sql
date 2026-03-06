-- 1. Remove the default 5.0 rating constraint from the rating column
ALTER TABLE public.users ALTER COLUMN rating DROP DEFAULT;

-- 2. Update existing users with exactly 5.0 rating BUT 0 reviews, back to NULL.
UPDATE public.users 
SET rating = NULL 
WHERE rating_count = 0 
  AND rating = 5.0;
