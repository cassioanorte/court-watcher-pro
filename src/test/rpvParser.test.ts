import { describe, it, expect } from "vitest";
import { parseMultiplePayments } from "@/lib/rpvParser";

describe("rpvParser - múltiplos honorários", () => {
  it("separa sucumbência e contratuais com espécie/data base/valor", () => {
    const text = `
      Processo Eletrônico: Sim
      Ação de Execução: 5000041-39.2018.8.21.0114
      Total Requisitado (R$): 165.347,15
      Requerido: INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS
      Beneficiário: FABIANO ISMAEL MODEL (600.752.680-19)
      Espécie: Precatório - Original
      Data Base: 08/2025
      Valor Requisitado (Principal Corrigido + Juros + Selic): 116.477,41
      Destaque dos Honorários Contratuais: Sim
      Honorários
      SPIER & ANORTE SOCIEDADE DE ADVOGADOS (18.382.306/0001-15)
      Espécie: RPV - Original
      Tipo Honorário: Honorários de Sucumbência
      Data Base: 08/2025
      Valor Requisitado (Principal Corrigido + Juros + Selic): 3.972,24
      SPIER & ANORTE SOCIEDADE DE ADVOGADOS (18.382.306/0001-15)
      Espécie: Precatório - Original
      Tipo Honorário: Honorários Contratuais
      Data Base: 08/2025
      Valor Requisitado (Principal Corrigido + Juros + Selic): 44.897,50
    `;

    const result = parseMultiplePayments(text);

    expect(result.has_separated_fees).toBe(true);
    expect(result.entries).toHaveLength(2);

    const suc = result.entries.find((e) => e.fee_type === "sucumbencia");
    const cont = result.entries.find((e) => e.fee_type === "contratuais");

    expect(suc?.gross_amount).toBeCloseTo(3972.24, 2);
    expect(suc?.type).toBe("rpv");
    expect(suc?.reference_date).toBe("2025-08-01");
    expect(suc?.beneficiary_name).toContain("SPIER");

    expect(cont?.gross_amount).toBeCloseTo(44897.5, 2);
    expect(cont?.type).toBe("precatorio");
    expect(cont?.reference_date).toBe("2025-08-01");
    expect(cont?.beneficiary_name).toContain("SPIER");
  });

  it("lê o formato real do PDF com entidades HTML e separa os dois honorários", () => {
    const realPdfText = `
      Requisição N°: 26000001777
      Processo Eletrônico: Sim
      Aço de Execuç0: 5000041-39.2018.8.21.0114
      Total Requisitado (R$): 165.347,15
      Requerido: INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS
      Beneficiário: FABIANO ISMAEL MODEL (600.752.680-19)
      Espécie: Precatório - Original
      Data Base: 08/2025
      Valor Requisitado (Principal Corrigido + Juros + Selic): 116.477,41
      Destaque dos Honorários Contratuais: Sim
      Honorários
      SPIER &#x26; ANORTE SOCIEDADE DE ADVOGADOS (18.382.306/0001-15)
      Espécie: RPV - Original
      Tipo Honorário: Honorários de Sucumbência
      Data Base: 08/2025
      Valor Requisitado (Principal Corrigido + Juros + Selic): 3.972,24
      SPIER &#x26; ANORTE SOCIEDADE DE ADVOGADOS (18.382.306/0001-15)
      Espécie: Precatório - Original
      Tipo Honorário: Honorários Contratuais
      Data Base: 08/2025
      Valor Requisitado (Principal Corrigido + Juros + Selic): 44.897,50
    `;

    const result = parseMultiplePayments(realPdfText);

    expect(result.has_separated_fees).toBe(true);
    expect(result.entries).toHaveLength(2);

    const suc = result.entries.find((e) => e.fee_type === "sucumbencia");
    const cont = result.entries.find((e) => e.fee_type === "contratuais");

    expect(suc?.gross_amount).toBeCloseTo(3972.24, 2);
    expect(suc?.type).toBe("rpv");
    expect(suc?.reference_date).toBe("2025-08-01");

    expect(cont?.gross_amount).toBeCloseTo(44897.5, 2);
    expect(cont?.type).toBe("precatorio");
    expect(cont?.reference_date).toBe("2025-08-01");

    expect(suc?.beneficiary_name).toContain("SPIER");
    expect(cont?.beneficiary_name).toContain("SPIER");
    expect(result.process_number).toBe("5000041-39.2018.8.21.0114");
    expect(result.entity).toBe("INSS");
  });

  it("separa honorários mesmo com texto achatado sem dois-pontos", () => {
    const flattenedPdfText = `
      Requisição N° 26000001777 Processo Eletrônico Sim Aço de Execuç0 5000041-39.2018.8.21.0114
      Total Requisitado (R$) 165.347,15 Requerido INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS
      Destaque dos Honorários Contratuais Sim Honorários
      SPIER & ANORTE SOCIEDADE DE ADVOGADOS (18.382.306/0001-15)
      Espécie RPV - Original Tipo Honorário Honorários de Sucumbência Data Base 08/2025
      Valor Requisitado (Principal Corrigido + Juros + Selic) 3.972,24
      SPIER & ANORTE SOCIEDADE DE ADVOGADOS (18.382.306/0001-15)
      Espécie Precatório - Original Tipo Honorário Honorários Contratuais Data Base 08/2025
      Valor Requisitado (Principal Corrigido + Juros + Selic) 44.897,50
    `;

    const result = parseMultiplePayments(flattenedPdfText);

    expect(result.has_separated_fees).toBe(true);
    expect(result.entries.length).toBeGreaterThanOrEqual(2);

    const suc = result.entries.find((e) => e.fee_type === "sucumbencia");
    const cont = result.entries.find((e) => e.fee_type === "contratuais");

    expect(suc?.gross_amount).toBeCloseTo(3972.24, 2);
    expect(cont?.gross_amount).toBeCloseTo(44897.5, 2);
    expect(suc?.reference_date).toBe("2025-08-01");
    expect(cont?.reference_date).toBe("2025-08-01");
  });

  it("separa corretamente o precatório real do processo 5002377", () => {
    const miltonSpierPdfText = `
      Requisição N°: 25000026819
      Processo Eletrônico: Sim
      Aço de Execuç0: 5002377-69.2025.8.21.0114
      Total Requisitado (R$): 189.240,58
      Requerido: INSTITUTO NACIONAL DO SEGURO SOCIAL - INSS
      Beneficiário: MILTON SPIER (886.345.660-72)
      Espécie: Precatório - Original
      Data Base: 10/2023
      Valor Requisitado (Principal Corrigido + Juros + Selic): 123.842,46
      Destaque dos Honorários Contratuais: Sim
      SPIER &#x26; ANORTE SOCIEDADE DE ADVOGADOS (18.382.306/0001-15)
      Espécie: RPV - Original
      Tipo Honorário: Honorários de Sucumbência
      Data Base: 10/2023
      Valor Requisitado (Principal Corrigido + Juros + Selic): 12.322,79
      SPIER &#x26; ANORTE SOCIEDADE DE ADVOGADOS (18.382.306/0001-15)
      Espécie: Precatório - Original
      Tipo Honorário: Honorários Contratuais
      Data Base: 10/2023
      Valor Requisitado (Principal Corrigido + Juros + Selic): 53.075,33
    `;

    const result = parseMultiplePayments(miltonSpierPdfText);

    expect(result.has_separated_fees).toBe(true);
    expect(result.process_number).toBe("5002377-69.2025.8.21.0114");
    expect(result.entity).toBe("INSS");

    const suc = result.entries.find((e) => e.fee_type === "sucumbencia");
    const cont = result.entries.find((e) => e.fee_type === "contratuais");

    expect(suc?.gross_amount).toBeCloseTo(12322.79, 2);
    expect(suc?.type).toBe("rpv");
    expect(suc?.reference_date).toBe("2023-10-01");

    expect(cont?.gross_amount).toBeCloseTo(53075.33, 2);
    expect(cont?.type).toBe("precatorio");
    expect(cont?.reference_date).toBe("2023-10-01");
  });
});
