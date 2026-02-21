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
  const t = text.replace(/\s+/g, " ");
  const tLower = t.toLowerCase();

  // Determine type
  let type: "rpv" | "precatorio" | null = null;
  if (/precatório|precatorio|PRECATÓRIO/i.test(text)) type = "precatorio";
  if (/RPV|requisição de pequeno valor|requisicao de pequeno valor/i.test(text)) type = "rpv";

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
    /(?:valor\s+total\s+devido)[^)]*\)\s*([\d.,]+)/i,
    /(?:valor\s+total\s+devido)[^\d]*([\d.,]+)/i,
    /(?:valor\s+(?:bruto|total|principal|líquido da requisição|da requisição|requisitado))[:\s]*R?\$?\s*([\d.,]+)/i,
    /(?:total\s+(?:bruto|geral|da\s+requisição))[:\s]*R?\$?\s*([\d.,]+)/i,
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
  const refDateMatch = t.match(/(?:data\s+(?:base|do\s+cálculo|de\s+refer[êe]ncia))[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
  if (refDateMatch) reference_date = parseDate(refDateMatch[1]);

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

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}
