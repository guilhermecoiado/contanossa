-- Adicionar DELETE policy para family_transfer_requests
DROP POLICY IF EXISTS "family transfer delete creditor" ON public.family_transfer_requests;
CREATE POLICY "family transfer delete creditor"
  ON public.family_transfer_requests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = creditor_member_id
        AND m.auth_user_id = auth.uid()
    )
  );
