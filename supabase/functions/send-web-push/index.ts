import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => (
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
);

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const vapidPublicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY') ?? '';
const vapidPrivateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY') ?? '';
const vapidSubject = Deno.env.get('WEB_PUSH_VAPID_SUBJECT') ?? 'mailto:admin@sonora.local';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ ok: false, error: 'missing_supabase_env' }, 500);
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({ ok: false, error: 'missing_vapid_env' }, 500);
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader) {
    return jsonResponse({ ok: false, error: 'missing_authorization' }, 401);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } }
  });

  const {
    data: { user },
    error: authError
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ ok: false, error: 'invalid_token' }, 401);
  }

  let body: { notification_ids?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  const notificationIds = Array.isArray(body.notification_ids)
    ? [...new Set(body.notification_ids.map((value) => Number(value)).filter((value) => Number.isFinite(value)))]
    : [];

  if (!notificationIds.length) {
    return jsonResponse({ ok: false, error: 'notification_ids_required' }, 400);
  }

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });

  const { data: notifications, error: notificationsError } = await admin
    .from('notifications')
    .select('id, recipient_id, actor_id, title, body, type, entity_type, entity_id')
    .in('id', notificationIds)
    .eq('actor_id', user.id);

  if (notificationsError) {
    return jsonResponse({ ok: false, error: 'notifications_query_failed' }, 500);
  }

  if (!notifications || notifications.length === 0) {
    return jsonResponse({ ok: true, sent: 0, failed: 0, notifications: 0 });
  }

  const recipientIds = [...new Set(
    notifications
      .map((item) => String(item.recipient_id || '').trim())
      .filter(Boolean)
  )];

  if (!recipientIds.length) {
    return jsonResponse({ ok: true, sent: 0, failed: 0, notifications: notifications.length });
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, enabled')
    .in('user_id', recipientIds)
    .eq('enabled', true);

  if (subscriptionsError) {
    return jsonResponse({ ok: false, error: 'subscriptions_query_failed' }, 500);
  }

  if (!subscriptions || subscriptions.length === 0) {
    return jsonResponse({ ok: true, sent: 0, failed: 0, notifications: notifications.length });
  }

  const subscriptionsByUser = new Map<string, Array<{
    id: number;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>>();

  subscriptions.forEach((subscription) => {
    const userId = String(subscription.user_id || '');
    if (!userId) return;
    if (!subscriptionsByUser.has(userId)) subscriptionsByUser.set(userId, []);
    subscriptionsByUser.get(userId)?.push({
      id: Number(subscription.id),
      endpoint: String(subscription.endpoint || ''),
      p256dh: String(subscription.p256dh || ''),
      auth: String(subscription.auth || '')
    });
  });

  let sent = 0;
  let failed = 0;
  const staleSubscriptionIds = new Set<number>();

  for (const notification of notifications) {
    const recipientId = String(notification.recipient_id || '');
    const targetSubscriptions = subscriptionsByUser.get(recipientId) || [];
    if (!targetSubscriptions.length) continue;

    const payload = JSON.stringify({
      title: String(notification.title || 'Sonora'),
      body: String(notification.body || 'Voce recebeu uma nova notificacao.'),
      url: '/?tab=notifications',
      tag: `sonora-notification-${notification.id}`,
      type: notification.type || null,
      entity_type: notification.entity_type || null,
      entity_id: notification.entity_id || null
    });

    for (const subscription of targetSubscriptions) {
      if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) continue;

      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        }, payload, { TTL: 60 });
        sent += 1;
      } catch (error) {
        failed += 1;
        const pushError = error as { statusCode?: number; status?: number };
        const statusCode = Number(pushError?.statusCode || pushError?.status || 0);
        if (statusCode === 404 || statusCode === 410) {
          staleSubscriptionIds.add(subscription.id);
        }
      }
    }
  }

  if (staleSubscriptionIds.size > 0) {
    await admin
      .from('push_subscriptions')
      .update({
        enabled: false,
        updated_at: new Date().toISOString()
      })
      .in('id', Array.from(staleSubscriptionIds));
  }

  return jsonResponse({
    ok: true,
    sent,
    failed,
    notifications: notifications.length,
    subscriptions: subscriptions.length
  });
});

