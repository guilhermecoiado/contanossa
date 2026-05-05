import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function stripeApiGet(endpoint: string, apiKey: string): Promise<unknown> {
  const auth = btoa(`${apiKey}:`);
  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Stripe API error');
  }

  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Variáveis de ambiente faltando para verificação.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    const sessionId = body?.session_id ? String(body.session_id) : null;
    let signupId = body?.signup_id ? String(body.signup_id) : null;

    if (!signupId && sessionId) {
      const session = await stripeApiGet(`/checkout/sessions/${sessionId}`, stripeSecretKey) as Record<string, unknown>;
      signupId = (session.client_reference_id as string) ?? ((session.metadata as Record<string, unknown>)?.signup_id as string) ?? null;
    }

    if (!signupId) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível identificar o cadastro.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: signup, error } = await supabase
      .from('pending_signups')
      .select('id, email, selected_plan, status, failure_reason, paid_at, authorized_at')
      .eq('id', signupId)
      .maybeSingle();

    if (error || !signup) {
      return new Response(
        JSON.stringify({ error: 'Cadastro pendente não encontrado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        signup_id: signup.id,
        email: signup.email,
        selected_plan: signup.selected_plan,
        status: signup.status,
        can_login: signup.status === 'authorized',
        failure_reason: signup.failure_reason,
        paid_at: signup.paid_at,
        authorized_at: signup.authorized_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro inesperado na verificação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
