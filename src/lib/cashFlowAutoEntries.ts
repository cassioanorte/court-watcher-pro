import { supabase } from "@/integrations/supabase/client";
import { computePaymentOrderMath } from "@/lib/paymentOrderMath";

interface PaymentOrderForCashFlow {
  id: string;
  type: string;
  process_number: string | null;
  beneficiary_name: string | null;
  office_amount: number;
  income_tax: number;
  tax_percent: number;
  gross_amount: number;
  office_fees_percent: number;
  ownership_type: string;
  case_id: string | null;
}

const emitFinancialDataUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("financial-data-updated"));
  }
};

/**
 * When a payment order is marked as "sacado" (withdrawn/paid),
 * auto-create financial transactions:
 * 1. Revenue entry for the office fees (office_amount before tax)
 * 2. Expense entry for income tax (IR)
 */
export async function createCashFlowEntriesOnSacado(
  order: PaymentOrderForCashFlow,
  tenantId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const label = `${order.type.toUpperCase()} — ${order.process_number || order.beneficiary_name || "Sem número"}`;
  const marker = `[PO:${order.id}]`;
  const math = computePaymentOrderMath(order);

  const today = new Date().toISOString().split("T")[0];
  const entries: any[] = [];

  // 1. Revenue: office fees received
  if (math.officeGross > 0) {
    entries.push({
      tenant_id: tenantId,
      created_by: userId,
      type: "revenue",
      category: "Honorários",
      description: `Recebimento de honorários — ${label} ${marker}`,
      amount: math.officeGross,
      date: today,
      status: "confirmed",
      case_id: order.case_id || null,
    });
  }

  // 2. Expense: income tax
  if (math.taxAmount > 0) {
    entries.push({
      tenant_id: tenantId,
      created_by: userId,
      type: "expense",
      category: "IR sobre Honorários",
      description: `IR (${order.tax_percent || 10.9}%) sobre honorários — ${label} ${marker}`,
      amount: math.taxAmount,
      date: today,
      status: "confirmed",
      case_id: order.case_id || null,
    });
  }

  if (entries.length === 0) return { success: true };

  const { error } = await supabase.from("financial_transactions").insert(entries);
  if (error) return { success: false, error: error.message };

  emitFinancialDataUpdated();
  return { success: true };
}

/**
 * When a payment order is reverted from "sacado" back to another status,
 * remove auto-created financial transactions for that order.
 */
export async function removeCashFlowEntriesOnUnsacado(
  orderId: string,
  processNumber: string | null,
  beneficiaryName: string | null,
  type: string,
  tenantId: string
): Promise<void> {
  const marker = `[PO:${orderId}]`;
  const label = `${type.toUpperCase()} — ${processNumber || beneficiaryName || "Sem número"}`;

  const { data: removedByMarker } = await supabase
    .from("financial_transactions")
    .delete()
    .eq("tenant_id", tenantId)
    .ilike("description", `%${marker}%`)
    .in("category", ["Honorários", "IR sobre Honorários"])
    .select("id");

  if ((removedByMarker?.length || 0) === 0) {
    await supabase
      .from("financial_transactions")
      .delete()
      .eq("tenant_id", tenantId)
      .ilike("description", `%${label}%`)
      .in("category", ["Honorários", "IR sobre Honorários"]);
  }

  emitFinancialDataUpdated();
}

