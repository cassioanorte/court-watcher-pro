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
  TJRS_1G: (n) => { const d = n.replace(/\D/g, ""); return `https://eproc1g.tjrs.jus.br/eproc/controlador.php?acao=processo_selecionar&acao_origem=pesquisa_processo_por_num_oab&acao_retorno=pesquisa_processo_por_num_oab&num_processo=${d}`; },
  TJRS_2G: (n) => { const d = n.replace(/\D/g, ""); return `https://eproc2g.tjrs.jus.br/eproc/controlador.php?acao=processo_selecionar&acao_origem=pesquisa_processo_por_num_oab&acao_retorno=pesquisa_processo_por_num_oab&num_processo=${d}`; },
};

/**
 * Try to guess the best tribunal URL for a process number.
 * Since publications don't always have a source mapping, we try to infer from the number.
 */
export function getCourtUrl(processNumber: string, source?: string): string | null {
  const normalizedSource = source?.trim().toUpperCase();

  // If we have a known source, use it directly
  if (normalizedSource && tribunalUrls[normalizedSource]) {
    return tribunalUrls[normalizedSource](processNumber);
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

const authenticatedTribunalUrls: Record<string, string> = {
  TRF4_JFRS: "https://eproc.jfrs.jus.br/eprocV2/",
  TRF4_JFSC: "https://eproc.jfsc.jus.br/eprocV2/",
  TRF4_JFPR: "https://eproc.jfpr.jus.br/eprocV2/",
  TRF4: "https://eproc.trf4.jus.br/eproc2trf4/",
  TJRS_1G: "https://eproc1g.tjrs.jus.br/eproc/",
  TJRS_2G: "https://eproc2g.tjrs.jus.br/eproc/",
  TJRS: "https://eproc1g.tjrs.jus.br/eproc/",
};

/**
 * Get the authenticated eproc/PJe portal URL for a process number.
 * These require login (certificate or credentials) and work for cases with judicial secrecy.
 */
export function getAuthenticatedCourtUrl(processNumber: string, source?: string): string | null {
  const normalizedSource = source?.trim().toUpperCase();
  if (normalizedSource && authenticatedTribunalUrls[normalizedSource]) {
    return authenticatedTribunalUrls[normalizedSource];
  }

  const digits = processNumber.replace(/\D/g, "");
  if (digits.length < 20) return null;

  const formatted = formatCNJ(processNumber);
  const justice = digits[13];
  const tribunal = digits.slice(14, 16);

  // Justice 4 = Federal (TRF4)
  // Open portal homepage — deep links create cross-site sessions that block documents
  if (justice === "4" && tribunal === "04") {
    const origin = digits.slice(16, 20);
    if (origin.startsWith("71") || origin.startsWith("50")) {
      return `https://eproc.jfrs.jus.br/eprocV2/`;
    }
    if (origin.startsWith("72")) {
      return `https://eproc.jfsc.jus.br/eprocV2/`;
    }
    if (origin.startsWith("70")) {
      return `https://eproc.jfpr.jus.br/eprocV2/`;
    }
    return `https://eproc.trf4.jus.br/eproc2trf4/`;
  }

  // Justice 8 = Estadual (TJRS)
  if (justice === "8" && tribunal === "21") {
    return `https://eproc1g.tjrs.jus.br/eproc/`;
  }

  // Justice 5 = Trabalho
  if (justice === "5") {
    return `https://pje.trt4.jus.br/consultaprocessual/detalhe-processo/${encodeURIComponent(formatted)}`;
  }

  return null;
}

/**
 * Check if a process number points to an eproc-based tribunal (TJRS, TRF4/JF).
 * These portals require session hashes, so direct links redirect to home.
 */
export function isEprocProcess(processNumber: string): boolean {
  const digits = processNumber.replace(/\D/g, "");
  if (digits.length < 20) return false;
  const justice = digits[13];
  const tribunal = digits.slice(14, 16);
  // TRF4 / JF (justice 4, tribunal 04) or TJRS (justice 8, tribunal 21)
  return (justice === "4" && tribunal === "04") || (justice === "8" && tribunal === "21");
}

/**
 * Open a URL via an about:blank intermediary to avoid cross-site session tainting.
 * This prevents the browser from sending Sec-Fetch-Site: cross-site headers,
 * which eproc uses to restrict document access in the session.
 */
export function openViaBlank(url: string, copyText?: string): void {
  // Open first in a user-gesture-safe way; copy must never block navigation
  const popup = window.open("about:blank", "_blank", "noopener,noreferrer");

  // Copy text to clipboard, but never let failures interrupt opening
  if (copyText) {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(copyText).catch(() => copyFallback(copyText));
      } else {
        copyFallback(copyText);
      }
    } catch {
      // ignore copy errors
    }
  }

  if (popup) {
    try {
      popup.location.href = url;
      return;
    } catch {
      // fallback below
    }
  }

  // Last-resort fallback
  window.open(url, "_blank", "noopener,noreferrer");
}

function copyFallback(text: string): void {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {
    // ignore copy fallback errors
  }
}

/**
 * Open a process in the tribunal, handling eproc portals by copying the number first.
 * Returns true if handled (eproc copy+open), false if it's a normal link.
 */
export function openInTribunal(
  processNumber: string,
  source?: string,
  onCopied?: () => void
): { url: string | null; isEproc: boolean } {
  const eproc = isEprocProcess(processNumber);
  const url = eproc
    ? getAuthenticatedCourtUrl(processNumber, source) ?? getCourtUrl(processNumber, source)
    : getCourtUrl(processNumber, source);
  if (eproc && url) {
    const num = processNumber.replace(/\D/g, "");
    openViaBlank(url, num);
    onCopied?.();
  }
  return { url, isEproc: eproc };
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
