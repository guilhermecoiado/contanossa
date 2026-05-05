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

  console.log('[stripeApiCall] Request to:', endpoint);
  console.log('[stripeApiCall] Encoded body:', bodyStr.toString());

  try {
    const fetchResponse = await fetch(`https://api.stripe.com/v1${endpoint}`, {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyStr.toString(),
    });

    console.log('[stripeApiCall] Response status:', fetchResponse.status);
    console.log('[stripeApiCall] Response headers:', {
      contentType: fetchResponse.headers.get('content-type'),
      contentLength: fetchResponse.headers.get('content-length'),
    });

    if (!fetchResponse.ok) {
      let errorData;
      try {
        errorData = await fetchResponse.json();
        console.error('[stripeApiCall] Stripe error response:', errorData);
      } catch (e) {
        const text = await fetchResponse.text();
        console.error('[stripeApiCall] Could not parse error as JSON, raw text:', text);
        throw new Error(`Stripe API error (${fetchResponse.status}): ${text}`);
      }
      throw new Error(errorData.error?.message || 'Stripe API error');
    }

    const result = await fetchResponse.json();
    console.log('[stripeApiCall] Success response:', { id: result.id, url: result.url });
    return result;
  } catch (e) {
    console.error('[stripeApiCall] Exception caught:', e instanceof Error ? e.message : String(e));
    throw e;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function encryptPassword(password: string, secret: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM' },
      false,
      ['encrypt'],
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(password),
    );

    const result = `${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
    console.log('[encryptPassword] Password encrypted successfully');
    return result;
  } catch (e) {
    console.error('[encryptPassword] Error:', e);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const appUrl = Deno.env.get('APP_URL');
    const fallbackPriceId = Deno.env.get('STRIPE_PRICE_ID');
    const essentialPriceId = Deno.env.get('STRIPE_PRICE_ID_ESSENTIAL');
    const fullPriceId = Deno.env.get('STRIPE_PRICE_ID_FULL');
    const encryptionSecret = Deno.env.get('SIGNUP_ENCRYPTION_SECRET');
    const supabaseUrl = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('[start-checkout-session] Env check:', {
      hasStripeKey: !!stripeSecretKey,
      hasAppUrl: !!appUrl,
      hasEncSecret: !!encryptionSecret,
      hasSbUrl: !!supabaseUrl,
      hasSbKey: !!supabaseServiceKey,
    });

    if (!stripeSecretKey || !appUrl || !encryptionSecret || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: 'Variáveis de ambiente faltando (STRIPE_SECRET_KEY, APP_URL, SIGNUP_ENCRYPTION_SECRET, SB_URL, SB_SERVICE_ROLE_KEY).',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '');
    const name = String(body?.name ?? '').trim();
    const phone = body?.phone ? String(body.phone).trim() : null;
    const selectedPlan = body?.selected_plan === 'essential' ? 'essential' : 'full';
    const priceId = selectedPlan === 'essential'
      ? (essentialPriceId || fallbackPriceId)
      : (fullPriceId || fallbackPriceId);

    console.log('[start-checkout-session] Request:', { email, name, selectedPlan, priceId });

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'Price ID do Stripe não configurado para o plano selecionado.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: 'Nome, email e senha são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter ao menos 6 caracteres.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: alreadyAuthorized } = await supabase
      .from('pending_signups')
      .select('id, status')
      .eq('email', email)
      .eq('status', 'authorized')
      .maybeSingle();

    if (alreadyAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Este email já possui cadastro autorizado. Faça login.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const encryptedPassword = await encryptPassword(password, encryptionSecret);

    console.log('[start-checkout-session] Preparing pending signup...');
    const { data: pending, error: pendingError } = await supabase
      .from('pending_signups')
      .upsert(
        {
          email,
          name,
          phone,
          encrypted_password: encryptedPassword,
          selected_plan: selectedPlan,
          status: 'pending_payment',
          auth_user_id: null,
          failure_reason: null,
          paid_at: null,
          authorized_at: null,
        },
        { onConflict: 'email' },
      )
      .select('id')
      .single();

    if (pendingError || !pending?.id) {
      console.log('[start-checkout-session] Pending signup error:', pendingError?.message);
      return new Response(
        JSON.stringify({ error: pendingError?.message ?? 'Falha ao preparar cadastro.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[start-checkout-session] Pending signup created:', pending.id);

    console.log('[start-checkout-session] Creating Stripe session...');
    const session = await stripeApiCall('/checkout/sessions', 'POST', {
      mode: 'subscription',
      customer_email: email,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
      allow_promotion_codes: true,
      'payment_method_types[0]': 'card',
      success_url: `${appUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/login?signup_cancelled=1`,
      client_reference_id: pending.id,
      'metadata[signup_id]': pending.id,
      'metadata[selected_plan]': selectedPlan,
    }, stripeSecretKey) as { id: string; url: string };

    console.log('[start-checkout-session] Stripe session created:', session.id);

    await supabase
      .from('pending_signups')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', pending.id);

    console.log('[start-checkout-session] Success, returning checkout URL');
    return new Response(
      JSON.stringify({
        checkout_url: session.url,
        signup_id: pending.id,
        selected_plan: selectedPlan,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[start-checkout-session] Caught error:', {
      message,
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.name : typeof error,
    });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
