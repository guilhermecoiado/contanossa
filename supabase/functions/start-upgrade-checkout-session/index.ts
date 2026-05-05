import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function stripeApiCall(endpoint: string, method: string, body: Record<string, unknown>, apiKey: string) {
  const auth = btoa(`${apiKey}:`);
  const bodyStr = new URLSearchParams();
  
  function flattenParams(obj: Record<string, unknown>, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        flattenParams(value as Record<string, unknown>, fullKey);
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => {
          const arrKey = `${fullKey}[${i}]`;
          if (typeof item === 'object' && item !== null) {
            flattenParams(item as Record<string, unknown>, arrKey);
          } else {
            bodyStr.append(arrKey, String(item));
          }
        });
      } else {
        bodyStr.append(fullKey, String(value));
      }
    }
  }
  
  flattenParams(body);

  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyStr.toString(),
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
    const appUrl = Deno.env.get('APP_URL');
    const fullPriceId = Deno.env.get('STRIPE_PRICE_ID_FULL') || Deno.env.get('STRIPE_PRICE_ID');
    const supabaseUrl = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey || !appUrl || !fullPriceId || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Configuração de ambiente incompleta para upgrade.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { access_token, target_plan } = await req.json();
    if (!access_token) {
      return new Response(
        JSON.stringify({ error: 'Token de sessão ausente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (target_plan !== 'full') {
      return new Response(
        JSON.stringify({ error: 'Upgrade disponível apenas para o plano Completo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: userError } = await supabase.auth.getUser(access_token);

    if (userError || !userData.user?.id || !userData.user.email) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível identificar o usuário para upgrade.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const user = userData.user;
    if (user.user_metadata?.plan === 'full') {
      return new Response(
        JSON.stringify({ error: 'Usuário já está no plano Completo.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const session = await stripeApiCall('/checkout/sessions', 'POST', {
      mode: 'subscription',
      customer_email: user.email,
      'line_items[0][price]': fullPriceId,
      'line_items[0][quantity]': 1,
      allow_promotion_codes: true,
      'payment_method_types[0]': 'card',
      success_url: `${appUrl}/plan?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/plan?upgrade_cancelled=1`,
      'metadata[flow]': 'upgrade',
      'metadata[target_plan]': 'full',
      'metadata[auth_user_id]': user.id,
    }, stripeSecretKey) as { url: string };

    return new Response(
      JSON.stringify({ checkout_url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro inesperado no upgrade' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
