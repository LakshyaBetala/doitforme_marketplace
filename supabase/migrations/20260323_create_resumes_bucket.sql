-- Create the "resumes" bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Policy 1: Allow public read access (so posters can view applicants' resumes)
CREATE POLICY "Public Read Access Resumes" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'resumes');

-- Policy 2: Allow authenticated users to upload resumes
CREATE POLICY "Auth Uploads Resumes" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'resumes');

-- Policy 3: Allow users to update their own resumes
CREATE POLICY "Users can update own resumes" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy 4: Allow users to delete their own resumes
CREATE POLICY "Users can delete own resumes" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
