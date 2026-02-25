import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== Web Push Crypto Utilities =====

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateVapidKeys() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return {
    publicKey: uint8ArrayToBase64Url(new Uint8Array(publicRaw)),
    privateKey: privateJwk.d!,
  };
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyD: string,
  publicKeyRaw: string
) {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key for signing
  const privateKeyJwk = {
    kty: "EC",
    crv: "P-256",
    d: privateKeyD,
    x: publicKeyRaw.length > 0 ? "" : "", // will be derived
  };

  // We need both x and y from the public key
  const pubBytes = base64UrlToUint8Array(publicKeyRaw);
  // Uncompressed public key: 0x04 || x (32 bytes) || y (32 bytes)
  const x = uint8ArrayToBase64Url(pubBytes.slice(1, 33));
  const y = uint8ArrayToBase64Url(pubBytes.slice(33, 65));
  privateKeyJwk.x = x;
  (privateKeyJwk as any).y = y;

  const key = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format if needed
  const sigBytes = new Uint8Array(signature);
  let sigB64: string;
  if (sigBytes.length === 64) {
    sigB64 = uint8ArrayToBase64Url(sigBytes);
  } else {
    // Already raw format from Web Crypto
    sigB64 = uint8ArrayToBase64Url(sigBytes);
  }

  return `${unsignedToken}.${sigB64}`;
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const localPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  // Import subscriber's public key
  const subscriberPubBytes = base64UrlToUint8Array(p256dhKey);
  const subscriberPubKey = await crypto.subtle.importKey(
    "raw",
    subscriberPubBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPubKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Auth secret
  const authBytes = base64UrlToUint8Array(authSecret);

  // Salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive IKM
  const ikmInfo = encoder.encode("WebPush: info\0");
  const ikmInfoFull = new Uint8Array(ikmInfo.length + subscriberPubBytes.length + localPublicRaw.length);
  ikmInfoFull.set(ikmInfo);
  ikmInfoFull.set(subscriberPubBytes, ikmInfo.length);
  ikmInfoFull.set(localPublicRaw, ikmInfo.length + subscriberPubBytes.length);

  const ikmKey = await crypto.subtle.importKey("raw", authBytes, { name: "HKDF" }, false, ["deriveBits"]);
  const prk = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: sharedSecret, info: ikmInfoFull },
    ikmKey,
    256
  ));

  // Derive content encryption key (CEK)
  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"]);
  const cekBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    prkKey,
    128
  ));

  // Derive nonce
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const nonceBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    prkKey,
    96
  ));

  // Pad and encrypt payload
  const payloadBytes = encoder.encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // delimiter
  paddedPayload[payloadBytes.length + 1] = 0; // padding

  const aesKey = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBits },
    aesKey,
    paddedPayload
  ));

  // Build aes128gcm record
  const recordSize = new ArrayBuffer(4);
  new DataView(recordSize).setUint32(0, 4096);
  const header = new Uint8Array(salt.length + 4 + 1 + localPublicRaw.length);
  header.set(salt);
  header.set(new Uint8Array(recordSize), salt.length);
  header[salt.length + 4] = localPublicRaw.length;
  header.set(localPublicRaw, salt.length + 5);

  const body = new Uint8Array(header.length + encrypted.length);
  body.set(header);
  body.set(encrypted, header.length);

  return { encrypted: body, salt, localPublicKey: localPublicRaw };
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<boolean> {
  try {
    const payloadStr = JSON.stringify(payload);
    const { encrypted } = await encryptPayload(payloadStr, subscription.p256dh, subscription.auth);

    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey, vapidPublicKey);
    const vapidPubBytes = base64UrlToUint8Array(vapidPublicKey);
    const p65 = uint8ArrayToBase64Url(vapidPubBytes);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Authorization": `vapid t=${jwt}, k=${p65}`,
        "TTL": "86400",
        "Urgency": "high",
      },
      body: encrypted,
    });

    if (response.status === 201 || response.status === 200) {
      return true;
    }

    // 410 Gone or 404 means subscription expired
    if (response.status === 410 || response.status === 404) {
      console.log(`[send-push] Subscription expired: ${subscription.endpoint.substring(0, 60)}...`);
      return false;
    }

    console.error(`[send-push] Push failed with status ${response.status}: ${await response.text()}`);
    return false;
  } catch (err) {
    console.error("[send-push] Error sending push:", err);
    return false;
  }
}

// ===== Main Handler =====

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    // ===== GET OR CREATE VAPID KEYS =====
    if (action === "get-vapid-public-key") {
      let { data: keys } = await supabase.from("vapid_keys").select("public_key").limit(1).maybeSingle();

      if (!keys) {
        const newKeys = await generateVapidKeys();
        const { data: inserted, error } = await supabase
          .from("vapid_keys")
          .insert({ public_key: newKeys.publicKey, private_key: newKeys.privateKey })
          .select("public_key")
          .single();
        if (error) throw error;
        keys = inserted;
      }

      return new Response(JSON.stringify({ publicKey: keys.public_key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== SUBSCRIBE =====
    if (action === "subscribe") {
      const { subscription, user_id, tenant_id } = body;
      if (!subscription?.endpoint || !user_id || !tenant_id) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase.from("push_subscriptions").upsert({
        tenant_id,
        user_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,endpoint" });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== UNSUBSCRIBE =====
    if (action === "unsubscribe") {
      const { endpoint, user_id } = body;
      await supabase.from("push_subscriptions").delete().eq("user_id", user_id).eq("endpoint", endpoint);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== SEND PUSH TO USER =====
    if (action === "send") {
      const { target_user_id, title, body: msgBody, url, tag } = body;
      if (!target_user_id || !title) {
        return new Response(JSON.stringify({ error: "Missing target_user_id or title" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get VAPID keys
      const { data: vapidData } = await supabase.from("vapid_keys").select("public_key, private_key").limit(1).single();
      if (!vapidData) {
        return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user's subscriptions
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", target_user_id);

      if (!subs || subs.length === 0) {
        return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = { title, body: msgBody || "", url: url || "/portal-cliente", tag: tag || "billing" };
      let sent = 0;

      for (const sub of subs) {
        const ok = await sendPushNotification(
          sub,
          payload,
          vapidData.public_key,
          vapidData.private_key,
          "mailto:noreply@leximperium.app"
        );
        if (ok) sent++;
        else {
          // Remove expired subscriptions
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }

      return new Response(JSON.stringify({ sent, total: subs.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== SEND PUSH TO ALL TENANT USERS =====
    if (action === "send-to-tenant") {
      const { tenant_id, title, body: msgBody, url, tag } = body;
      if (!tenant_id || !title) {
        return new Response(JSON.stringify({ error: "Missing tenant_id or title" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: vapidData } = await supabase.from("vapid_keys").select("public_key, private_key").limit(1).single();
      if (!vapidData) {
        return new Response(JSON.stringify({ sent: 0, reason: "no_vapid_keys" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("tenant_id", tenant_id);

      if (!subs || subs.length === 0) {
        return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = { title, body: msgBody || "", url: url || "/", tag: tag || "payment-movement" };
      let sent = 0;

      for (const sub of subs) {
        const ok = await sendPushNotification(
          sub,
          payload,
          vapidData.public_key,
          vapidData.private_key,
          "mailto:noreply@leximperium.app"
        );
        if (ok) sent++;
        else {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }

      return new Response(JSON.stringify({ sent, total: subs.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[manage-push] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
