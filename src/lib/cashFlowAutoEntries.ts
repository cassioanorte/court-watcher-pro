import { supabase } from "@/integrations/supabase/client";

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

  // Calculate office gross (before tax)
  const officeGross = order.ownership_type === "escritorio"
    ? (Number(order.gross_amount) || 0)
    : Math.round((Number(order.gross_amount) || 0) * (Number(order.office_fees_percent) || 0) / 100 * 100) / 100;

  const taxAmount = Number(order.income_tax) || Math.round(officeGross * (Number(order.tax_percent) || 0) / 100 * 100) / 100;
  const officeNet = Number(order.office_amount) || (officeGross - taxAmount);

  const today = new Date().toISOString().split("T")[0];
  const entries: any[] = [];

  // 1. Revenue: office fees received
  if (officeGross > 0) {
    entries.push({
      tenant_id: tenantId,
      created_by: userId,
      type: "revenue",
      category: "Honorários",
      description: `Recebimento de honorários — ${label}`,
      amount: officeGross,
      date: today,
      status: "confirmed",
      case_id: order.case_id || null,
    });
  }

  // 2. Expense: income tax
  if (taxAmount > 0) {
    entries.push({
      tenant_id: tenantId,
      created_by: userId,
      type: "expense",
      category: "IR sobre Honorários",
      description: `IR (${order.tax_percent || 10.9}%) sobre honorários — ${label}`,
      amount: taxAmount,
      date: today,
      status: "confirmed",
      case_id: order.case_id || null,
    });
  }

  if (entries.length === 0) return { success: true };

  const { error } = await supabase.from("financial_transactions").insert(entries);
  if (error) return { success: false, error: error.message };
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
  const label = `${type.toUpperCase()} — ${processNumber || beneficiaryName || "Sem número"}`;
  // Delete revenue and IR entries that match this order's description pattern
  await supabase
    .from("financial_transactions")
    .delete()
    .eq("tenant_id", tenantId)
    .like("description", `%${label}%`)
    .in("category", ["Honorários", "IR sobre Honorários"]);
}
