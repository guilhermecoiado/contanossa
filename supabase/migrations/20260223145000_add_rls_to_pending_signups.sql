-- Enable RLS on pending_signups table
ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- Block direct client access (authenticated users cannot query this table)
-- Edge functions use service_role_key and automatically bypass all RLS policies
CREATE POLICY "block_all_direct_access"
  ON public.pending_signups
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

-- Add comment explaining the RLS setup
COMMENT ON TABLE public.pending_signups IS 'Stores pending user signups via Stripe. RLS enabled to block direct client access. Edge functions using service_role_key bypass RLS automatically.';
