import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

function toHex(buffer: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < buffer.length; i++) {
    hex += ('0' + buffer[i].toString(16)).slice(-2);
  }
  return hex;
}

async function stripeApiGet(endpoint: string, apiKey: string, params?: Record<string, string>): Promise<unknown> {
  const auth = btoa(`${apiKey}:`);
  const url = new URL(`https://api.stripe.com/v1${endpoint}`);
  
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }
  }

  const response = await fetch(url.toString(), {
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

function fromBase64(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function decryptPassword(payload: string, secret: string): Promise<string> {
  const [ivBase64, encryptedBase64] = payload.split(':');
  if (!ivBase64 || !encryptedBase64) {
    throw new Error('Formato inválido da senha criptografada.');
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivBase64) },
    key,
    fromBase64(encryptedBase64),
  );

  return decoder.decode(decrypted);
}

function normalizeUsername(email: string): string {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'usuario';
  const suffix = crypto.randomUUID().slice(0, 6);
  return `${base}${suffix}`;
}

async function ensureMember(supabase: ReturnType<typeof createClient>, userId: string, email: string, name: string, phone: string | null) {
  const { data: existingMember } = await supabase
    .from('members')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (existingMember) {
    return;
  }

  const username = normalizeUsername(email);
  const familyId = crypto.randomUUID();
  const { error: insertError } = await supabase
    .from('members')
    .insert({
      auth_user_id: userId,
      family_id: familyId,
      name,
      email,
      username,
      phone,
      password_hash: null,
    });

  if (insertError) {
    throw new Error(`Falha ao criar membro: ${insertError.message}`);
  }
}

Deno.serve(async (req) => {
  // Log all incoming requests for debugging
  console.log('Webhook request received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  // Log the key used for Supabase client
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const encryptionSecret = Deno.env.get('SIGNUP_ENCRYPTION_SECRET');
  const supabaseUrl = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  console.log('[stripe-webhook] Supabase URL:', supabaseUrl);
  console.log('[stripe-webhook] Service Key prefix:', supabaseServiceKey ? supabaseServiceKey.slice(0, 8) : 'undefined');
  console.log('[stripe-webhook] Service Key length:', supabaseServiceKey ? supabaseServiceKey.length : 0);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const encryptionSecret = Deno.env.get('SIGNUP_ENCRYPTION_SECRET');
    const supabaseUrl = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey || !stripeWebhookSecret || !encryptionSecret || !supabaseUrl || !supabaseServiceKey) {
      return new Response('Configuração incompleta do webhook.', { status: 500 });
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Assinatura Stripe ausente.', { status: 400 });
    }

    // Validate webhook signature
    const payload = await req.text();
    const isValid = await validateStripeSignature(payload, signature, stripeWebhookSecret);
    
    if (!isValid) {
      console.error('Webhook validation failed: signature mismatch');
      return new Response('Webhook inválido: assinatura incorreta', { status: 400 });
    }

    let event: { type: string; data: { object: { id: string; client_reference_id?: string; metadata?: Record<string, string> } } };
    try {
      event = JSON.parse(payload);
    } catch (err) {
      return new Response('Webhook inválido: JSON inválido', { status: 400 });
    }

    if (event.type !== 'checkout.session.completed') {
      return new Response(JSON.stringify({ received: true, ignored: event.type }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const signupId = session.client_reference_id ?? session.metadata?.signup_id;
    const flow = session.metadata?.flow;

    if (flow === 'upgrade') {
      const authUserId = session.metadata?.auth_user_id;
      if (!authUserId) {
        return new Response('auth_user_id ausente no fluxo de upgrade.', { status: 400 });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const updateResult = await supabase.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          plan: 'full',
          upgraded_at: new Date().toISOString(),
          upgrade_source: 'stripe_checkout',
        },
      });

      if (updateResult.error) {
        return new Response(
          JSON.stringify({ error: updateResult.error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ received: true, status: 'upgraded' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!signupId) {
      return new Response('signup_id não encontrado na sessão.', { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: pending, error: pendingError } = await supabase
      .from('pending_signups')
      .select('*')
      .eq('id', signupId)
      .maybeSingle();

    if (pendingError || !pending) {
      return new Response('Cadastro pendente não encontrado.', { status: 404 });
    }

    const selectedPlan = event.data.object.metadata?.selected_plan === 'essential'
      ? 'essential'
      : (pending.selected_plan === 'essential' ? 'essential' : 'full');

    if (pending.status === 'authorized' && pending.auth_user_id) {
      return new Response(JSON.stringify({ received: true, status: 'already_authorized' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expandedSession = await stripeApiGet(`/checkout/sessions/${event.data.object.id}`, stripeSecretKey, {
      'expand[]': 'line_items.data.price',
      'expand[]': 'subscription',
    }) as {
      id: string;
      customer?: string;
      line_items?: { data: Array<{ price?: { id: string } }> };
      subscription?: string;
    };

    const priceId = expandedSession.line_items?.data?.[0]?.price?.id ?? null;
    const subscriptionId = expandedSession.subscription ?? null;

    await supabase
      .from('pending_signups')
      .update({
        status: 'paid',
        selected_plan: selectedPlan,
        stripe_checkout_session_id: event.data.object.id,
        stripe_customer_id: expandedSession.customer ?? null,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        paid_at: new Date().toISOString(),
      })
      .eq('id', pending.id);

    const password = await decryptPassword(pending.encrypted_password, encryptionSecret);

    const createAuthResult = await supabase.auth.admin.createUser({
      email: pending.email,
      password,
      email_confirm: true,
      user_metadata: {
        name: pending.name,
        phone: pending.phone,
        plan: selectedPlan,
        signup_source: 'stripe_checkout',
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: expandedSession.customer ?? null,
      },
    });

    if (createAuthResult.error || !createAuthResult.data.user?.id) {
      await supabase
        .from('pending_signups')
        .update({
          status: 'failed',
          failure_reason: createAuthResult.error?.message ?? 'Falha ao criar usuário no Auth',
        })
        .eq('id', pending.id);

      return new Response('Falha ao criar usuário autorizado.', { status: 500 });
    }

    const authUserId = createAuthResult.data.user.id;
    await ensureMember(supabase, authUserId, pending.email, pending.name, pending.phone ?? null);

    await supabase
      .from('pending_signups')
      .update({
        status: 'authorized',
        auth_user_id: authUserId,
        failure_reason: null,
        authorized_at: new Date().toISOString(),
      })
      .eq('id', pending.id);

    return new Response(JSON.stringify({ received: true, status: 'authorized' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro inesperado no webhook' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
