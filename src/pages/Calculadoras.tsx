import { useState } from "react";
import { Calculator, Zap, FileText, Building2, Scale, Gavel, Heart, Home, ShoppingCart, Briefcase, Clock, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import CorrecaoMonetariaCalc from "@/components/calculadoras/CorrecaoMonetariaCalc";
import JurosMoratoriosCalc from "@/components/calculadoras/JurosMoratoriosCalc";
import ParcelamentoCalc from "@/components/calculadoras/ParcelamentoCalc";
import TempoContribuicaoCalc from "@/components/calculadoras/TempoContribuicaoCalc";
import RmiCalc from "@/components/calculadoras/RmiCalc";
import SimuladorAposentadoriaCalc from "@/components/calculadoras/SimuladorAposentadoriaCalc";
import VerbasRescisoriasCalc from "@/components/calculadoras/VerbasRescisoriasCalc";
import HorasExtrasCalc from "@/components/calculadoras/HorasExtrasCalc";
import AtualizacaoDividaCalc from "@/components/calculadoras/AtualizacaoDividaCalc";
import JurosCompostosCalc from "@/components/calculadoras/JurosCompostosCalc";
import DosimetriaPenaCalc from "@/components/calculadoras/DosimetriaPenaCalc";
import PrescricaoPenalCalc from "@/components/calculadoras/PrescricaoPenalCalc";
import PensaoAlimenticiaCalc from "@/components/calculadoras/PensaoAlimenticiaCalc";
import PartilhaBensCalc from "@/components/calculadoras/PartilhaBensCalc";
import DistratoImovelCalc from "@/components/calculadoras/DistratoImovelCalc";
import DanoMoralCalc from "@/components/calculadoras/DanoMoralCalc";
import CobrancaIndevidaCalc from "@/components/calculadoras/CobrancaIndevidaCalc";

interface Calculadora {
  id: string;
  name: string;
  description: string;
  icon: typeof Calculator;
}

interface Categoria {
  id: string;
  label: string;
  icon: typeof Calculator;
  calculadoras: Calculadora[];
}

const categorias: Categoria[] = [
  {
    id: "generalistas", label: "Generalistas", icon: FileText,
    calculadoras: [
      { id: "correcao_monetaria", name: "Correção Monetária", description: "Atualize valores com INPC, IPCA, SELIC e outros índices oficiais.", icon: Percent },
      { id: "juros_moratorios", name: "Juros Moratórios", description: "Calcule juros simples e compostos sobre valores em atraso.", icon: Clock },
      { id: "parcelamento_916", name: "Parcelamento Art. 916 CPC", description: "Calcule o parcelamento: 30% de entrada + 6 parcelas com juros de 1% am.", icon: FileText },
    ],
  },
  {
    id: "previdenciario", label: "Previdenciário", icon: Building2,
    calculadoras: [
      { id: "tempo_contribuicao", name: "Tempo de Contribuição", description: "Calcule o tempo total de contribuição a partir dos vínculos.", icon: Clock },
      { id: "rmi", name: "Renda Mensal Inicial (RMI)", description: "Simule o valor do benefício com base nos salários de contribuição.", icon: Calculator },
      { id: "simulador_aposentadoria", name: "Simulador de Aposentadoria", description: "Verifique requisitos nas regras de transição (pedágio, pontos, idade mínima).", icon: Briefcase },
    ],
  },
  {
    id: "trabalhista", label: "Trabalhista", icon: Briefcase,
    calculadoras: [
      { id: "verbas_rescisorias", name: "Verbas Rescisórias", description: "Calcule saldo de salário, aviso prévio, férias, 13º e multa FGTS.", icon: Calculator },
      { id: "horas_extras", name: "Horas Extras", description: "Calcule horas extras com adicional de 50%, 100% e intrajornada.", icon: Clock },
    ],
  },
  {
    id: "bancario", label: "Bancário", icon: Building2,
    calculadoras: [
      { id: "atualizacao_divida", name: "Atualização de Dívida", description: "Recálculo de contratos bancários com taxas abusivas.", icon: Percent },
      { id: "juros_compostos", name: "Juros Compostos", description: "Calcule juros capitalizados sobre empréstimos e financiamentos.", icon: Calculator },
    ],
  },
  {
    id: "penal", label: "Penal", icon: Gavel,
    calculadoras: [
      { id: "dosimetria_pena", name: "Dosimetria da Pena", description: "Cálculo trifásico para fixação da pena (base, agravantes, causas de aumento).", icon: Scale },
      { id: "prescricao", name: "Prescrição Penal", description: "Verifique os prazos prescricionais com base na pena aplicada.", icon: Clock },
    ],
  },
  {
    id: "familiar", label: "Familiar", icon: Heart,
    calculadoras: [
      { id: "pensao_alimenticia", name: "Pensão Alimentícia", description: "Simule valores de pensão com base na renda e necessidades.", icon: Calculator },
      { id: "partilha_bens", name: "Partilha de Bens", description: "Calcule a divisão patrimonial conforme o regime de bens.", icon: Home },
    ],
  },
  {
    id: "imobiliario", label: "Imobiliário", icon: Home,
    calculadoras: [
      { id: "distrato_imovel", name: "Distrato Imobiliário", description: "Calcule a restituição conforme a Lei 13.786/2018.", icon: Calculator },
    ],
  },
  {
    id: "consumidor", label: "Consumidor", icon: ShoppingCart,
    calculadoras: [
      { id: "dano_moral", name: "Estimativa de Dano Moral", description: "Simule valores com base em precedentes jurisprudenciais.", icon: Scale },
      { id: "cobranca_indevida", name: "Cobrança Indevida", description: "Calcule a devolução em dobro (Art. 42 CDC) com correção.", icon: Percent },
    ],
  },
];

const calcComponents: Record<string, React.FC> = {
  correcao_monetaria: CorrecaoMonetariaCalc,
  juros_moratorios: JurosMoratoriosCalc,
  parcelamento_916: ParcelamentoCalc,
  tempo_contribuicao: TempoContribuicaoCalc,
  rmi: RmiCalc,
  simulador_aposentadoria: SimuladorAposentadoriaCalc,
  verbas_rescisorias: VerbasRescisoriasCalc,
  horas_extras: HorasExtrasCalc,
  atualizacao_divida: AtualizacaoDividaCalc,
  juros_compostos: JurosCompostosCalc,
  dosimetria_pena: DosimetriaPenaCalc,
  prescricao: PrescricaoPenalCalc,
  pensao_alimenticia: PensaoAlimenticiaCalc,
  partilha_bens: PartilhaBensCalc,
  distrato_imovel: DistratoImovelCalc,
  dano_moral: DanoMoralCalc,
  cobranca_indevida: CobrancaIndevidaCalc,
};

export default function Calculadoras() {
  const [activeTab, setActiveTab] = useState("generalistas");
  const [openCalc, setOpenCalc] = useState<Calculadora | null>(null);

  const activeCategory = categorias.find(c => c.id === activeTab)!;
  const CalcComponent = openCalc ? calcComponents[openCalc.id] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Calculadoras Jurídicas</h1>
          <p className="text-sm text-muted-foreground">Calculadoras inteligentes com relatório técnico</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Índices oficiais</span>
        <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Cálculo instantâneo</span>
        <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Memorial de cálculo</span>
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeCategory.calculadoras.map(calc => (
          <Card key={calc.id} className="transition-all hover:shadow-md hover:border-accent/50 cursor-pointer" onClick={() => setOpenCalc(calc)}>
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-accent/10 text-accent">
                  <calc.icon className="w-4.5 h-4.5" />
                </div>
              </div>
              <h3 className="font-semibold text-foreground mb-1">{calc.name}</h3>
              <p className="text-sm text-muted-foreground flex-1">{calc.description}</p>
              <Button variant="outline" className="mt-4 w-full">Abrir calculadora</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!openCalc} onOpenChange={open => !open && setOpenCalc(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {openCalc && <openCalc.icon className="w-5 h-5 text-accent" />}
              {openCalc?.name}
            </DialogTitle>
          </DialogHeader>
          {CalcComponent && <CalcComponent />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
