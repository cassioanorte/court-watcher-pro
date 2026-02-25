import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user, tenantId } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager?.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
  };

  const subscribe = useCallback(async () => {
    if (!user?.id || !tenantId || !isSupported) return false;
    setLoading(true);

    try {
      // Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setLoading(false);
        return false;
      }

      // Get VAPID public key from server
      const { data: vapidData, error: vapidErr } = await supabase.functions.invoke("manage-push", {
        body: { action: "get-vapid-public-key" },
      });
      if (vapidErr || !vapidData?.publicKey) {
        console.error("Failed to get VAPID key:", vapidErr);
        setLoading(false);
        return false;
      }

      // Subscribe to push
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      // Send subscription to server
      const subJson = subscription.toJSON();
      const { error: subErr } = await supabase.functions.invoke("manage-push", {
        body: {
          action: "subscribe",
          user_id: user.id,
          tenant_id: tenantId,
          subscription: {
            endpoint: subJson.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth,
            },
          },
        },
      });

      if (subErr) {
        console.error("Failed to save subscription:", subErr);
        setLoading(false);
        return false;
      }

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Push subscription error:", err);
      setLoading(false);
      return false;
    }
  }, [user?.id, tenantId, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager?.getSubscription();
      if (subscription) {
        await supabase.functions.invoke("manage-push", {
          body: {
            action: "unsubscribe",
            user_id: user.id,
            endpoint: subscription.endpoint,
          },
        });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Unsubscribe error:", err);
    }
    setLoading(false);
  }, [user?.id]);

  return { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe };
}
