import { describe, it, expect } from "vitest";
import { computePaymentOrderMath, PaymentOrderMathInput } from "@/lib/paymentOrderMath";

describe("computePaymentOrderMath", () => {
  it("calcula honorários para tipo cliente com porcentagem", () => {
    const order: PaymentOrderMathInput = {
      gross_amount: 100000,
      office_fees_percent: 20,
      ownership_type: "cliente",
      tax_percent: 15,
    };
    const result = computePaymentOrderMath(order);
    expect(result.gross).toBe(100000);
    expect(result.officeGross).toBe(20000);
    expect(result.taxAmount).toBe(3000);
    expect(result.officeNet).toBe(17000);
  });

  it("calcula tipo escritório (100% dos honorários)", () => {
    const order: PaymentOrderMathInput = {
      gross_amount: 50000,
      ownership_type: "escritorio",
      tax_percent: 10,
    };
    const result = computePaymentOrderMath(order);
    expect(result.officeGross).toBe(50000);
    expect(result.taxAmount).toBe(5000);
    expect(result.officeNet).toBe(45000);
    expect(result.clientAmount).toBe(0);
  });

  it("usa income_tax armazenado quando disponível", () => {
    const order: PaymentOrderMathInput = {
      gross_amount: 80000,
      office_fees_percent: 25,
      ownership_type: "cliente",
      income_tax: 2500,
      tax_percent: 0,
    };
    const result = computePaymentOrderMath(order);
    expect(result.officeGross).toBe(20000);
    expect(result.taxAmount).toBe(2500);
    expect(result.officeNet).toBe(17500);
  });

  it("lida com valores nulos/zero graciosamente", () => {
    const order: PaymentOrderMathInput = {};
    const result = computePaymentOrderMath(order);
    expect(result.gross).toBe(0);
    expect(result.officeGross).toBe(0);
    expect(result.officeNet).toBe(0);
    expect(result.clientAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
  });

  it("calcula client_amount considerando custas e previdência", () => {
    const order: PaymentOrderMathInput = {
      gross_amount: 100000,
      office_fees_percent: 20,
      ownership_type: "cliente",
      court_costs: 5000,
      social_security: 3000,
    };
    const result = computePaymentOrderMath(order);
    // client = 100000 - 20000 - 5000 - 3000 = 72000
    expect(result.clientAmount).toBe(72000);
  });

  it("usa client_amount armazenado quando positivo", () => {
    const order: PaymentOrderMathInput = {
      gross_amount: 100000,
      office_fees_percent: 20,
      ownership_type: "cliente",
      client_amount: 65000,
    };
    const result = computePaymentOrderMath(order);
    expect(result.clientAmount).toBe(65000);
  });
});
