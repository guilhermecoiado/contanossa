-- Função para criar usuário no Auth
CREATE OR REPLACE FUNCTION public.create_auth_user(
  email_input TEXT,
  password_input TEXT,
  user_name TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, user_id UUID, error_message TEXT) AS $$
DECLARE
  new_user_id UUID;
  error_msg TEXT;
BEGIN
  BEGIN
    -- Tentar criar o usuário no Auth (inserção mínima para compatibilidade entre versões)
    -- Use gen_random_uuid() (pgcrypto) para gerar UUIDs; se não tiver, pode usar uuid_generate_v4()
    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      new_user_id,
      'authenticated',
      'authenticated',
      email_input,
      crypt(password_input, gen_salt('bf')),
      NOW(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      CASE WHEN user_name IS NOT NULL THEN jsonb_build_object('name', user_name) ELSE '{}'::jsonb END,
      NOW(),
      NOW()
    );
    
    RETURN QUERY SELECT TRUE, new_user_id, NULL::TEXT;
  EXCEPTION
    WHEN unique_violation THEN
      -- Usuário já existe
      error_msg := 'User already exists';
      RETURN QUERY SELECT FALSE, NULL::UUID, error_msg;
    WHEN OTHERS THEN
      error_msg := SQLERRM;
      RETURN QUERY SELECT FALSE, NULL::UUID, error_msg;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_auth_user(TEXT, TEXT, TEXT) TO authenticated;
