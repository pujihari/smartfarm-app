-- Create storage bucket for company logos if it doesn't exist
-- The `public` flag is set to true to allow public access via URLs
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for 'logos' bucket

-- 1. Allow public read access to all files in the 'logos' bucket.
-- This is necessary so that anyone can view the company logos via the public URL.
CREATE POLICY "Public read access for logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');

-- 2. Allow 'Admin' role to upload logos into their own company's folder.
-- The folder name is expected to be the company_id.
-- `(storage.foldername(name))[1]` extracts the first folder name from the path.
CREATE POLICY "Allow admin to upload company logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos' AND
  get_user_role() = 'Admin' AND
  (storage.foldername(name))[1]::bigint = get_current_company_id()
);

-- 3. Allow 'Admin' role to update/replace logos in their own company's folder.
CREATE POLICY "Allow admin to update company logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos' AND
  get_user_role() = 'Admin' AND
  (storage.foldername(name))[1]::bigint = get_current_company_id()
);

-- 4. Allow 'Admin' role to delete logos from their own company's folder.
CREATE POLICY "Allow admin to delete company logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos' AND
  get_user_role() = 'Admin' AND
  (storage.foldername(name))[1]::bigint = get_current_company_id()
);