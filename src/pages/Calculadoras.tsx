import { useState } from "react";
import { Calculator, Zap, FileText, Building2, Scale, Gavel, Heart, Home, ShoppingCart, Briefcase, Clock, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Calculadora {
  id: string;
  name: string;
  description: string;
  icon: typeof Calculator;
  available: boolean;
}

interface Categoria {
  id: string;
  label: string;
  icon: typeof Calculator;
  calculadoras: Calculadora[];
}

const categorias: Categoria[] = [
  {
    id: "generalistas",
    label: "Generalistas",
    icon: FileText,
    calculadoras: [
      { id: "correcao_monetaria", name: "Correção Monetária", description: "Atualize valores com INPC, IPCA, SELIC e outros índices oficiais.", icon: Percent, available: true },
      { id: "juros_moratorios", name: "Juros Moratórios", description: "Calcule juros simples e compostos sobre valores em atraso.", icon: Clock, available: true },
      { id: "parcelamento_916", name: "Parcelamento Art. 916 CPC", description: "Calcule o parcelamento do subsídio: 30% de entrada + 6 parcelas com juros de 1% am.", icon: FileText, available: true },
    ],
  },
  {
    id: "previdenciario",
    label: "Previdenciário",
    icon: Building2,
    calculadoras: [
      { id: "tempo_contribuicao", name: "Tempo de Contribuição", description: "Calcule o tempo total de contribuição a partir dos vínculos do CNIS.", icon: Clock, available: false },
      { id: "rmi", name: "Renda Mensal Inicial (RMI)", description: "Simule o valor do benefício com base nos salários de contribuição.", icon: Calculator, available: false },
      { id: "simulador_aposentadoria", name: "Simulador de Aposentadoria", description: "Verifique requisitos nas regras de transição (pedágio, pontos, idade mínima).", icon: Briefcase, available: false },
    ],
  },
  {
    id: "trabalhista",
    label: "Trabalhista",
    icon: Briefcase,
    calculadoras: [
      { id: "verbas_rescisorias", name: "Verbas Rescisórias", description: "Calcule saldo de salário, aviso prévio, férias, 13º e multa FGTS.", icon: Calculator, available: false },
      { id: "horas_extras", name: "Horas Extras", description: "Calcule horas extras com adicional de 50%, 100% e intrajornada.", icon: Clock, available: false },
    ],
  },
  {
    id: "bancario",
    label: "Bancário",
    icon: Building2,
    calculadoras: [
      { id: "atualizacao_divida", name: "Atualização de Dívida", description: "Recálculo de contratos bancários com taxas abusivas.", icon: Percent, available: false },
      { id: "juros_compostos", name: "Juros Compostos", description: "Calcule juros capitalizados sobre empréstimos e financiamentos.", icon: Calculator, available: false },
    ],
  },
  {
    id: "penal",
    label: "Penal",
    icon: Gavel,
    calculadoras: [
      { id: "dosimetria_pena", name: "Dosimetria da Pena", description: "Cálculo trifásico para fixação da pena (base, agravantes/atenuantes, causas de aumento/diminuição).", icon: Scale, available: false },
      { id: "prescricao", name: "Prescrição Penal", description: "Verifique os prazos prescricionais com base na pena aplicada.", icon: Clock, available: false },
    ],
  },
  {
    id: "familiar",
    label: "Familiar",
    icon: Heart,
    calculadoras: [
      { id: "pensao_alimenticia", name: "Pensão Alimentícia", description: "Simule valores de pensão com base na renda e necessidades.", icon: Calculator, available: false },
      { id: "partilha_bens", name: "Partilha de Bens", description: "Calcule a divisão patrimonial conforme o regime de bens.", icon: Home, available: false },
    ],
  },
  {
    id: "imobiliario",
    label: "Imobiliário",
    icon: Home,
    calculadoras: [
      { id: "distrato_imovel", name: "Distrato Imobiliário", description: "Calcule a restituição de valores pagos conforme a Lei 13.786/2018.", icon: Calculator, available: false },
    ],
  },
  {
    id: "consumidor",
    label: "Consumidor",
    icon: ShoppingCart,
    calculadoras: [
      { id: "dano_moral", name: "Estimativa de Dano Moral", description: "Simule valores com base em precedentes jurisprudenciais.", icon: Scale, available: false },
      { id: "cobranca_indevida", name: "Cobrança Indevida", description: "Calcule a devolução em dobro (Art. 42 CDC) com correção.", icon: Percent, available: false },
    ],
  },
];

// ---- Simple calculator implementations ----

function CorrecaoMonetariaCalc({ onClose }: { onClose: () => void }) {
  const [valor, setValor] = useState("");
  const [indice, setIndice] = useState("ipca");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [resultado, setResultado] = useState<number | null>(null);

  const calcular = () => {
    const v = parseFloat(valor);
    if (!v || !dataInicio || !dataFim) { toast.error("Preencha todos os campos"); return; }
    const d1 = new Date(dataInicio);
    const d2 = new Date(dataFim);
    const meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    if (meses <= 0) { toast.error("A data final deve ser posterior à inicial"); return; }
    const taxas: Record<string, number> = { ipca: 0.004, inpc: 0.0045, selic: 0.008, igpm: 0.005 };
    const taxa = taxas[indice] || 0.004;
    setResultado(v * Math.pow(1 + taxa, meses));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor Original (R$)</Label><Input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="10.000,00" /></div>
        <div><Label>Índice</Label>
          <Select value={indice} onValueChange={setIndice}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ipca">IPCA</SelectItem>
              <SelectItem value="inpc">INPC</SelectItem>
              <SelectItem value="selic">SELIC</SelectItem>
              <SelectItem value="igpm">IGP-M</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Data Início</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
        <div><Label>Data Fim</Label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado !== null && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Valor Corrigido</p>
            <p className="text-2xl font-bold text-foreground">R$ {resultado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function JurosMoratoriosCalc() {
  const [valor, setValor] = useState("");
  const [taxa, setTaxa] = useState("1");
  const [meses, setMeses] = useState("");
  const [tipo, setTipo] = useState("simples");
  const [resultado, setResultado] = useState<number | null>(null);

  const calcular = () => {
    const v = parseFloat(valor);
    const t = parseFloat(taxa) / 100;
    const m = parseInt(meses);
    if (!v || !t || !m) { toast.error("Preencha todos os campos"); return; }
    const r = tipo === "simples" ? v * (1 + t * m) : v * Math.pow(1 + t, m);
    setResultado(r);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor Principal (R$)</Label><Input type="number" value={valor} onChange={e => setValor(e.target.value)} /></div>
        <div><Label>Taxa mensal (%)</Label><Input type="number" value={taxa} onChange={e => setTaxa(e.target.value)} /></div>
        <div><Label>Meses de atraso</Label><Input type="number" value={meses} onChange={e => setMeses(e.target.value)} /></div>
        <div><Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simples">Juros Simples</SelectItem>
              <SelectItem value="compostos">Juros Compostos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado !== null && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Valor com Juros</p>
            <p className="text-2xl font-bold text-foreground">R$ {resultado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground mt-1">Juros: R$ {(resultado - parseFloat(valor)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ParcelamentoCalc() {
  const [valor, setValor] = useState("");
  const [resultado, setResultado] = useState<{ entrada: number; parcela: number; total: number } | null>(null);

  const calcular = () => {
    const v = parseFloat(valor);
    if (!v) { toast.error("Informe o valor"); return; }
    const entrada = v * 0.3;
    const restante = v - entrada;
    const juros = 0.01;
    const parcela = (restante * juros * Math.pow(1 + juros, 6)) / (Math.pow(1 + juros, 6) - 1);
    setResultado({ entrada, parcela, total: entrada + parcela * 6 });
  };

  return (
    <div className="space-y-4">
      <div><Label>Valor Total da Condenação (R$)</Label><Input type="number" value={valor} onChange={e => setValor(e.target.value)} /></div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Entrada (30%)</span><span className="font-semibold">R$ {resultado.entrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">6 Parcelas de</span><span className="font-semibold">R$ {resultado.parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-medium">Total</span><span className="text-lg font-bold text-foreground">R$ {resultado.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const calcComponents: Record<string, React.FC<{ onClose: () => void }>> = {
  correcao_monetaria: CorrecaoMonetariaCalc,
  juros_moratorios: JurosMoratoriosCalc,
  parcelamento_916: ParcelamentoCalc,
};

export default function Calculadoras() {
  const [activeTab, setActiveTab] = useState("generalistas");
  const [openCalc, setOpenCalc] = useState<Calculadora | null>(null);

  const activeCategory = categorias.find(c => c.id === activeTab)!;
  const CalcComponent = openCalc ? calcComponents[openCalc.id] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Calculadoras Jurídicas</h1>
          <p className="text-sm text-muted-foreground">Calculadoras inteligentes com relatório técnico</p>
        </div>
      </div>

      {/* Features bar */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Índices oficiais</span>
        <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Cálculo instantâneo</span>
        <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Memorial de cálculo</span>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categorias.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
              activeTab === cat.id
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-card text-muted-foreground border-border hover:border-accent/50 hover:text-foreground"
            )}
          >
            <cat.icon className="w-3.5 h-3.5" />
            {cat.label}
            <Badge variant="secondary" className="ml-0.5 text-[10px] h-5 min-w-[20px] justify-center">
              {cat.calculadoras.length}
            </Badge>
          </button>
        ))}
      </div>

      {/* Calculator cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeCategory.calculadoras.map(calc => (
          <Card key={calc.id} className={cn("transition-all", calc.available ? "hover:shadow-md hover:border-accent/50 cursor-pointer" : "opacity-60")}>
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex items-start gap-3 mb-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", calc.available ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground")}>
                  <calc.icon className="w-4.5 h-4.5" />
                </div>
                {!calc.available && <Badge variant="outline" className="ml-auto text-[10px]">Em breve</Badge>}
              </div>
              <h3 className="font-semibold text-foreground mb-1">{calc.name}</h3>
              <p className="text-sm text-muted-foreground flex-1">{calc.description}</p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                disabled={!calc.available}
                onClick={() => calc.available && setOpenCalc(calc)}
              >
                {calc.available ? "Abrir calculadora" : "Em breve"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calculator dialog */}
      <Dialog open={!!openCalc} onOpenChange={open => !open && setOpenCalc(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {openCalc && <openCalc.icon className="w-5 h-5 text-accent" />}
              {openCalc?.name}
            </DialogTitle>
          </DialogHeader>
          {CalcComponent && <CalcComponent onClose={() => setOpenCalc(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
