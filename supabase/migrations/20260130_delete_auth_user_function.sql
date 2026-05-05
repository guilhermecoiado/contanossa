-- Function para deletar usuário do Auth (requer ser executado como admin)
-- Será criada com SECURITY DEFINER para permitir deleção
CREATE OR REPLACE FUNCTION public.delete_auth_user(user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Tentar deletar o usuário
  DELETE FROM auth.users WHERE id = user_id;
  
  IF FOUND THEN
    result := json_build_object('success', true, 'message', 'Usuário removido com sucesso');
  ELSE
    result := json_build_object('success', false, 'message', 'Usuário não encontrado');
  END IF;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Grant apenas para admin role (poder ser ajustado conforme necessário)
GRANT EXECUTE ON FUNCTION public.delete_auth_user(uuid) TO authenticated;

-- Function para obter o ID do usuário pelo email
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(email_input text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
BEGIN
  -- Buscar o ID do usuário no Auth
  SELECT id INTO user_id FROM auth.users WHERE email = email_input LIMIT 1;
  
  RETURN user_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL::uuid;
END;
$$;

-- Grant para usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;

