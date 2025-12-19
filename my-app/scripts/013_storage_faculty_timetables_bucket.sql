-- Create Supabase Storage bucket for faculty timetable PDFs
-- This bucket stores individual faculty timetables generated during notifications

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'faculty-timetables',
  'faculty-timetables',
  true,  -- Public bucket so faculty can access PDFs via direct link
  5242880,  -- 5MB file size limit per PDF
  ARRAY['application/pdf']  -- Only allow PDF files
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf'];

-- Create storage policies for the bucket
-- Policy 1: Allow service role to upload/delete PDFs
CREATE POLICY "Service role can manage faculty timetable PDFs"
ON storage.objects FOR ALL
USING (bucket_id = 'faculty-timetables')
WITH CHECK (bucket_id = 'faculty-timetables');

-- Policy 2: Allow public read access to PDFs (for WhatsApp links)
CREATE POLICY "Public can view faculty timetable PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'faculty-timetables');

-- Add comment explaining the bucket
COMMENT ON COLUMN storage.buckets.name IS 'faculty-timetables bucket stores individual faculty timetable PDFs generated during WhatsApp notifications. Files are organized by job ID and faculty code. Old PDFs are automatically deleted when new ones are generated.';

-- Note: To manually clean up old PDFs, run:
-- DELETE FROM storage.objects WHERE bucket_id = 'faculty-timetables' AND created_at < NOW() - INTERVAL '30 days';
