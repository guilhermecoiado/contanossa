-- ============================================================
-- Migração: TRIGGER para criar primeiro membro ao cadastro
-- ============================================================
-- Cria automaticamente um membro quando um novo usuário é criado no Auth
-- Isso garante que 100% dos novos usuários tenham um registro em members

-- Função que será executada pelo trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_family_id UUID;
  v_username TEXT;
  v_username_base TEXT;
  v_counter INT := 0;
  v_name TEXT;
BEGIN
  -- Extrair nome do user_metadata ou usar email como fallback
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Gerar username a partir do email
  v_username_base := LOWER(SPLIT_PART(NEW.email, '@', 1));
  v_username_base := REGEXP_REPLACE(v_username_base, '[^a-z0-9]', '', 'g');
  v_username := v_username_base;

  -- Garantir que username seja único
  WHILE EXISTS (SELECT 1 FROM public.members WHERE username = v_username) LOOP
    v_counter := v_counter + 1;
    v_username := v_username_base || v_counter;
    
    -- Segurança: evitar loop infinito
    IF v_counter > 1000 THEN
      v_username := v_username_base || NEW.id::TEXT;
    END IF;
  END LOOP;

  -- Criar nova família
  v_family_id := gen_random_uuid();

  -- Inserir o membro (sem restrições RLS porque é SECURITY DEFINER)
  INSERT INTO public.members (
    auth_user_id,
    family_id,
    name,
    email,
    username,
    phone,
    password_hash
  ) VALUES (
    NEW.id,
    v_family_id,
    v_name,
    NEW.email,
    v_username,
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    NULL
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log de erro (pode ser visto no logs do Supabase)
  RAISE LOG 'Erro ao criar membro para usuário %: %', NEW.id, SQLERRM;
  -- Não bloqueia a criação do usuário no Auth, apenas não cria o member
  RETURN NEW;
END;
$$;

-- Criar trigger que executa após inserção em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
