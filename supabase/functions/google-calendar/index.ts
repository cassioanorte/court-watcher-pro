import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Google credentials not configured");
    }

    // Action: get_auth_url - returns the OAuth URL for the user to authorize
    if (action === "get_auth_url") {
      const { redirect_uri } = params;
      const scope = "https://www.googleapis.com/auth/calendar.events";
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirect_uri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scope);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: exchange_code - exchanges auth code for tokens
    if (action === "exchange_code") {
      const { code, redirect_uri } = params;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error);
      }

      return new Response(JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: refresh_token - refreshes an expired access token
    if (action === "refresh_token") {
      const { refresh_token } = params;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          grant_type: "refresh_token",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error);
      }

      return new Response(JSON.stringify({
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: create_event - creates a Google Calendar event with Meet link
    if (action === "create_event") {
      let { access_token, refresh_token: rt, title, description, start_at, end_at, timezone } = params;

      // Try to create event, refresh token if needed
      const createEvent = async (token: string) => {
        const event = {
          summary: title,
          description: description || "",
          start: { dateTime: start_at, timeZone: timezone || "America/Sao_Paulo" },
          end: { dateTime: end_at, timeZone: timezone || "America/Sao_Paulo" },
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        };

        const res = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
          }
        );

        return { status: res.status, data: await res.json() };
      };

      let result = await createEvent(access_token);

      // If 401, try refreshing the token
      if (result.status === 401 && rt) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            refresh_token: rt,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            grant_type: "refresh_token",
          }),
        });

        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          access_token = refreshData.access_token;
          result = await createEvent(access_token);
        }
      }

      if (result.status >= 400) {
        throw new Error(result.data.error?.message || "Failed to create Google Calendar event");
      }

      const meetLink = result.data.conferenceData?.entryPoints?.find(
        (ep: any) => ep.entryPointType === "video"
      )?.uri;

      return new Response(JSON.stringify({
        event_id: result.data.id,
        html_link: result.data.htmlLink,
        meet_link: meetLink || null,
        new_access_token: access_token !== params.access_token ? access_token : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("google-calendar error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
