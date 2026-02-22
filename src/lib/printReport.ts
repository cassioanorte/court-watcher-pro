/**
 * Utility to open a print-friendly window with styled content.
 * Works for both physical printers and "Save as PDF".
 */

interface PrintReportOptions {
  title: string;
  subtitle?: string;
  tenantName?: string;
  content: string; // HTML string
  orientation?: "portrait" | "landscape";
}

export function printReport({ title, subtitle, tenantName, content, orientation = "portrait" }: PrintReportOptions) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Permita pop-ups para gerar o relatório.");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  @page { size: ${orientation === "landscape" ? "landscape" : "portrait"}; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a1a; font-size: 11px; line-height: 1.5; padding: 0; }
  .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 16px; }
  .header h1 { font-size: 18px; font-weight: 700; color: #111; }
  .header .subtitle { font-size: 12px; color: #666; margin-top: 2px; }
  .header .tenant { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
  .header .date { font-size: 10px; color: #999; float: right; margin-top: -30px; }
  
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th { background: #f5f5f5; font-weight: 600; text-align: left; padding: 6px 8px; border: 1px solid #ddd; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
  td { padding: 5px 8px; border: 1px solid #eee; font-size: 11px; }
  tr:nth-child(even) { background: #fafafa; }
  
  .section { margin: 16px 0; }
  .section-title { font-size: 13px; font-weight: 700; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
  
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 12px 0; }
  .summary-card { border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; }
  .summary-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }
  .summary-card .value { font-size: 16px; font-weight: 700; color: #111; margin-top: 2px; }
  .summary-card .value.green { color: #16a34a; }
  .summary-card .value.red { color: #dc2626; }
  .summary-card .value.blue { color: #2563eb; }
  .summary-card .value.amber { color: #d97706; }
  
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .font-bold { font-weight: 700; }
  .font-mono { font-family: 'Courier New', monospace; }
  .text-green { color: #16a34a; }
  .text-red { color: #dc2626; }
  .text-blue { color: #2563eb; }
  .text-amber { color: #d97706; }
  .text-muted { color: #888; }
  .text-sm { font-size: 10px; }
  .mt-2 { margin-top: 8px; }
  .mb-2 { margin-bottom: 8px; }
  .border-top { border-top: 2px solid #333; padding-top: 6px; }
  
  .footer { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 9px; color: #aaa; text-align: center; }
  
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  
  .print-btn { position: fixed; top: 10px; right: 10px; padding: 8px 20px; background: #333; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; z-index: 100; }
  .print-btn:hover { background: #555; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / PDF</button>

<div class="header">
  ${tenantName ? `<p class="tenant">${tenantName}</p>` : ""}
  <h1>${title}</h1>
  ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
  <p class="date">Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
</div>

${content}

<div class="footer">
  Documento gerado automaticamente pelo sistema • ${new Date().toLocaleDateString("pt-BR")}
</div>

</body>
</html>`;

  win.document.write(html);
  win.document.close();
  // Auto-trigger print dialog after a brief delay
  setTimeout(() => win.print(), 600);
}

/** Format currency BRL */
export const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Format date pt-BR */
export const fmtDate = (d: string) => {
  try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
};
