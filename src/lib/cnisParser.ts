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

function parseDate(dateStr: string, endOfMonth = false): string | null {
  // Handles DD/MM/YYYY
  const fullMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (fullMatch) return `${fullMatch[3]}-${fullMatch[2]}-${fullMatch[1]}`;

  // Handles MM/YYYY (common in CNIS "Data Fim")
  const monthYearMatch = dateStr.match(/(\d{2})\/(\d{4})/);
  if (!monthYearMatch) return null;

  const month = Number(monthYearMatch[1]);
  const year = Number(monthYearMatch[2]);
  if (month < 1 || month > 12) return null;

  if (endOfMonth) {
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }

  return `${year}-${String(month).padStart(2, "0")}-01`;
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
    const inicioDate = new Date(v.inicio);
    const fimDate = new Date(v.fim);
    const currentYear = new Date().getFullYear() + 2;
    if (inicioDate.getFullYear() < 1950 || fimDate.getFullYear() > currentYear) return;
    if (fimDate <= inicioDate) return;

    const empresaLimpa = v.empresa.trim().replace(/\s+/g, " ");
    // Dedup by inicio+fim only — same date range = same vínculo regardless of name variations
    const key = `${v.inicio}|${v.fim}`;
    const existing = vinculosMap.get(key);
    // Keep the entry with the best empresa name (longest / most descriptive)
    if (!existing || (empresaLimpa.length > existing.empresa.length && !empresaLimpa.startsWith("Vínculo"))) {
      vinculosMap.set(key, {
        ...v,
        empresa: empresaLimpa || existing?.empresa || `Vínculo ${vinculosMap.size + 1}`,
      });
    }
  };

  // Pattern 1: Table rows with Seq | NIT | CNPJ | Empresa | Tipo | Data Início | Data Fim
  // Matches lines like: "1 124.34806.74-2 88.883.756/0001-77 EMPRESA NAME Empregado... 01/03/1991 19/02/1994 02/1994"
  const vinculoRegex = /(\d{2}\.?\d{3}\.?\d{3}(?:\/?\d{4}-?\d{2})?)\s+(.+?)\s+(?:Empregado(?:\s+ou\s+Agente\s+P[uú]blico)?|Contribuinte\s+Individual|Contribuinte|Trabalhador\s+Avulso|Segurado\s+Especial|Servidor\s+P[uú]blico)[\s\S]*?(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4})/g;
  let match;
  while ((match = vinculoRegex.exec(fullText)) !== null) {
    const inicio = parseDate(match[3]);
    const fim = parseDate(match[4], true);
    if (inicio && fim) {
      addVinculo({
        cnpj: match[1],
        empresa: match[2].replace(/\s*(Empregado|Contribuinte|Trabalhador|Segurado|Servidor).*/i, "").trim(),
        inicio,
        fim,
        tipo: "empregado",
      });
    }
  }

  // Pattern 1b: "Data Início: DD/MM/YYYY Data Fim: MM/YYYY" on its own line (vínculo 17 layout)
  const dataInicioFimRegex = /Data\s+In[ií]cio:?\s*(\d{2}\/\d{2}\/\d{4})\s+Data\s+Fim:?\s*(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4})/gi;
  while ((match = dataInicioFimRegex.exec(fullText)) !== null) {
    const inicio = parseDate(match[1]);
    const fim = parseDate(match[2], true);
    if (inicio && fim) {
      addVinculo({
        cnpj: lastCnpj,
        empresa: lastEmpresa,
        inicio,
        fim,
        tipo: "empregado",
      });
    }
  }

  // Pattern 2: parser linha a linha com contexto + janela multi-linha
  let lastEmpresa = "";
  let lastCnpj = "";
  const cnpjRegex = /(\d{2}\.?\d{3}\.?\d{3}(?:\/?\d{4}-?\d{2})?)/;

  const limparEmpresa = (txt: string) => txt
    .replace(cnpjRegex, "")
    .replace(/\d{2}\/\d{2}\/\d{4}/g, "")
    .replace(/\b(a|até|à)\b|[-–—]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isCabecalho = (txt: string) => /^(CNIS|NIT|CPF|Nome|Nascimento|Data de Nascimento|Competência|Remuneração)/i.test(txt);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cnpjLine = line.match(cnpjRegex);
    if (cnpjLine) lastCnpj = cnpjLine[1];

    const empresaNaLinha = limparEmpresa(line);
    if (empresaNaLinha.length >= 3 && !/(\d{2}\/\d{2}\/\d{4})/.test(line) && !isCabecalho(empresaNaLinha)) {
      lastEmpresa = empresaNaLinha;
    }

    const rangeMatch = line.match(/(?:Data\s*Início:?\s*)?(\d{2}\/\d{2}\/\d{4})\s*(?:Data\s*Fim:?\s*|a|até|-|–|—|à)\s*(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4})/i)
      || line.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4})/);

    if (rangeMatch) {
      const inicio = parseDate(rangeMatch[1]);
      const fim = parseDate(rangeMatch[2], true);
      if (inicio && fim) {
        addVinculo({
          cnpj: cnpjLine?.[1] || lastCnpj,
          empresa: empresaNaLinha || lastEmpresa,
          inicio,
          fim,
          tipo: "empregado",
        });
      }
    }

    // Se há CNPJ sem faixa na mesma linha, procura datas nas próximas linhas (layout quebrado de tabela)
    if (cnpjLine && !rangeMatch) {
      const windowText = lines.slice(i, i + 5).join(" ");
      const datas = Array.from(windowText.matchAll(/(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4})/g)).map(m => m[1]);
      if (datas.length >= 2) {
        const inicio = parseDate(datas[0]);
        const fim = parseDate(datas[1], true);
        const empresaProxima = limparEmpresa(lines[i + 1] || "");
        if (inicio && fim) {
          addVinculo({
            cnpj: cnpjLine[1],
            empresa: empresaNaLinha || empresaProxima || lastEmpresa,
            inicio,
            fim,
            tipo: "empregado",
          });
        }
      }
    }

    // Linhas sem CNPJ mas com duas datas também podem ser vínculo (usa contexto anterior)
    if (!cnpjLine) {
      const datasLinha = Array.from(line.matchAll(/(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4})/g)).map(m => m[1]);
      if (datasLinha.length >= 2) {
        const inicio = parseDate(datasLinha[0]);
        const fim = parseDate(datasLinha[1], true);
        if (inicio && fim) {
          addVinculo({
            cnpj: lastCnpj,
            empresa: empresaNaLinha || lastEmpresa,
            inicio,
            fim,
            tipo: "empregado",
          });
        }
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
      const fim = parseDate(allDates[i + 1], true);
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

  // Pattern principal CNIS: competência MM/YYYY seguida de remuneração (inclui linhas com '|')
  const salarioRegex = /(\d{2})\/(\d{4})\s*[|\s]+\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
  while ((match = salarioRegex.exec(fullText)) !== null) {
    const competencia = `${match[2]}-${match[1]}`;
    const valor = parseMoney(match[3]);
    if (valor > 0) {
      salarios.push({ competencia, valor });
    }
  }

  // Fallback: padrões mais soltos de competência + valor
  if (salarios.length === 0) {
    const simpleSalarioRegex = /(\d{2})\/(\d{4})\D+?R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;
    while ((match = simpleSalarioRegex.exec(fullText)) !== null) {
      const competencia = `${match[2]}-${match[1]}`;
      const valor = parseMoney(match[3]);
      if (valor > 0) {
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
