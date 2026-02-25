import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Plays a short chime using Web Audio API when a movement is detected
 * on a case with pending payment orders (RPV/Precatório/Alvará).
 */
function playAlertChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Two-tone chime
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.5);
    });

    // Cleanup context after sounds finish
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // Web Audio not available — silently ignore
  }
}

export function usePaymentMovementAlerts() {
  const { tenantId, role } = useAuth();
  // Cache of case_ids that have pending payment orders
  const watchedCaseIds = useRef<Set<string>>(new Set());

  // Fetch case IDs with pending payment orders
  const refreshWatchedCases = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("payment_orders")
      .select("case_id")
      .eq("tenant_id", tenantId)
      .neq("status", "sacado")
      .neq("status", "rascunho")
      .not("case_id", "is", null);

    const ids = new Set<string>();
    data?.forEach((row) => {
      if (row.case_id) ids.add(row.case_id);
    });
    watchedCaseIds.current = ids;
  }, [tenantId]);

  useEffect(() => {
    // Only for staff/owner
    if (!tenantId || role === "client") return;

    refreshWatchedCases();

    // Refresh watched cases periodically (every 5 min)
    const interval = setInterval(refreshWatchedCases, 5 * 60 * 1000);

    // Subscribe to ALL new movements in the tenant's cases
    const channel = supabase
      .channel("payment-movement-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "movements",
        },
        async (payload) => {
          const movement = payload.new as { case_id: string; title: string; id: string };
          if (!movement?.case_id) return;

          // Check if this case has pending payment orders
          if (!watchedCaseIds.current.has(movement.case_id)) return;

          // Get process number for the toast
          const { data: caseData } = await supabase
            .from("cases")
            .select("process_number")
            .eq("id", movement.case_id)
            .single();

          const processNumber = caseData?.process_number || "Processo";

          // Play sound
          playAlertChime();

          // Show toast
          toast.warning(`⚠️ Movimentação em ${processNumber}`, {
            description: movement.title || "Nova movimentação detectada",
            duration: 15000,
            action: {
              label: "Ver processo",
              onClick: () => {
                window.location.href = `/processos/${movement.case_id}`;
              },
            },
          });
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [tenantId, role, refreshWatchedCases]);
}
