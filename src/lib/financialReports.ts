import { printReport, fmtBRL, fmtDate } from "@/lib/printReport";
import { computePaymentOrderMath } from "@/lib/paymentOrderMath";

interface Transaction {
  id: string;
  type: string;
  category: string;
  description: string | null;
  amount: number;
  date: string;
  status: string;
}

interface PaymentOrder {
  id: string;
  type: string;
  status: string;
  gross_amount: number;
  office_amount: number;
  client_amount: number;
  income_tax: number;
  tax_percent: number;
  office_fees_percent: number;
  ownership_type: string;
  process_number: string | null;
  beneficiary_name: string | null;
  expected_payment_date: string | null;
}

interface FeeDistribution {
  id: string;
  payment_order_id: string;
  lawyer_name: string;
  amount: number;
  paid_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  aguardando: "Aguardando",
  liberado: "Liberado",
  sacado: "Sacado",
  cancelado: "Cancelado",
};

const TAX_CATEGORIES = ["IR sobre Honorários", "INSS", "ISS", "IRPJ/CSLL", "Impostos"];

export function printFinancialSummary(
  transactions: Transaction[],
  paymentOrders: PaymentOrder[],
  distributions: FeeDistribution[],
  tenantName?: string
) {
  const confirmed = transactions.filter(t => t.status === "confirmed");
  const totalRevenue = confirmed.filter(t => t.type === "revenue").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = confirmed.filter(t => t.type === "expense" && !TAX_CATEGORIES.includes(t.category));
  const taxes = confirmed.filter(t => t.type === "expense" && TAX_CATEGORIES.includes(t.category));
  const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalTaxes = taxes.reduce((s, t) => s + Number(t.amount), 0);
  const totalDistributed = distributions.reduce((s, d) => s + Number(d.amount), 0);
  const profit = totalRevenue - totalExpense - totalTaxes;
  const activeOrders = paymentOrders.filter(o => o.status !== "cancelado");
  const totalHonorarios = activeOrders.reduce((s, o) => s + (Number(o.office_amount) || 0), 0);
  const totalBruto = activeOrders.reduce((s, o) => s + (Number(o.gross_amount) || 0), 0);

  const content = `
    <div class="summary-grid">
      <div class="summary-card"><p class="label">Receitas</p><p class="value green">${fmtBRL(totalRevenue)}</p></div>
      <div class="summary-card"><p class="label">Despesas</p><p class="value red">${fmtBRL(totalExpense)}</p></div>
      <div class="summary-card"><p class="label">Impostos</p><p class="value amber">${fmtBRL(totalTaxes)}</p></div>
      <div class="summary-card"><p class="label">Rateios Pagos</p><p class="value blue">${fmtBRL(totalDistributed)}</p></div>
      <div class="summary-card"><p class="label">Lucro Líquido</p><p class="value ${profit >= 0 ? 'green' : 'red'}">${fmtBRL(profit)}</p></div>
      <div class="summary-card"><p class="label">Honorários Previstos</p><p class="value blue">${fmtBRL(totalHonorarios)}</p></div>
    </div>

    <div class="section">
      <p class="section-title">Receitas por Categoria</p>
      <table>
        <thead><tr><th>Categoria</th><th class="text-right">Total</th><th class="text-right">%</th></tr></thead>
        <tbody>
          ${(() => {
            const cats: Record<string, number> = {};
            confirmed.filter(t => t.type === "revenue").forEach(t => { cats[t.category] = (cats[t.category] || 0) + Number(t.amount); });
            return Object.entries(cats).sort(([, a], [, b]) => b - a).map(([cat, val]) =>
              `<tr><td>${cat}</td><td class="text-right">${fmtBRL(val)}</td><td class="text-right">${totalRevenue > 0 ? (val / totalRevenue * 100).toFixed(1) : 0}%</td></tr>`
            ).join("");
          })()}
        </tbody>
        <tfoot><tr><td class="font-bold">Total</td><td class="text-right font-bold text-green">${fmtBRL(totalRevenue)}</td><td></td></tr></tfoot>
      </table>
    </div>

    <div class="section">
      <p class="section-title">Despesas por Categoria</p>
      <table>
        <thead><tr><th>Categoria</th><th class="text-right">Total</th><th class="text-right">%</th></tr></thead>
        <tbody>
          ${(() => {
            const cats: Record<string, number> = {};
            expenses.forEach(t => { cats[t.category] = (cats[t.category] || 0) + Number(t.amount); });
            return Object.entries(cats).sort(([, a], [, b]) => b - a).map(([cat, val]) =>
              `<tr><td>${cat}</td><td class="text-right">${fmtBRL(val)}</td><td class="text-right">${totalExpense > 0 ? (val / totalExpense * 100).toFixed(1) : 0}%</td></tr>`
            ).join("");
          })()}
        </tbody>
        <tfoot><tr><td class="font-bold">Total</td><td class="text-right font-bold text-red">${fmtBRL(totalExpense)}</td><td></td></tr></tfoot>
      </table>
    </div>

    <div class="section">
      <p class="section-title">Transações Recentes</p>
      <table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th class="text-right">Valor</th></tr></thead>
        <tbody>
          ${confirmed.slice(0, 50).map(t => `
            <tr>
              <td>${fmtDate(t.date)}</td>
              <td>${t.type === "revenue" ? "Receita" : "Despesa"}</td>
              <td>${t.category}</td>
              <td>${t.description || "—"}</td>
              <td class="text-right ${t.type === 'revenue' ? 'text-green' : 'text-red'}">${t.type === "revenue" ? "+" : "−"}${fmtBRL(Number(t.amount))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  printReport({ title: "Relatório Financeiro Geral", subtitle: "Resumo completo de receitas, despesas e indicadores", tenantName, content });
}

export function printRpvReport(
  paymentOrders: PaymentOrder[],
  distributions: FeeDistribution[],
  filter: "all" | "sacado" | "pending",
  tenantName?: string
) {
  let orders = paymentOrders.filter(o => o.status !== "cancelado");
  let subtitle = "Todos os RPVs/Precatórios ativos";
  if (filter === "sacado") { orders = orders.filter(o => o.status === "sacado"); subtitle = "RPVs/Precatórios já sacados"; }
  if (filter === "pending") { orders = orders.filter(o => o.status !== "sacado"); subtitle = "RPVs/Precatórios pendentes de pagamento"; }

  const totalBruto = orders.reduce((s, o) => s + computePaymentOrderMath(o as any).officeGross, 0);
  const totalHonorarios = orders.reduce((s, o) => s + computePaymentOrderMath(o as any).officeNet, 0);
  const totalIR = orders.reduce((s, o) => s + computePaymentOrderMath(o as any).taxAmount, 0);
  const totalCliente = orders.reduce((s, o) => s + computePaymentOrderMath(o as any).clientAmount, 0);

  const content = `
    <div class="summary-grid">
      <div class="summary-card"><p class="label">Total de Registros</p><p class="value">${orders.length}</p></div>
      <div class="summary-card"><p class="label">Valor Bruto</p><p class="value">${fmtBRL(totalBruto)}</p></div>
      <div class="summary-card"><p class="label">Honorários</p><p class="value green">${fmtBRL(totalHonorarios)}</p></div>
      <div class="summary-card"><p class="label">IR Retido</p><p class="value amber">${fmtBRL(totalIR)}</p></div>
      <div class="summary-card"><p class="label">Parte Cliente</p><p class="value blue">${fmtBRL(totalCliente)}</p></div>
    </div>

    <div class="section">
      <p class="section-title">Detalhamento</p>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Processo / Beneficiário</th>
            <th>Status</th>
            <th class="text-right">Bruto</th>
            <th class="text-right">Honor. %</th>
            <th class="text-right">Honorários</th>
            <th class="text-right">IR</th>
            <th class="text-right">Cliente</th>
            <th>Prev. Pgto</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => {
            const m = computePaymentOrderMath(o as any);
            return `
            <tr>
              <td>${o.type.toUpperCase()}</td>
              <td>${o.process_number || o.beneficiary_name || "—"}</td>
              <td>${STATUS_LABELS[o.status] || o.status}</td>
              <td class="text-right">${fmtBRL(m.officeGross)}</td>
              <td class="text-right">${o.office_fees_percent || 0}%</td>
              <td class="text-right font-bold text-green">${fmtBRL(m.officeNet)}</td>
              <td class="text-right text-red">${fmtBRL(m.taxAmount)}</td>
              <td class="text-right">${fmtBRL(m.clientAmount)}</td>
              <td>${o.expected_payment_date ? fmtDate(o.expected_payment_date) : "—"}</td>
            </tr>
          `}).join("")}
        </tbody>
        <tfoot>
          <tr class="font-bold">
            <td colspan="3">TOTAIS</td>
            <td class="text-right">${fmtBRL(totalBruto)}</td>
            <td></td>
            <td class="text-right text-green">${fmtBRL(totalHonorarios)}</td>
            <td class="text-right text-red">${fmtBRL(totalIR)}</td>
            <td class="text-right">${fmtBRL(totalCliente)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${distributions.length > 0 ? `
    <div class="section">
      <p class="section-title">Distribuição de Honorários</p>
      <table>
        <thead><tr><th>Advogado</th><th>RPV/Precatório</th><th class="text-right">Valor</th><th>Data Pgto</th></tr></thead>
        <tbody>
          ${distributions.filter(d => orders.some(o => o.id === d.payment_order_id)).map(d => {
            const order = paymentOrders.find(o => o.id === d.payment_order_id);
            return `<tr>
              <td>${d.lawyer_name}</td>
              <td class="font-mono text-sm">${order?.process_number || order?.beneficiary_name || "—"}</td>
              <td class="text-right font-bold">${fmtBRL(Number(d.amount))}</td>
              <td>${d.paid_at ? fmtDate(d.paid_at) : "—"}</td>
            </tr>`;
          }).join("")}
        </tbody>
        <tfoot>
          <tr class="font-bold"><td colspan="2">Total Distribuído</td><td class="text-right">${fmtBRL(distributions.filter(d => orders.some(o => o.id === d.payment_order_id)).reduce((s, d) => s + Number(d.amount), 0))}</td><td></td></tr>
        </tfoot>
      </table>
    </div>` : ""}
  `;

  printReport({
    title: `Relatório de RPV/Precatórios — ${filter === "sacado" ? "Sacados" : filter === "pending" ? "Pendentes" : "Completo"}`,
    subtitle,
    tenantName,
    content,
    orientation: "landscape",
  });
}

export function printCashFlowReport(
  transactions: Transaction[],
  distributions: FeeDistribution[],
  tenantName?: string
) {
  const confirmed = transactions.filter(t => t.status === "confirmed");
  const expenses = confirmed.filter(t => t.type === "expense" && !TAX_CATEGORIES.includes(t.category));
  const taxes = confirmed.filter(t => t.type === "expense" && TAX_CATEGORIES.includes(t.category));
  const totalRevenue = confirmed.filter(t => t.type === "revenue").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalTaxes = taxes.reduce((s, t) => s + Number(t.amount), 0);
  const totalDistributed = distributions.reduce((s, d) => s + Number(d.amount), 0);
  const netCash = totalRevenue - totalExpense - totalTaxes - totalDistributed;

  // Monthly grouping
  const months: Record<string, { revenue: number; expense: number; taxes: number; distributed: number }> = {};
  confirmed.forEach(t => {
    const key = t.date.substring(0, 7);
    if (!months[key]) months[key] = { revenue: 0, expense: 0, taxes: 0, distributed: 0 };
    if (t.type === "revenue") months[key].revenue += Number(t.amount);
    if (t.type === "expense") {
      if (TAX_CATEGORIES.includes(t.category)) months[key].taxes += Number(t.amount);
      else months[key].expense += Number(t.amount);
    }
  });
  distributions.forEach(d => {
    if (d.paid_at) {
      const key = d.paid_at.substring(0, 7);
      if (!months[key]) months[key] = { revenue: 0, expense: 0, taxes: 0, distributed: 0 };
      months[key].distributed += Number(d.amount);
    }
  });

  const sortedMonths = Object.entries(months).sort(([a], [b]) => b.localeCompare(a));

  const content = `
    <div class="summary-grid">
      <div class="summary-card"><p class="label">Entradas</p><p class="value green">${fmtBRL(totalRevenue)}</p></div>
      <div class="summary-card"><p class="label">Despesas</p><p class="value red">${fmtBRL(totalExpense)}</p></div>
      <div class="summary-card"><p class="label">Impostos</p><p class="value amber">${fmtBRL(totalTaxes)}</p></div>
      <div class="summary-card"><p class="label">Rateios</p><p class="value blue">${fmtBRL(totalDistributed)}</p></div>
      <div class="summary-card"><p class="label">Saldo de Caixa</p><p class="value ${netCash >= 0 ? 'green' : 'red'}">${fmtBRL(netCash)}</p></div>
    </div>

    <div class="section">
      <p class="section-title">Resumo Mensal</p>
      <table>
        <thead>
          <tr><th>Mês</th><th class="text-right">Entradas</th><th class="text-right">Despesas</th><th class="text-right">Impostos</th><th class="text-right">Rateios</th><th class="text-right">Saldo</th></tr>
        </thead>
        <tbody>
          ${sortedMonths.map(([month, data]) => {
            const net = data.revenue - data.expense - data.taxes - data.distributed;
            const [y, m] = month.split("-");
            const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
            return `<tr>
              <td style="text-transform:capitalize">${monthName}</td>
              <td class="text-right text-green">${fmtBRL(data.revenue)}</td>
              <td class="text-right text-red">${fmtBRL(data.expense)}</td>
              <td class="text-right text-amber">${fmtBRL(data.taxes)}</td>
              <td class="text-right text-blue">${fmtBRL(data.distributed)}</td>
              <td class="text-right font-bold ${net >= 0 ? 'text-green' : 'text-red'}">${fmtBRL(net)}</td>
            </tr>`;
          }).join("")}
        </tbody>
        <tfoot>
          <tr class="font-bold border-top">
            <td>TOTAL</td>
            <td class="text-right text-green">${fmtBRL(totalRevenue)}</td>
            <td class="text-right text-red">${fmtBRL(totalExpense)}</td>
            <td class="text-right text-amber">${fmtBRL(totalTaxes)}</td>
            <td class="text-right text-blue">${fmtBRL(totalDistributed)}</td>
            <td class="text-right ${netCash >= 0 ? 'text-green' : 'text-red'}">${fmtBRL(netCash)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="section">
      <p class="section-title">Despesas por Categoria</p>
      <table>
        <thead><tr><th>Categoria</th><th class="text-right">Total</th><th class="text-right">%</th></tr></thead>
        <tbody>
          ${(() => {
            const cats: Record<string, number> = {};
            expenses.forEach(t => { cats[t.category] = (cats[t.category] || 0) + Number(t.amount); });
            return Object.entries(cats).sort(([, a], [, b]) => b - a).map(([cat, val]) =>
              `<tr><td>${cat}</td><td class="text-right">${fmtBRL(val)}</td><td class="text-right">${totalExpense > 0 ? (val / totalExpense * 100).toFixed(1) : 0}%</td></tr>`
            ).join("");
          })()}
        </tbody>
      </table>
    </div>

    <div class="section">
      <p class="section-title">Impostos por Categoria</p>
      <table>
        <thead><tr><th>Categoria</th><th class="text-right">Total</th></tr></thead>
        <tbody>
          ${(() => {
            const cats: Record<string, number> = {};
            taxes.forEach(t => { cats[t.category] = (cats[t.category] || 0) + Number(t.amount); });
            return Object.entries(cats).sort(([, a], [, b]) => b - a).map(([cat, val]) =>
              `<tr><td>${cat}</td><td class="text-right">${fmtBRL(val)}</td></tr>`
            ).join("");
          })()}
        </tbody>
      </table>
    </div>
  `;

  printReport({ title: "Relatório de Fluxo de Caixa", subtitle: "Movimentação financeira detalhada", tenantName, content });
}

export function printFeeDistributionReport(
  distributions: FeeDistribution[],
  paymentOrders: PaymentOrder[],
  tenantName?: string
) {
  const totalDistributed = distributions.reduce((s, d) => s + Number(d.amount), 0);

  // By lawyer
  const byLawyer: Record<string, { name: string; total: number; count: number }> = {};
  distributions.forEach(d => {
    if (!byLawyer[d.lawyer_name]) byLawyer[d.lawyer_name] = { name: d.lawyer_name, total: 0, count: 0 };
    byLawyer[d.lawyer_name].total += Number(d.amount);
    byLawyer[d.lawyer_name].count += 1;
  });

  const content = `
    <div class="summary-grid">
      <div class="summary-card"><p class="label">Total Distribuído</p><p class="value blue">${fmtBRL(totalDistributed)}</p></div>
      <div class="summary-card"><p class="label">Total de Lançamentos</p><p class="value">${distributions.length}</p></div>
      <div class="summary-card"><p class="label">Advogados</p><p class="value">${Object.keys(byLawyer).length}</p></div>
    </div>

    <div class="section">
      <p class="section-title">Resumo por Advogado</p>
      <table>
        <thead><tr><th>Advogado</th><th class="text-right">Total</th><th class="text-right">Lançamentos</th><th class="text-right">% do Total</th></tr></thead>
        <tbody>
          ${Object.entries(byLawyer).sort(([, a], [, b]) => b.total - a.total).map(([, info]) =>
            `<tr><td>${info.name}</td><td class="text-right font-bold">${fmtBRL(info.total)}</td><td class="text-right">${info.count}</td><td class="text-right">${totalDistributed > 0 ? (info.total / totalDistributed * 100).toFixed(1) : 0}%</td></tr>`
          ).join("")}
        </tbody>
        <tfoot><tr class="font-bold"><td>TOTAL</td><td class="text-right">${fmtBRL(totalDistributed)}</td><td class="text-right">${distributions.length}</td><td></td></tr></tfoot>
      </table>
    </div>

    <div class="section">
      <p class="section-title">Todas as Distribuições</p>
      <table>
        <thead><tr><th>Advogado</th><th>RPV/Precatório</th><th class="text-right">Valor</th><th>Data Pgto</th></tr></thead>
        <tbody>
          ${distributions.map(d => {
            const order = paymentOrders.find(o => o.id === d.payment_order_id);
            return `<tr>
              <td>${d.lawyer_name}</td>
              <td class="font-mono text-sm">${order?.process_number || order?.beneficiary_name || "—"}</td>
              <td class="text-right font-bold">${fmtBRL(Number(d.amount))}</td>
              <td>${d.paid_at ? fmtDate(d.paid_at) : "—"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  printReport({ title: "Relatório de Distribuição de Honorários", subtitle: "Rateio detalhado por advogado e RPV/Precatório", tenantName, content });
}
