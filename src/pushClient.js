const WEB_PUSH_PERMISSION_PROMPT_KEY = 'sonora_web_push_prompted';

const getWebPushPublicKey = () => String(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || '').trim();

const isPushSupportedInBrowser = () => (
  typeof window !== 'undefined'
  && 'Notification' in window
  && 'serviceWorker' in navigator
  && 'PushManager' in window
);

const urlBase64ToUint8Array = (base64String) => {
  const normalized = base64String.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = window.atob(`${normalized}${padding}`);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
};

const requestPermissionOnce = async () => {
  if (!isPushSupportedInBrowser()) return 'default';
  if (Notification.permission !== 'default') return Notification.permission;

  const prompted = window.localStorage.getItem(WEB_PUSH_PERMISSION_PROMPT_KEY) === '1';
  if (prompted) return Notification.permission;

  window.localStorage.setItem(WEB_PUSH_PERMISSION_PROMPT_KEY, '1');
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
};

export const registerWebPushSubscription = async ({ supabase, userId }) => {
  if (!supabase || !userId) return { ok: false, reason: 'missing_context' };
  if (!isPushSupportedInBrowser()) return { ok: false, reason: 'unsupported' };

  const vapidPublicKey = getWebPushPublicKey();
  if (!vapidPublicKey) return { ok: false, reason: 'missing_vapid_public_key' };

  const permission = await requestPermissionOnce();
  if (permission !== 'granted') return { ok: false, reason: 'permission_not_granted' };

  try {
    await navigator.serviceWorker.register('/sw.js');
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }

    const subscriptionJSON = subscription.toJSON();
    const endpoint = String(subscriptionJSON?.endpoint || '').trim();
    const p256dh = String(subscriptionJSON?.keys?.p256dh || '').trim();
    const auth = String(subscriptionJSON?.keys?.auth || '').trim();
    if (!endpoint || !p256dh || !auth) {
      return { ok: false, reason: 'invalid_subscription' };
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert([{
        user_id: String(userId),
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent || null,
        enabled: true,
        last_seen_at: new Date().toISOString()
      }], { onConflict: 'user_id,endpoint' });

    if (error) return { ok: false, reason: 'db_error' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'subscription_failed' };
  }
};

export const sendWebPushNotifications = async ({ supabase, notificationIds }) => {
  if (!supabase || !Array.isArray(notificationIds) || !notificationIds.length) return;

  const ids = [...new Set(notificationIds)]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (!ids.length) return;

  try {
    await supabase.functions.invoke('send-web-push', {
      body: { notification_ids: ids }
    });
  } catch {
    // If the edge function is not deployed yet, do not block app flows.
  }
};
