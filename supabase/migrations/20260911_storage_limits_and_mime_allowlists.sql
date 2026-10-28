-- Storage buckets had no size limit and no MIME allowlist. Both are one-line
-- settings that were simply never set, and each one is a live problem.
--
-- 1. STORED XSS ON THE PUBLIC BUCKETS
--
-- `gig-images` and `chat-attachments` are public, and with no allowlist they
-- accept ANY content type — including text/html, image/svg+xml and
-- application/javascript. Supabase serves an object back with the content type
-- it was stored with, so uploading an .html file to a public bucket gets you a
-- working attacker-controlled page hosted on the project's own storage domain,
-- reachable by a permanent public URL. SVG is the same vector with a friendlier
-- extension: it is markup, and it can carry <script>.
--
-- Nothing in the product ever wanted this. Every one of the 878 objects across
-- both public buckets is an image, a PDF or an Office document — verified
-- before writing this, so the allowlists below reject nothing that exists.
--
-- 2. AN UNBOUNDED BUCKET ON A 1 GB PLAN
--
-- Storage is at ~813 MB of the 1 GB free tier: gig-images 324 MB, kyc-ids
-- 241 MB, resumes 205 MB, chat-attachments 43 MB. With no file_size_limit a
-- single upload can be arbitrarily large, and the largest object already stored
-- is 29 MB. lib/imageCompress.ts compresses client-side but fails OPEN by
-- design, so an undecodable file uploads at full size and nothing stops it.
--
-- The limits below are set from the real distribution (mean object size is
-- under 900 kB in every bucket) with generous headroom, so they bound the
-- damage without rejecting normal use.
--
-- Both settings apply to NEW uploads only. No existing object is touched, no
-- URL changes, and nothing has to be migrated.
--
-- Safe to run more than once.

-- Public. Gig photos plus the brief/spec documents posters attach.
-- 25 MB: four objects already exceed 10 MB and they are legitimate.
UPDATE storage.buckets
SET file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/markdown', 'text/plain'
    ]
WHERE id = 'gig-images';

-- Public. Images only — every object in it today is a PNG or a JPEG, and chat
-- has no reason to accept executable or markup content.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
WHERE id = 'chat-attachments';

-- Private. A student ID photo: phone camera output, occasionally a scan.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
WHERE id = 'kyc-ids';

-- Private. Mostly PDF, some photos of a printed CV, a few Office files.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/x-iwork-pages-sffpages',
      'image/jpeg', 'image/png', 'image/webp', 'image/heic'
    ]
WHERE id = 'resumes';

-- Private, currently empty. Company registration paperwork.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
WHERE id = 'verification-docs';
