-- ============================================================
-- Restore RLS on members using a non-recursive helper table
-- ============================================================

-- 1) Ensure RLS is enabled on members
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Drop the old view that could bypass RLS
DROP VIEW IF EXISTS public.members_view;

-- 2) Helper table to map auth_user_id -> family_id (no recursion)
CREATE TABLE IF NOT EXISTS public.member_access (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  member_id UUID UNIQUE REFERENCES public.members(id) ON DELETE CASCADE
);

ALTER TABLE public.member_access ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read only their own access row
DROP POLICY IF EXISTS "member_access_select_own" ON public.member_access;
CREATE POLICY "member_access_select_own"
  ON public.member_access FOR SELECT
  USING (auth_user_id = auth.uid());

REVOKE ALL ON public.member_access FROM anon;
GRANT SELECT ON public.member_access TO authenticated;

-- 3) Backfill helper table
INSERT INTO public.member_access (auth_user_id, family_id, member_id)
SELECT auth_user_id, family_id, id
FROM public.members
WHERE auth_user_id IS NOT NULL
ON CONFLICT (auth_user_id) DO UPDATE
SET family_id = EXCLUDED.family_id,
    member_id = EXCLUDED.member_id;

-- 4) Sync helper table when members change
CREATE OR REPLACE FUNCTION public.sync_member_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.member_access WHERE auth_user_id = OLD.auth_user_id;
    RETURN OLD;
  END IF;

  IF NEW.auth_user_id IS NULL THEN
    DELETE FROM public.member_access WHERE auth_user_id = OLD.auth_user_id;
    RETURN NEW;
  END IF;

  INSERT INTO public.member_access (auth_user_id, family_id, member_id)
  VALUES (NEW.auth_user_id, NEW.family_id, NEW.id)
  ON CONFLICT (auth_user_id) DO UPDATE
  SET family_id = EXCLUDED.family_id,
      member_id = EXCLUDED.member_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_member_access_insert_update ON public.members;
CREATE TRIGGER sync_member_access_insert_update
AFTER INSERT OR UPDATE OF auth_user_id, family_id ON public.members
FOR EACH ROW EXECUTE FUNCTION public.sync_member_access();

DROP TRIGGER IF EXISTS sync_member_access_delete ON public.members;
CREATE TRIGGER sync_member_access_delete
AFTER DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.sync_member_access();

-- 5) Update helper functions to use member_access
CREATE OR REPLACE FUNCTION public.get_current_user_family_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT family_id FROM public.member_access WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_family_member_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.id
  FROM public.members m
  WHERE m.family_id = (
    SELECT family_id FROM public.member_access WHERE auth_user_id = auth.uid() LIMIT 1
  )
  AND m.family_id IS NOT NULL;
$$;

-- 6) Recreate members policies without recursion
DROP POLICY IF EXISTS "members_select_own" ON public.members;
DROP POLICY IF EXISTS "members_select_family" ON public.members;
DROP POLICY IF EXISTS "members_insert_own" ON public.members;
DROP POLICY IF EXISTS "members_update_family" ON public.members;
DROP POLICY IF EXISTS "members_delete_family" ON public.members;

CREATE POLICY "members_select_own"
  ON public.members FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "members_select_family"
  ON public.members FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND family_id IS NOT NULL
    AND family_id = (
      SELECT family_id FROM public.member_access WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "members_insert_own"
  ON public.members FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      (auth_user_id = auth.uid() AND family_id IS NOT NULL)
      OR
      (auth_user_id IS NULL AND family_id IS NOT NULL AND family_id = (
        SELECT family_id FROM public.member_access WHERE auth_user_id = auth.uid() LIMIT 1
      ))
    )
  );

CREATE POLICY "members_update_family"
  ON public.members FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      auth_user_id = auth.uid()
      OR family_id = (
        SELECT family_id FROM public.member_access WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  )
  WITH CHECK (true);

CREATE POLICY "members_delete_family"
  ON public.members FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND family_id IS NOT NULL
    AND family_id = (
      SELECT family_id FROM public.member_access WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

-- 7) Revoke overly broad grants (keep authenticated access with RLS)
REVOKE ALL ON public.members FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
