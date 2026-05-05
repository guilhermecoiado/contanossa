CREATE TABLE IF NOT EXISTS public.pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  encrypted_password TEXT NOT NULL,
  selected_plan TEXT NOT NULL DEFAULT 'full' CHECK (selected_plan IN ('essential', 'full')),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'authorized', 'failed', 'expired')),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  auth_user_id UUID,
  failure_reason TEXT,
  paid_at TIMESTAMPTZ,
  authorized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_signups_status ON public.pending_signups(status);
CREATE INDEX IF NOT EXISTS idx_pending_signups_created_at ON public.pending_signups(created_at);

DROP TRIGGER IF EXISTS update_pending_signups_updated_at ON public.pending_signups;
CREATE TRIGGER update_pending_signups_updated_at
BEFORE UPDATE ON public.pending_signups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
