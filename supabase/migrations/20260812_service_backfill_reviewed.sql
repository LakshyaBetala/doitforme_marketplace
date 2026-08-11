-- Manual reclassification pass (2026-08-12), run after 20260812_service_listings.sql.
--
-- The pattern-based backfill in that file caught 21 of the obvious cases but
-- left 26 rows mislabelled, because several titles contradict their own body:
--
--   "Need help with python programming"  -> body: "Teaching python programming"
--   "Need help with - Articles and blogs" -> body: "I provide professional
--                                              writing services"
--
-- Those read as demand and are actually supply. Each row below was classified by
-- reading the title AND the description, so this is an explicit id list rather
-- than another regex — there is no pattern that separates these correctly.

-- === Self-promotion: the poster is selling their own labour ===
update public.gigs set listing_type = 'SERVICE' where id in (
  '0b62922c-4cb3-41de-b774-47e67946a718', -- Hi, I can help with anything simple writing
  'ac317623-10d8-4bdf-b4be-3d39619349d4', -- Affordable Video Editing, Writing, Reviews
  '48821237-355a-41d4-a057-435243aed0d3', -- Manual Website & App Testing ("I will test")
  'a3a33d6b-b999-4d5d-ad75-8237a752d8fb', -- Web development and coding ("I offer")
  'afafda4c-e750-4b46-a4dc-c668a907eeea', -- Content writing ("tell me your topic")
  'd4eff92d-0f96-4bb3-929d-c1ddb46f7d50', -- Developed and Testing of Application
  '5171e00f-bf1d-42dc-849f-ef52785aaa1a', -- Data Entry | Typing | Excel | PDF to Word
  'd3b9f2a4-e21f-4ae1-8d0b-e005cfd2ba13', -- I can create a Professional Poster/Template
  '9196a14b-2dac-4f9f-87c6-b6c8cb75bd43', -- Data Entry | Typing | Content | Canva
  'b5c76d87-e5d4-4b36-b064-e4e2f253c13d', -- Explain any diploma in civil subject
  '039d2fef-785d-4c4f-b883-0c76c8271b19', -- Well-Researched Articles & Blogs ("I provide")
  '5d416d0c-7928-4b8c-ac3c-7f0ee8caa2ae', -- "Need help with Articles" -> body offers services
  'dfbc71b2-6605-41c6-bb74-fa1b305e5176', -- "Need help with python" -> body: Teaching python
  '3f7affa1-a3f4-48bc-b749-1d63343d7512', -- "Need help with python" -> body: I do Python
  '999fbc98-1ce5-4158-84bb-a5a2870ac615', -- Python Programmer ("I am a Python Programmer")
  '15daec03-358e-4a3c-9e9f-dce41c0d78c5', -- Python Programmer and Typing Specialist
  '3386ea33-14bc-4e90-b621-e8e3ff184fe8', -- Logo ("I design logos")
  'abb8f42f-74a0-4edf-b356-35091b524c9e'  -- Canvas users bestt ("I make templates")
);

-- === Junk: no real intent on either side. Expire rather than misfile. ===
-- Titles/bodies are literally "Nothing", "Work"/"Want to work", "data entry",
-- and an essay about pollution. These are what the nudge cron would eventually
-- expire anyway; doing it now keeps the feed honest today.
update public.gigs
set status = 'expired', expired_at = now()
where id in (
  'ea57e7d0-ef92-4bb0-a146-7c013a38bb70', -- "Nothing"
  'c05656e9-f1e5-40da-acfe-584045c3b25d', -- "data entry"
  '0240fd74-fa88-4059-bbe8-0c7d405bdeab', -- "Work" / "Want to work"
  '284b09b3-b925-4ba2-b00d-be0570c7b613'  -- "Environment pollution" (essay text)
) and status = 'open';

-- After this runs, the only rows left as open HUSTLE are genuine demand:
--   "Need Social media intern", "Developed Website" (Rs 10,000),
--   and the two "Writing & Content" blog requests.
