/**
 * Shared court URL utilities for linking to tribunal portals.
 */

export const formatCNJ = (n: string): string => {
  const digits = n.replace(/\D/g, "");
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  }
  return n;
};

const tribunalUrls: Record<string, (n: string) => string> = {
  TRF4_JFRS: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&selForma=NU&txtValor=${encodeURIComponent(formatCNJ(n))}&selOrigem=RS&chkMostrarBaixados=S`,
  TRF4_JFSC: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&selForma=NU&txtValor=${encodeURIComponent(formatCNJ(n))}&selOrigem=SC&chkMostrarBaixados=S`,
  TRF4_JFPR: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&selForma=NU&txtValor=${encodeURIComponent(formatCNJ(n))}&selOrigem=PR&chkMostrarBaixados=S`,
  TRF4: (n) => `https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_resultado_pesquisa&selForma=NU&txtValor=${encodeURIComponent(formatCNJ(n))}&selOrigem=TRF&chkMostrarBaixados=S`,
  TJRS_1G: (n) => `https://comunica.pje.jus.br/consulta/processo/unificada/${encodeURIComponent(formatCNJ(n))}`,
  TJRS_2G: (n) => `https://comunica.pje.jus.br/consulta/processo/unificada/${encodeURIComponent(formatCNJ(n))}`,
};

/**
 * Try to guess the best tribunal URL for a process number.
 * Since publications don't always have a source mapping, we try to infer from the number.
 */
export function getCourtUrl(processNumber: string, source?: string): string | null {
  // If we have a known source, use it directly
  if (source && tribunalUrls[source]) {
    return tribunalUrls[source](processNumber);
  }

  // Try to infer from the process number (CNJ format: NNNNNNN-DD.AAAA.J.TR.OOOO)
  const digits = processNumber.replace(/\D/g, "");
  if (digits.length >= 20) {
    const justice = digits[13]; // J digit
    const tribunal = digits.slice(14, 16); // TR digits

    // Justice 5 = Trabalho
    if (justice === "5") {
      return `https://comunica.pje.jus.br/consulta/processo/unificada/${encodeURIComponent(formatCNJ(processNumber))}`;
    }
    // Justice 4 = Federal (TRF4 region = tribunal 04)
    if (justice === "4" && tribunal === "04") {
      // Try to infer state from origin digits
      const origin = digits.slice(16, 20);
      if (origin.startsWith("71") || origin.startsWith("50")) {
        return tribunalUrls.TRF4_JFRS(processNumber);
      }
      if (origin.startsWith("72")) {
        return tribunalUrls.TRF4_JFSC(processNumber);
      }
      if (origin.startsWith("70")) {
        return tribunalUrls.TRF4_JFPR(processNumber);
      }
      return tribunalUrls.TRF4(processNumber);
    }
    // Justice 8 = Estadual
    if (justice === "8" && tribunal === "21") {
      return tribunalUrls.TJRS_1G(processNumber);
    }
    // Fallback: CNJ unified
    return `https://comunica.pje.jus.br/consulta/processo/unificada/${encodeURIComponent(formatCNJ(processNumber))}`;
  }

  // Not a valid CNJ number, try CNJ unified anyway
  return `https://comunica.pje.jus.br/consulta/processo/unificada/${encodeURIComponent(processNumber)}`;
}

/**
 * Extract all process numbers from a text (content + title).
 */
export function extractProcessNumbers(text: string): string[] {
  // Match CNJ format: NNNNNNN-DD.AAAA.J.TR.OOOO
  const cnjPattern = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
  const matches = text.match(cnjPattern) || [];
  return [...new Set(matches)];
}
