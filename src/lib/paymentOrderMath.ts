export interface PaymentOrderMathInput {
  gross_amount?: number | null;
  office_fees_percent?: number | null;
  ownership_type?: string | null;
  income_tax?: number | null;
  tax_percent?: number | null;
  office_amount?: number | null;
  client_amount?: number | null;
  court_costs?: number | null;
  social_security?: number | null;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function computePaymentOrderMath(order: PaymentOrderMathInput) {
  const gross = toNumber(order.gross_amount);
  const feePercent = toNumber(order.office_fees_percent);
  const taxPercent = toNumber(order.tax_percent);
  const ownership = order.ownership_type || "cliente";

  const officeGross =
    ownership === "escritorio"
      ? gross
      : round2((gross * feePercent) / 100);

  let taxAmount = toNumber(order.income_tax);
  if (taxAmount <= 0 && taxPercent > 0) {
    taxAmount = round2((officeGross * taxPercent) / 100);
  }

  const storedOfficeAmount = toNumber(order.office_amount);
  let officeNet = storedOfficeAmount;

  if (officeGross > 0 && taxAmount > 0 && storedOfficeAmount >= officeGross) {
    officeNet = round2(officeGross - taxAmount);
  } else if (storedOfficeAmount <= 0 && officeGross > 0) {
    officeNet = round2(officeGross - taxAmount);
  }

  const fallbackClient = round2(
    gross - officeGross - toNumber(order.court_costs) - toNumber(order.social_security),
  );

  const clientAmount =
    ownership === "escritorio"
      ? 0
      : toNumber(order.client_amount) > 0
        ? toNumber(order.client_amount)
        : Math.max(0, fallbackClient);

  return {
    gross: round2(gross),
    officeGross: round2(officeGross),
    taxAmount: round2(Math.max(0, taxAmount)),
    officeNet: round2(Math.max(0, officeNet)),
    clientAmount: round2(Math.max(0, clientAmount)),
  };
}
