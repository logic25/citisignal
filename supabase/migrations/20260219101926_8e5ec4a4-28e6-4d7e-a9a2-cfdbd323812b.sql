-- Fix property-documents storage policies to enforce ownership
DROP POLICY IF EXISTS "Users can view their property documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload property documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their property documents" ON storage.objects;

-- Property documents: owner-based access via property_documents table linkage
-- Files are stored with property_id prefix, so we validate ownership through properties table
CREATE POLICY "Users can view their own property documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'property-documents' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.property_documents pd
      JOIN public.properties p ON p.id = pd.property_id
      WHERE p.user_id = auth.uid()
      AND pd.file_url LIKE '%' || name
    )
  );

CREATE POLICY "Users can upload to property documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-documents' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their own property documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-documents' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.property_documents pd
      JOIN public.properties p ON p.id = pd.property_id
      WHERE p.user_id = auth.uid()
      AND pd.file_url LIKE '%' || name
    )
  );

-- Fix work-order-photos: restrict to property owners
DROP POLICY IF EXISTS "Anyone can view work order photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload work order photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own work order photos" ON storage.objects;

-- Work order photos: owner-based access via work_orders -> properties
CREATE POLICY "Users can view work order photos for their properties"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'work-order-photos' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      JOIN public.properties p ON p.id = wo.property_id
      WHERE p.user_id = auth.uid()
      AND wo.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Users can upload work order photos for their properties"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'work-order-photos' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      JOIN public.properties p ON p.id = wo.property_id
      WHERE p.user_id = auth.uid()
      AND wo.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Users can delete work order photos for their properties"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'work-order-photos' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      JOIN public.properties p ON p.id = wo.property_id
      WHERE p.user_id = auth.uid()
      AND wo.id::text = (storage.foldername(name))[1]
    )
  );

-- Make work-order-photos private
UPDATE storage.buckets SET public = false WHERE id = 'work-order-photos';