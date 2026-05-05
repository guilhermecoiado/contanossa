const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function stripeApiCall(endpoint: string, method: string, body: Record<string, unknown> | null, apiKey: string): Promise<unknown> {
  const auth = btoa(`${apiKey}:`);
  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString() : null,
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
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { subscription_id } = await req.json();
    if (!subscription_id) {
      return new Response(JSON.stringify({ error: 'subscription_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cancelar a subscription imediatamente
    const canceled = await stripeApiCall(`/subscriptions/${subscription_id}/cancel`, 'POST', {}, stripeSecretKey) as Record<string, unknown>;

    return new Response(JSON.stringify({ 
      success: true, 
      subscription_id: canceled.id,
      status: canceled.status 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[cancel-stripe-subscription] Erro:', error);
    
    // Se a subscription não existe ou já foi cancelada, isso não é um erro crítico
    if (error instanceof Error && (error.message.includes('No such subscription') || error.message.includes('does not exist'))) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Subscription não encontrada (pode já ter sido cancelada)'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro ao cancelar subscription' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
