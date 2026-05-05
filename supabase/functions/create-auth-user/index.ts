import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password, user_metadata } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email e senha são obrigatórios',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Variáveis de ambiente não configuradas',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[create-auth-user] Criando usuário com email: ${email}`);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: user_metadata || {},
    });

    if (error) {
      console.error(`[create-auth-user] Erro ao criar: ${error.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[create-auth-user] Usuário criado com sucesso: ${data.user?.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: data.user?.id,
        message: 'Usuário criado com sucesso',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error(`[create-auth-user] Erro: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
