import { describe, it, expect } from "vitest";

// Test the pensão alimentícia calculation logic directly
describe("Pensão Alimentícia - Cálculo", () => {
  const calcular = (renda: number, percentual: number, filhos: number) => {
    const pensaoTotal = renda * (percentual / 100);
    return { pensaoTotal, porFilho: pensaoTotal / filhos };
  };

  it("calcula 30% de R$ 5.000 para 1 filho", () => {
    const result = calcular(5000, 30, 1);
    expect(result.pensaoTotal).toBe(1500);
    expect(result.porFilho).toBe(1500);
  });

  it("divide corretamente entre 3 filhos", () => {
    const result = calcular(6000, 30, 3);
    expect(result.pensaoTotal).toBe(1800);
    expect(result.porFilho).toBe(600);
  });

  it("calcula porcentagem mínima (10%)", () => {
    const result = calcular(10000, 10, 1);
    expect(result.pensaoTotal).toBe(1000);
  });

  it("calcula porcentagem máxima (50%)", () => {
    const result = calcular(10000, 50, 2);
    expect(result.pensaoTotal).toBe(5000);
    expect(result.porFilho).toBe(2500);
  });
});
