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
  const anos = Math.floor(totalDias / 365);
  const meses = Math.floor((totalDias % 365) / 30);
  const dias = totalDias % 365 % 30;
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
  const vinculos: CnisVinculo[] = [];
  
  // Pattern 1: Standard CNIS table format
  // Looks for sequences like: CNPJ, Company Name, Start Date, End Date
  const vinculoRegex = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:a\s+)?(\d{2}\/\d{2}\/\d{4})/g;
  let match;
  while ((match = vinculoRegex.exec(fullText)) !== null) {
    const inicio = parseDate(match[3]);
    const fim = parseDate(match[4]);
    if (inicio && fim) {
      vinculos.push({
        cnpj: match[1],
        empresa: match[2].trim().replace(/\s+/g, " "),
        inicio,
        fim,
        tipo: "empregado",
      });
    }
  }

  // Pattern 2: Lines with date ranges (DD/MM/YYYY a DD/MM/YYYY)
  if (vinculos.length === 0) {
    const dateRangeRegex = /(\d{2}\/\d{2}\/\d{4})\s*(?:a|até|-)\s*(\d{2}\/\d{2}\/\d{4})/g;
    let lastEmpresa = "";
    let lastCnpj = "";
    
    for (const line of lines) {
      const cnpjLine = line.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
      if (cnpjLine) lastCnpj = cnpjLine[1];
      
      // Company names are usually uppercase lines before date ranges
      if (/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s&.,\-]{5,}$/.test(line) && !line.match(/\d{2}\/\d{2}\/\d{4}/)) {
        lastEmpresa = line.trim();
      }

      const rangeMatch = line.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:a|até|-)\s*(\d{2}\/\d{2}\/\d{4})/);
      if (rangeMatch) {
        const inicio = parseDate(rangeMatch[1]);
        const fim = parseDate(rangeMatch[2]);
        if (inicio && fim) {
          vinculos.push({
            cnpj: lastCnpj,
            empresa: lastEmpresa || "Vínculo " + (vinculos.length + 1),
            inicio,
            fim,
            tipo: "empregado",
          });
        }
      }
    }
  }

  // Pattern 3: Simple date pairs on separate lines
  if (vinculos.length === 0) {
    const allDates: string[] = [];
    const dateSimpleRegex = /(\d{2}\/\d{2}\/\d{4})/g;
    let dm;
    while ((dm = dateSimpleRegex.exec(fullText)) !== null) {
      allDates.push(dm[1]);
    }
    // Group dates in pairs (start, end)
    for (let i = 0; i < allDates.length - 1; i += 2) {
      const inicio = parseDate(allDates[i]);
      const fim = parseDate(allDates[i + 1]);
      if (inicio && fim && new Date(inicio) < new Date(fim)) {
        vinculos.push({
          cnpj: "",
          empresa: "Vínculo " + (vinculos.length + 1),
          inicio,
          fim,
          tipo: "empregado",
        });
      }
    }
  }

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
  
  // Use CDN worker matching the installed version
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

  console.log("[CNIS] Starting PDF extraction for:", file.name, "size:", file.size);
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  console.log("[CNIS] PDF loaded, pages:", pdf.numPages);
  
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
