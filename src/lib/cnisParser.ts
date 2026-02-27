/**
 * CNIS PDF Parser - Extrai dados do Extrato Previdenciário (CNIS) do Meu INSS
 * Funciona 100% client-side, sem IA, usando regex sobre o texto extraído do PDF.
 */

export interface CnisVinculo {
  empresa: string;
  cnpj: string;
  inicio: string; // YYYY-MM-DD
  fim: string;    // YYYY-MM-DD
  tipo: string;   // "empregado", "contribuinte individual", etc.
}

export interface CnisSalario {
  competencia: string; // YYYY-MM
  valor: number;
}

export interface CnisDados {
  nome: string;
  cpf: string;
  nit: string;
  dataNascimento: string;
  vinculos: CnisVinculo[];
  salarios: CnisSalario[];
  tempoTotal: { anos: number; meses: number; dias: number; totalDias: number };
}

function parseDate(dateStr: string): string | null {
  // Handles DD/MM/YYYY
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseMoney(str: string): number {
  // "1.234,56" -> 1234.56
  return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
}

function calcTempo(vinculos: CnisVinculo[]): CnisDados["tempoTotal"] {
  let totalDias = 0;
  for (const v of vinculos) {
    if (!v.inicio || !v.fim) continue;
    const d1 = new Date(v.inicio);
    const d2 = new Date(v.fim);
    if (d2 > d1) {
      totalDias += Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  }
  let anos = Math.floor(totalDias / 365);
  let meses = Math.floor((totalDias % 365) / 30);
  const dias = (totalDias % 365) % 30;
  if (meses >= 12) {
    anos += Math.floor(meses / 12);
    meses = meses % 12;
  }
  return { anos, meses, dias, totalDias };
}

export function parseCnisText(text: string): CnisDados {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const fullText = text;

  // Extract personal data
  let nome = "";
  let cpf = "";
  let nit = "";
  let dataNascimento = "";

  // Try common CNIS patterns
  const nomeMatch = fullText.match(/Nome[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\s]+)/);
  if (nomeMatch) nome = nomeMatch[1].trim();

  const cpfMatch = fullText.match(/CPF[:\s]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
  if (cpfMatch) cpf = cpfMatch[1];

  const nitMatch = fullText.match(/NIT[:\s]*(\d[\d.\-/]+)/i) || fullText.match(/PIS[:\s]*(\d[\d.\-/]+)/i);
  if (nitMatch) nit = nitMatch[1];

  const nascMatch = fullText.match(/Nascimento[:\s]*(\d{2}\/\d{2}\/\d{4})/i) || fullText.match(/Data de Nascimento[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
  if (nascMatch) dataNascimento = parseDate(nascMatch[1]) || "";

  // Extract vínculos
  const vinculosMap = new Map<string, CnisVinculo>();

  const addVinculo = (v: CnisVinculo) => {
    if (!v.inicio || !v.fim) return;
    if (new Date(v.fim) <= new Date(v.inicio)) return;
    const key = `${v.cnpj.replace(/\D/g, "")}|${v.inicio}|${v.fim}|${v.empresa.trim().toUpperCase()}`;
    if (!vinculosMap.has(key)) {
      vinculosMap.set(key, {
        ...v,
        empresa: v.empresa.trim().replace(/\s+/g, " "),
      });
    }
  };

  // Pattern 1: CNPJ + empresa + início + fim na mesma linha/bloco
  const vinculoRegex = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:a\s+|até\s+|-\s+|–\s+|—\s+)?(\d{2}\/\d{2}\/\d{4})/g;
  let match;
  while ((match = vinculoRegex.exec(fullText)) !== null) {
    const inicio = parseDate(match[3]);
    const fim = parseDate(match[4]);
    if (inicio && fim) {
      addVinculo({
        cnpj: match[1],
        empresa: match[2],
        inicio,
        fim,
        tipo: "empregado",
      });
    }
  }

  // Pattern 2: parser linha a linha com contexto (empresa/cnpj nas linhas anteriores)
  let lastEmpresa = "";
  let lastCnpj = "";
  const cnpjRegex = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;

  for (const line of lines) {
    const cnpjLine = line.match(cnpjRegex);
    if (cnpjLine) lastCnpj = cnpjLine[1];

    const isLikelyEmpresa =
      /[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]{3,}/.test(line) &&
      /^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ0-9\s&.,\-\/()]+$/.test(line) &&
      !/(\d{2}\/\d{2}\/\d{4})/.test(line);

    if (isLikelyEmpresa) {
      lastEmpresa = line.replace(cnpjRegex, "").trim();
    }

    const rangeMatch = line.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:a|até|-|–|—|à)\s*(\d{2}\/\d{2}\/\d{4})/i)
      || line.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/);

    if (rangeMatch) {
      const inicio = parseDate(rangeMatch[1]);
      const fim = parseDate(rangeMatch[2]);

      // tenta extrair empresa da própria linha removendo datas e cnpj
      const empresaNaLinha = line
        .replace(cnpjRegex, "")
        .replace(/\d{2}\/\d{2}\/\d{4}/g, "")
        .replace(/\b(a|até|à)\b|[-–—]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (inicio && fim) {
        addVinculo({
          cnpj: cnpjLine?.[1] || lastCnpj,
          empresa: empresaNaLinha || lastEmpresa || `Vínculo ${vinculosMap.size + 1}`,
          inicio,
          fim,
          tipo: "empregado",
        });
      }
    }
  }

  // Pattern 3 (fallback): pares simples de datas no documento inteiro
  if (vinculosMap.size === 0) {
    const allDates: string[] = [];
    const dateSimpleRegex = /(\d{2}\/\d{2}\/\d{4})/g;
    let dm;
    while ((dm = dateSimpleRegex.exec(fullText)) !== null) {
      allDates.push(dm[1]);
    }

    for (let i = 0; i < allDates.length - 1; i += 2) {
      const inicio = parseDate(allDates[i]);
      const fim = parseDate(allDates[i + 1]);
      if (inicio && fim) {
        addVinculo({
          cnpj: "",
          empresa: `Vínculo ${vinculosMap.size + 1}`,
          inicio,
          fim,
          tipo: "empregado",
        });
      }
    }
  }

  const vinculos = Array.from(vinculosMap.values()).sort((a, b) => a.inicio.localeCompare(b.inicio));

  // Extract salários de contribuição
  const salarios: CnisSalario[] = [];
  
  // Pattern: MM/YYYY followed by money value
  const salarioRegex = /(\d{2})\/(\d{4})\s+[\w\s]*?(\d{1,3}(?:\.\d{3})*,\d{2})/g;
  while ((match = salarioRegex.exec(fullText)) !== null) {
    const competencia = `${match[2]}-${match[1]}`;
    const valor = parseMoney(match[3]);
    if (valor > 0 && valor < 100000) { // sanity check
      salarios.push({ competencia, valor });
    }
  }

  // If no salaries found with first pattern, try a simpler approach
  if (salarios.length === 0) {
    const simpleSalarioRegex = /(\d{2})\/(\d{4})\D+?R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
    while ((match = simpleSalarioRegex.exec(fullText)) !== null) {
      const competencia = `${match[2]}-${match[1]}`;
      const valor = parseMoney(match[3]);
      if (valor > 0 && valor < 100000) {
        salarios.push({ competencia, valor });
      }
    }
  }

  // Sort salários by competência
  salarios.sort((a, b) => a.competencia.localeCompare(b.competencia));

  // Remove duplicates
  const uniqueSalarios = salarios.filter((s, i, arr) => 
    i === 0 || s.competencia !== arr[i - 1].competencia
  );

  return {
    nome,
    cpf,
    nit,
    dataNascimento,
    vinculos,
    salarios: uniqueSalarios,
    tempoTotal: calcTempo(vinculos),
  };
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  console.log("[CNIS] Starting PDF extraction for:", file.name, "size:", file.size, "type:", file.type);

  const arrayBuffer = await file.arrayBuffer();
  let pdf;

  try {
    // Tenta usar worker (mais performático)
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (workerError) {
    console.warn("[CNIS] Worker falhou, tentando sem worker:", workerError);
    // Fallback robusto para ambientes com bloqueio de worker/CDN
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true } as any).promise;
  }

  console.log("[CNIS] PDF loaded, pages:", pdf.numPages);
  
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];
    
    // Reconstrói linhas por coordenada Y para preservar tabelas do CNIS
    const rows = new Map<number, any[]>();
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push(item);
    }

    const sortedRows = Array.from(rows.entries()).sort((a, b) => b[0] - a[0]); // top -> bottom

    for (const [, rowItems] of sortedRows) {
      rowItems.sort((a, b) => a.transform[4] - b.transform[4]); // left -> right
      const lineText = rowItems
        .map((item) => String(item.str || "").trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (lineText) {
        fullText += lineText + "\n";
      }
    }
  }
  
  console.log("[CNIS] Extracted text length:", fullText.length);
  console.log("[CNIS] Text preview:", fullText.substring(0, 500));
  
  return fullText;
}
