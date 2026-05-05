-- ID público da família para compartilhamento entre usuários
-- Mantém family_id (UUID interno) para regras de família já existentes.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS family_public_id TEXT;

CREATE OR REPLACE FUNCTION public.generate_family_public_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_id TEXT;
BEGIN
  LOOP
    v_id := 'FAM-' || UPPER(SUBSTRING(ENCODE(gen_random_bytes(5), 'hex') FROM 1 FOR 10));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.members
      WHERE family_public_id = v_id
    );
  END LOOP;

  RETURN v_id;
END;
$$;

UPDATE public.members
SET family_public_id = public.generate_family_public_id()
WHERE auth_user_id IS NOT NULL
  AND family_public_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_family_public_id_unique
  ON public.members (family_public_id)
  WHERE family_public_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_family_id UUID;
  v_family_public_id TEXT;
  v_username TEXT;
  v_username_base TEXT;
  v_counter INT := 0;
  v_name TEXT;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_username_base := LOWER(SPLIT_PART(NEW.email, '@', 1));
  v_username_base := REGEXP_REPLACE(v_username_base, '[^a-z0-9]', '', 'g');
  v_username := v_username_base;

  WHILE EXISTS (SELECT 1 FROM public.members WHERE username = v_username) LOOP
    v_counter := v_counter + 1;
    v_username := v_username_base || v_counter;

    IF v_counter > 1000 THEN
      v_username := v_username_base || NEW.id::TEXT;
    END IF;
  END LOOP;

  v_family_id := gen_random_uuid();
  v_family_public_id := public.generate_family_public_id();

  INSERT INTO public.members (
    auth_user_id,
    family_id,
    family_public_id,
    name,
    email,
    username,
    phone,
    password_hash
  ) VALUES (
    NEW.id,
    v_family_id,
    v_family_public_id,
    v_name,
    NEW.email,
    v_username,
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    NULL
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Erro ao criar membro para usuário %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;