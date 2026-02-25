/**
 * RPV/Precatório PDF Parser - Extrai dados financeiros de documentos judiciais
 * Funciona 100% client-side, sem IA, usando regex sobre o texto extraído do PDF via pdfjs-dist.
 */

export interface RpvData {
  type: "rpv" | "precatorio" | null;
  gross_amount: number | null;
  office_fees_percent: number | null;
  office_amount: number | null;
  client_amount: number | null;
  court_costs: number | null;
  social_security: number | null;
  income_tax: number | null;
  beneficiary_name: string | null;
  beneficiary_cpf: string | null;
  process_number: string | null;
  court: string | null;
  entity: string | null;
  reference_date: string | null;
  expected_payment_date: string | null;
  ownership_type?: string;
  fee_type?: string;
}

export interface MultiPaymentResult {
  entries: RpvData[];
  process_number: string | null;
  entity: string | null;
  total_requisitado: number | null;
  has_separated_fees: boolean;
}

function parseMoney(str: string): number {
  // "1.234,56" or "1234,56" or "1234.56" -> number
  // Remove R$ and whitespace
  const clean = str.replace(/R\$\s*/gi, "").trim();
  // Brazilian format: 1.234,56
  if (clean.includes(",")) {
    return parseFloat(clean.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return parseFloat(clean) || 0;
}

function parseDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

type NormalizeOptions = {
  preserveLineBreaks?: boolean;
};

function normalizeExtractedText(text: string, options: NormalizeOptions = {}): string {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/&#x26;|&amp;/gi, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[‐‑‒–—]/g, "-");

  if (options.preserveLineBreaks) {
    return normalized
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function normalizeForMatch(text: string): string {
  return normalizeExtractedText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s:/.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferFeeType(text: string): "contratuais" | "sucumbencia" | null {
  const normalized = normalizeForMatch(text);
  if (normalized.includes("sucumb")) return "sucumbencia";
  if (normalized.includes("contrat")) return "contratuais";
  return null;
}

function extractCpf(text: string): string | null {
  // CPF after label
  const match = text.match(/CPF[:\s]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i);
  if (match) return match[1];
  // CPF after dash (e.g. "NOME - 123.456.789-00")
  const dashMatch = text.match(/[-–]\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/);
  if (dashMatch) return dashMatch[1];
  // Standalone CPF pattern
  const standalone = text.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
  return standalone ? standalone[1] : null;
}

function extractProcessNumber(text: string): string | null {
  // CNJ format: 0000000-00.0000.0.00.0000
  const cnj = text.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
  if (cnj) return cnj[1];
  // Variations without dots
  const cnjAlt = text.match(/(\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4})/);
  if (cnjAlt) return cnjAlt[1];
  // Numbered process references
  const procMatch = text.match(/[Pp]rocesso[\s:nN°º]*\s*(\d[\d.\-\/]+\d)/);
  if (procMatch) return procMatch[1];
  return null;
}

function extractMoneyValue(text: string, ...patterns: RegExp[]): number | null {
  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) {
      const val = parseMoney(match[1]);
      if (val > 0) return val;
    }
  }
  return null;
}

export function parseRpvText(text: string): RpvData {
  const t = normalizeExtractedText(text);

  const tMatch = normalizeForMatch(t);

  // Determine type using first occurrence in the text to avoid RPV mentions
  // in honorários sections overriding a precatório document type.
  let type: "rpv" | "precatorio" | null = null;
  const idxPrecatorio = tMatch.search(/\bprecatorio\b/);
  const idxRpv = tMatch.search(/\brpv\b|requisicao de pequeno valor/);

  if (idxPrecatorio >= 0 && idxRpv >= 0) {
    type = idxPrecatorio <= idxRpv ? "precatorio" : "rpv";
  } else if (idxPrecatorio >= 0) {
    type = "precatorio";
  } else if (idxRpv >= 0) {
    type = "rpv";
  }

  // Beneficiary name
  let beneficiary_name: string | null = null;
  const benefPatterns = [
    // "Requerente: NOME" or "Autor: NOME" etc, stop at dash+CPF, comma, or newline
    /(?:benefici[aá]rio|autor|requerente|credor|exequente|interessado)[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\s]+?)(?:\s*[-–]\s*\d{3}[\.\d]*|\s*CPF|\s*[,;]|\s*\d{3}\.\d{3}|$)/i,
    // "NOME - CPF" pattern (name before dash+CPF)
    /([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\s]{3,50}?)\s*[-–]\s*\d{3}\.\d{3}\.\d{3}-\d{2}/i,
    /(?:nome)[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\s]{3,50})/i,
  ];
  for (const pat of benefPatterns) {
    const m = t.match(pat);
    if (m) { beneficiary_name = m[1].trim(); break; }
  }

  // CPF
  const beneficiary_cpf = extractCpf(t);

  // Process number
  const process_number = extractProcessNumber(t);

  // Court
  let court: string | null = null;
  const courtPatterns = [
    /(?:vara|juízo|ju[ií]zo|tribunal)[:\s]+([^\n,;]{5,60})/i,
    /(\d+[ªaº]?\s*(?:vara|turma)[^\n,;]{0,40})/i,
  ];
  for (const pat of courtPatterns) {
    const m = t.match(pat);
    if (m) { court = m[1].trim(); break; }
  }

  // Entity (debtor)
  let entity: string | null = null;
  const entityPatterns = [
    /(?:entidade devedora|devedor|réu|executado|ente devedor)[:\s]+([^\n,;]{3,60})/i,
    /(?:contra|em face de)[:\s]+([^\n,;]{3,60})/i,
  ];
  for (const pat of entityPatterns) {
    const m = t.match(pat);
    if (m) { entity = m[1].trim(); break; }
  }
  // Common entity detection
  if (!entity) {
    if (/INSS/i.test(t)) entity = "INSS";
    else if (/União Federal/i.test(t)) entity = "União Federal";
    else if (/Fazenda Nacional/i.test(t)) entity = "Fazenda Nacional";
  }

  // Money values - try multiple patterns
  const gross_amount = extractMoneyValue(t,
    /(?:total\s+requisitado)(?:\s*\([^)]*\))?[:\s]*R?\$?\s*([\d.,]+)/i,
    /(?:valor\s+total\s+devido)[^)]*\)\s*([\d.,]+)/i,
    /(?:valor\s+total\s+devido)[^\d]*([\d.,]+)/i,
    /(?:valor\s+(?:bruto|total|principal|l[ií]quido\s+da\s+requisi[çc][ãa]o|da\s+requisi[çc][ãa]o|requisitado))(?:\s*\([^)]*\))?[:\s]*R?\$?\s*([\d.,]+)/i,
    /(?:total\s+(?:bruto|geral|da\s+requisi[çc][ãa]o))(?:\s*\([^)]*\))?[:\s]*R?\$?\s*([\d.,]+)/i,
    /(?:montante|quantia)[:\s]*R?\$?\s*([\d.,]+)/i,
  );

  const court_costs = extractMoneyValue(t,
    /(?:custas?\s+(?:judiciais?|processuais?))[:\s]*R?\$?\s*([\d.,]+)/i,
    /(?:custas)[:\s]*R?\$?\s*([\d.,]+)/i,
  );

  const social_security = extractMoneyValue(t,
    /(?:contribui[çc][ãa]o\s+previdenci[áa]ria|INSS\s+retido|previdência)[:\s]*R?\$?\s*([\d.,]+)/i,
    /(?:PSS|contrib\.?\s*prev\.?)[:\s]*R?\$?\s*([\d.,]+)/i,
  );

  const income_tax = extractMoneyValue(t,
    /(?:imposto\s+de\s+renda|IR(?:RF)?|IRPF)[:\s]*R?\$?\s*([\d.,]+)/i,
    /(?:IR\s+retido|imposto\s+retido)[:\s]*R?\$?\s*([\d.,]+)/i,
  );

  let office_fees_percent: number | null = null;
  const feeMatch = t.match(/(?:honor[áa]rios?)[:\s]*(\d+(?:[.,]\d+)?)\s*%/i);
  if (feeMatch) office_fees_percent = parseFloat(feeMatch[1].replace(",", "."));

  let office_amount = extractMoneyValue(t,
    /(?:honor[áa]rios?\s+(?:advocat[íi]cios?|contratuais?|sucumbenciais?))[:\s]*R?\$?\s*([\d.,]+)/i,
    /(?:honor[áa]rios?)[:\s]*R?\$?\s*([\d.,]+)/i,
  );

  let client_amount = extractMoneyValue(t,
    /(?:valor\s+(?:líquido|l[ií]quido)\s+(?:do\s+)?(?:cliente|autor|beneficiário))[:\s]*R?\$?\s*([\d.,]+)/i,
    /(?:l[ií]quido\s+(?:do\s+)?(?:autor|benefici[áa]rio))[:\s]*R?\$?\s*([\d.,]+)/i,
  );

  // Auto-calculate missing fields
  if (gross_amount && office_fees_percent && !office_amount) {
    office_amount = Math.round(gross_amount * office_fees_percent / 100 * 100) / 100;
  }
  if (gross_amount && office_amount && !client_amount) {
    const deductions = (court_costs || 0) + (social_security || 0) + (income_tax || 0);
    client_amount = Math.round((gross_amount - office_amount - deductions) * 100) / 100;
  }

  // Dates
  let reference_date: string | null = null;
  const refDateMatch = t.match(/(?:data\s+(?:base|do\s+c[áa]lculo|de\s+refer[êe]ncia))[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
  if (refDateMatch) reference_date = parseDate(refDateMatch[1]);
  if (!reference_date) {
    const refMonthYearMatch = t.match(/(?:data\s+(?:base|do\s+c[áa]lculo|de\s+refer[êe]ncia))[:\s]*(\d{2})\/(\d{4})/i);
    if (refMonthYearMatch) reference_date = `${refMonthYearMatch[2]}-${refMonthYearMatch[1]}-01`;
  }

  let expected_payment_date: string | null = null;
  const expDateMatch = t.match(/(?:previs[ãa]o\s+(?:de\s+)?pagamento|data\s+(?:de\s+)?pagamento|pagamento\s+(?:em|previsto))[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
  if (expDateMatch) expected_payment_date = parseDate(expDateMatch[1]);
  // Try "pagamento em MM/YYYY" format
  if (!expected_payment_date) {
    const mmYyyy = t.match(/pagamento\s+em\s+(\d{2})\/(\d{4})/i);
    if (mmYyyy) expected_payment_date = `${mmYyyy[2]}-${mmYyyy[1]}-01`;
  }

  return {
    type,
    gross_amount,
    office_fees_percent,
    office_amount,
    client_amount,
    court_costs,
    social_security,
    income_tax,
    beneficiary_name,
    beneficiary_cpf,
    process_number,
    court,
    entity,
    reference_date,
    expected_payment_date,
  };
}

/**
 * Parse documents with multiple payment entries (e.g. precatórios with separate 
 * honorários contratuais + sucumbência + beneficiário).
 * Works with flat text from pdfjs-dist (no reliable newlines).
 */
export function parseMultiplePayments(text: string): MultiPaymentResult {
  const normalizedText = normalizeExtractedText(text);
  const normalizedWithBreaks = normalizeExtractedText(text, { preserveLineBreaks: true });
  const singleResult = parseRpvText(normalizedText);
  const process_number = singleResult.process_number;
  const entity = singleResult.entity;

  // Extract total requisitado
  const totalMatch = normalizedText.match(/Total\s+Requisitado\s*\(?R?\$?\)?\s*:?\s*([\d.,]+)/i);
  const total_requisitado = totalMatch ? parseMoney(totalMatch[1]) : singleResult.gross_amount;

  // Detect explicit statement that fees are separated
  const hasDestaque = /Destaque\s+dos\s+Honor[áa]rios\s+Contratuais\s*:\s*Sim/i.test(normalizedWithBreaks);

  const feeSections: { index: number; fee_type: "contratuais" | "sucumbencia" }[] = [];

  const addFeeSection = (index: number, fee_type: "contratuais" | "sucumbencia") => {
    if (index < 0) return;
    const exists = feeSections.some(
      (section) => section.fee_type === fee_type && Math.abs(section.index - index) < 80
    );
    if (!exists) feeSections.push({ index, fee_type });
  };

  // Strategy 1: sections that contain "Tipo Honorário"
  const tipoHonorRegex = /Tipo\s*(?:de\s*)?Honor[^\n]{0,40}(?::|\s)\s*/gi;
  let tipoMatch: RegExpExecArray | null;
  while ((tipoMatch = tipoHonorRegex.exec(normalizedWithBreaks)) !== null) {
    const windowText = normalizedWithBreaks.slice(tipoMatch.index, tipoMatch.index + 480);
    const feeType = inferFeeType(windowText);
    if (!feeType) continue;
    if (!/Valor\s+Requisitado/i.test(windowText)) continue;
    addFeeSection(tipoMatch.index, feeType);
  }

  // Strategy 2 (fallback): explicit fee labels close to "Valor Requisitado"
  if (feeSections.length < 2) {
    const feeLabelRegex = /Honor[áa]rios?\s+(?:de\s+)?(Sucumb[êe]ncia|Contratuais?)/gi;
    let feeLabelMatch: RegExpExecArray | null;

    while ((feeLabelMatch = feeLabelRegex.exec(normalizedWithBreaks)) !== null) {
      const windowText = normalizedWithBreaks.slice(feeLabelMatch.index, feeLabelMatch.index + 480);
      if (!/Valor\s+Requisitado/i.test(windowText)) continue;

      const feeType = /sucumb/i.test(feeLabelMatch[1]) ? "sucumbencia" : "contratuais";
      addFeeSection(feeLabelMatch.index, feeType);
    }
  }

  feeSections.sort((a, b) => a.index - b.index);

  if (feeSections.length === 0) {
    // No explicit honorário sections found — return single result
    return {
      entries: [singleResult],
      process_number,
      entity,
      total_requisitado,
      has_separated_fees: false,
    };
  }

  const entries: RpvData[] = [];

  for (let i = 0; i < feeSections.length; i++) {
    const startIdx = feeSections[i].index;
    const nextIdx = i + 1 < feeSections.length ? feeSections[i + 1].index : normalizedWithBreaks.length;

    // Capture context before and after the section marker
    const contextStart = Math.max(0, startIdx - 1000);
    const contextEnd = Math.min(normalizedWithBreaks.length, nextIdx + 320);
    const blockWithContext = normalizedWithBreaks.substring(contextStart, contextEnd);
    const blockAfterType = normalizedWithBreaks.substring(startIdx, nextIdx);
    const headerContext = normalizedWithBreaks.substring(
      contextStart,
      Math.min(normalizedWithBreaks.length, startIdx + 260)
    );

    const fee_type = feeSections[i].fee_type;

    // Extract espécie (RPV/Precatório)
    let type: "rpv" | "precatorio" | null = null;
    let especieLabel: string | null = null;

    const especieRegex = /Esp[^:\n]{0,20}(?::|\s)\s*(RPV|Precat[^\s\n]{0,10}rio)/gi;
    const especieBeforeMarker = normalizedWithBreaks.substring(
      contextStart,
      Math.min(normalizedWithBreaks.length, startIdx + 40)
    );
    const especieBeforeMatches = [...especieBeforeMarker.matchAll(especieRegex)];

    if (especieBeforeMatches.length > 0) {
      especieLabel = especieBeforeMatches[especieBeforeMatches.length - 1][1];
    }

    if (!especieLabel) {
      const especieAfterMatches = [...blockAfterType.slice(0, 260).matchAll(especieRegex)];
      if (especieAfterMatches.length > 0) {
        especieLabel = especieAfterMatches[0][1];
      }
    }

    if (especieLabel) {
      type = /RPV/i.test(especieLabel) ? "rpv" : "precatorio";
    } else if (singleResult.type) {
      type = singleResult.type;
    }

    // Extract valor requisitado (per fee block)
    let gross_amount = extractMoneyValue(
      blockAfterType,
      /Valor\s+Requisitado(?:\s*\([^)]*\))?\s*(?::|\s)\s*R?\$?\s*([\d.,]+)/i,
      /Valor\s+Requisitado[^\d]{0,40}([\d]{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2})?)/i,
    );
    if (!gross_amount) {
      gross_amount = extractMoneyValue(
        blockWithContext,
        /Valor\s+Requisitado(?:\s*\([^)]*\))?\s*(?::|\s)\s*R?\$?\s*([\d.,]+)/i,
        /Valor\s+Requisitado[^\d]{0,40}([\d]{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2})?)/i,
      );
    }

    if (!gross_amount) continue;

    // Extract office/beneficiary name + CNPJ/CPF
    let beneficiary_name: string | null = null;
    let beneficiary_cpf: string | null = null;

    const officeCnpjPattern = /([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç0-9][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç0-9\s&.,'\/-]{5,160}?)\s*\((\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\)\s*(?:Esp[ée]cie|Tipo\s*(?:de\s*)?Honor|Valor\s+Requisitado)/i;
    const officeCpfPattern = /([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç0-9][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç0-9\s&.,'\/-]{5,160}?)\s*\((\d{3}\.\d{3}\.\d{3}-\d{2})\)\s*(?:Esp[ée]cie|Tipo\s*(?:de\s*)?Honor|Valor\s+Requisitado)/i;

    const officeMatch =
      headerContext.match(officeCnpjPattern) ||
      headerContext.match(officeCpfPattern) ||
      blockWithContext.match(officeCnpjPattern) ||
      blockWithContext.match(officeCpfPattern);

    if (officeMatch) {
      beneficiary_name = officeMatch[1].replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
      beneficiary_cpf = officeMatch[2];
    } else {
      const prevWindow = normalizedWithBreaks.substring(Math.max(0, startIdx - 1200), startIdx + 120);
      const officeWithDocRegex = /([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç0-9][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç0-9\s&.,'\/-]{5,160}?)\s*\((\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})\)/gi;
      let officeWithDocMatch: RegExpExecArray | null;
      let lastOfficeWithDoc: RegExpExecArray | null = null;

      while ((officeWithDocMatch = officeWithDocRegex.exec(prevWindow)) !== null) {
        lastOfficeWithDoc = officeWithDocMatch;
      }

      if (lastOfficeWithDoc) {
        beneficiary_name = lastOfficeWithDoc[1].replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
        beneficiary_cpf = lastOfficeWithDoc[2];
      }
    }

    // Data base (month/year)
    let reference_date: string | null = null;
    const dataBaseMatch =
      blockAfterType.match(/Data\s+Base\s*(?::|\s)\s*(\d{2})\/(\d{4})/i) ||
      blockWithContext.match(/Data\s+Base\s*(?::|\s)\s*(\d{2})\/(\d{4})/i);
    if (dataBaseMatch) reference_date = `${dataBaseMatch[2]}-${dataBaseMatch[1]}-01`;

    entries.push({
      type,
      gross_amount,
      office_fees_percent: null,
      office_amount: gross_amount,
      client_amount: 0,
      court_costs: null,
      social_security: null,
      income_tax: null,
      beneficiary_name,
      beneficiary_cpf,
      process_number,
      court: null,
      entity,
      reference_date,
      expected_payment_date: null,
      ownership_type: "escritorio",
      fee_type,
    });
  }

  // Deduplicate possible overlapping matches
  const dedupedEntries: RpvData[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.fee_type || ""}:${entry.gross_amount || 0}:${entry.reference_date || ""}:${entry.beneficiary_name || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedEntries.push(entry);
  }

  const feeTypesFound = new Set(dedupedEntries.map(e => e.fee_type).filter(Boolean));
  const hasSeparatedFees = dedupedEntries.length > 1 || (hasDestaque && feeTypesFound.size > 0) || feeTypesFound.size > 1;

  return {
    entries: dedupedEntries.length > 0 ? dedupedEntries : [singleResult],
    process_number,
    entity,
    total_requisitado,
    has_separated_fees: dedupedEntries.length > 0 ? hasSeparatedFees : false,
  };
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  const lineBreakThreshold = 2;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    let currentLine = "";
    let lastY: number | null = null;
    const lines: string[] = [];

    for (const item of textContent.items as any[]) {
      const str = String(item?.str || "").trim();
      if (!str) continue;

      const y = Number(item?.transform?.[5] ?? lastY ?? 0);

      if (lastY !== null && Math.abs(y - lastY) > lineBreakThreshold) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = str;
      } else {
        currentLine = currentLine ? `${currentLine} ${str}` : str;
      }

      lastY = y;
    }

    if (currentLine.trim()) lines.push(currentLine.trim());

    fullText += lines.join("\n") + "\n\n";
  }

  return fullText;
}
