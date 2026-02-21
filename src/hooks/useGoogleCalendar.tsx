import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export const useGoogleCalendar = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const storageKey = user ? `google_calendar_tokens_${user.id}` : null;

  const getTokens = useCallback((): GoogleTokens | null => {
    if (!storageKey) return null;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [storageKey]);

  const saveTokens = useCallback((tokens: Partial<GoogleTokens>) => {
    if (!storageKey) return;
    const existing = getTokens();
    const merged = { ...existing, ...tokens };
    localStorage.setItem(storageKey, JSON.stringify(merged));
  }, [storageKey, getTokens]);

  useEffect(() => {
    setIsConnected(!!getTokens());
  }, [getTokens]);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const redirect_uri = `https://court-watcher-pro.lovable.app/google-calendar-callback`;
      const { data, error } = await supabase.functions.invoke("google-calendar", {
        body: { action: "get_auth_url", redirect_uri },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      window.location.href = data.url;
    } catch (err) {
      console.error("Failed to get auth URL:", err);
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
      setIsConnected(false);
    }
  }, [storageKey]);

  const createMeetEvent = useCallback(async (params: {
    title: string;
    description?: string;
    start_at: string;
    end_at: string;
  }): Promise<{ meet_link: string | null; event_id: string } | null> => {
    const tokens = getTokens();
    if (!tokens) return null;

    try {
      const { data, error } = await supabase.functions.invoke("google-calendar", {
        body: {
          action: "create_event",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          ...params,
        },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      // Update access token if refreshed
      if (data.new_access_token) {
        saveTokens({
          access_token: data.new_access_token,
          expires_at: Date.now() + 3600 * 1000,
        });
      }

      return { meet_link: data.meet_link, event_id: data.event_id };
    } catch (err) {
      console.error("Failed to create Meet event:", err);
      // If auth failed, disconnect
      if (String(err).includes("invalid_grant") || String(err).includes("Token has been expired")) {
        disconnect();
      }
      throw err;
    }
  }, [getTokens, saveTokens, disconnect]);

  return { isConnected, loading, connect, disconnect, createMeetEvent };
};
