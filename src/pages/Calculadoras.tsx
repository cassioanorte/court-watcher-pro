import { useState } from "react";
import { Calculator, Zap, FileText, Building2, Scale, Gavel, Heart, Home, ShoppingCart, Briefcase, Clock, Percent, Landmark, Car, Wheat } from "lucide-react";
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
import TrabalhistaCalc from "@/components/calculadoras/TrabalhistaCalc";
import CorrecaoFgtsCalc from "@/components/calculadoras/CorrecaoFgtsCalc";
import AtualizacaoDividaCalc from "@/components/calculadoras/AtualizacaoDividaCalc";
import JurosCompostosCalc from "@/components/calculadoras/JurosCompostosCalc";
import DosimetriaPenaCalc from "@/components/calculadoras/DosimetriaPenaCalc";
import PrescricaoPenalCalc from "@/components/calculadoras/PrescricaoPenalCalc";
import ProgressaoRegimeCalc from "@/components/calculadoras/ProgressaoRegimeCalc";
import PensaoAlimenticiaCalc from "@/components/calculadoras/PensaoAlimenticiaCalc";
import PartilhaBensCalc from "@/components/calculadoras/PartilhaBensCalc";
import DivorcioCalc from "@/components/calculadoras/DivorcioCalc";
import HerancaCalc from "@/components/calculadoras/HerancaCalc";
import SucessorCalc from "@/components/calculadoras/SucessorCalc";
import DistratoImovelCalc from "@/components/calculadoras/DistratoImovelCalc";
import DanoMoralCalc from "@/components/calculadoras/DanoMoralCalc";
import CobrancaIndevidaCalc from "@/components/calculadoras/CobrancaIndevidaCalc";
import RevisaoBancariaCalc from "@/components/calculadoras/RevisaoBancariaCalc";
import SuperendividamentoCalc from "@/components/calculadoras/SuperendividamentoCalc";
import RmcRccCalc from "@/components/calculadoras/RmcRccCalc";
import AmortizacaoComparativaCalc from "@/components/calculadoras/AmortizacaoComparativaCalc";
import FinanciamentoCalc from "@/components/calculadoras/FinanciamentoCalc";
import TaxaMediaBacenCalc from "@/components/calculadoras/TaxaMediaBacenCalc";
import BuscaApreensaoCalc from "@/components/calculadoras/BuscaApreensaoCalc";
import RevisaoCcbCalc from "@/components/calculadoras/RevisaoCcbCalc";
import CapitalGiroCalc from "@/components/calculadoras/CapitalGiroCalc";
import CreditoRuralCalc from "@/components/calculadoras/CreditoRuralCalc";
import InssRestituicaoCalc from "@/components/calculadoras/InssRestituicaoCalc";
import RevisaoPasepCalc from "@/components/calculadoras/RevisaoPasepCalc";
import ContribuicoesAtrasoCalc from "@/components/calculadoras/ContribuicoesAtrasoCalc";
import RestabelecimentoCalc from "@/components/calculadoras/RestabelecimentoCalc";
import ComplementacaoCalc from "@/components/calculadoras/ComplementacaoCalc";
import BpcLoasCalc from "@/components/calculadoras/BpcLoasCalc";
import RestituicaoTetoCalc from "@/components/calculadoras/RestituicaoTetoCalc";
import RestituicaoIrDoencaCalc from "@/components/calculadoras/RestituicaoIrDoencaCalc";
import FatorPrevidenciarioCalc from "@/components/calculadoras/FatorPrevidenciarioCalc";

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
      { id: "fator_previdenciario", name: "Fator Previdenciário", description: "Calcule o fator previdenciário com base na idade, tempo de contribuição e expectativa de sobrevida.", icon: Calculator },
      { id: "inss_restituicao", name: "INSS (Restituição)", description: "Analisar descontos em seguros do INSS e simular o acordo administrativo para a restituição.", icon: Building2 },
      { id: "revisao_pasep", name: "Revisão do PASEP", description: "Recálculo do saldo do PASEP aplicando os juros, revisões e atualizações previstas na lei.", icon: Calculator },
      { id: "contribuicoes_atraso", name: "Contribuições em Atraso", description: "Calcular quanto o cliente precisa contribuir em atraso e aproveitar períodos não reconhecidos pelo INSS.", icon: Clock },
      { id: "restabelecimento", name: "Restabelecimento", description: "Encontre RMI e o Valor da Causa do benefício cessado pelo INSS que deseja restabelecer.", icon: Calculator },
      { id: "complementacao", name: "Complementação", description: "Descubra quanto complementar nos casos de alíquotas de planos simplificados (5% a 11%).", icon: Percent },
      { id: "bpc_loas", name: "Análise BPC/LOAS", description: "Verifique o cumprimento dos requisitos de miserabilidade do BPC/LOAS com composição familiar e renda.", icon: Heart },
      { id: "restituicao_teto", name: "Restituição Acima do Teto", description: "Estimar o valor das contribuições pagas acima do teto do INSS passíveis de restituição.", icon: Percent },
      { id: "restituicao_ir_doenca", name: "Restituição IR Doença Grave", description: "Simular a restituição de IR para aposentados/pensionistas com doenças graves (Lei 7.713/88).", icon: FileText },
    ],
  },
  {
    id: "trabalhista", label: "Trabalhista", icon: Briefcase,
    calculadoras: [
      { id: "verbas_rescisorias", name: "Verbas Rescisórias", description: "Calcule saldo de salário, aviso prévio, férias, 13º e multa FGTS.", icon: Calculator },
      { id: "horas_extras", name: "Horas Extras", description: "Calcule horas extras com adicional de 50%, 100% e intrajornada.", icon: Clock },
      { id: "trabalhista_geral", name: "Trabalhista", description: "Uma calculadora trabalhista simplifica cálculos essenciais relacionados a questões salariais e legais.", icon: Briefcase },
      { id: "correcao_fgts", name: "Correção do FGTS", description: "Verificação e correção de depósitos, garantindo valores justos aos trabalhadores.", icon: Percent },
    ],
  },
  {
    id: "bancario", label: "Bancário", icon: Building2,
    calculadoras: [
      { id: "revisao_bancaria", name: "Revisão", description: "Recalcular contratos bancários com taxa BACEN e gerar documentos.", icon: Landmark },
      { id: "superendividamento", name: "Superendividamento", description: "Crie um plano de pagamento das dívidas que considere a renda e o mínimo existencial do cliente.", icon: FileText },
      { id: "rmc_rcc", name: "RMC e RCC INSS", description: "Rever os empréstimos de cartão de crédito sobre as reservas de margem consignável RMC e RCC.", icon: Building2 },
      { id: "juros_simples_compostos", name: "Juros Simples e Compostos", description: "Descubra o valor futuro para juros simples ou compostos e converta a taxas para períodos diferentes.", icon: Percent },
      { id: "amortizacao_comparativa", name: "Amortização Comparativa", description: "Compare parcelas, juros e total financiado em Price, SAC, SACRE e MEJS/MAJS.", icon: Calculator },
      { id: "financiamento", name: "Financiamento e Empréstimos", description: "Descubra o valor da parcela, juros e total financiado em diferentes métodos de amortização.", icon: Briefcase },
      { id: "taxa_media_bacen", name: "Taxa Média BACEN", description: "Consulte a taxa média de juros do BACEN e descubra se é mais vantajoso para o consumidor.", icon: Percent },
      { id: "busca_apreensao", name: "Busca e Apreensão", description: "Defesa em ação de busca e apreensão: purga da mora, revisional e restituição (DL 911/69).", icon: Car },
      { id: "revisao_ccb", name: "Revisão de CCB", description: "Rever Cédulas de Crédito Bancário: CET efetiva, anatocismo, comissão de permanência (Lei 10.931/2004).", icon: FileText },
      { id: "capital_giro", name: "Capital de Giro / Fomento", description: "Calcule custos de capital de giro, factoring e desconto de duplicatas com CET.", icon: Building2 },
      { id: "credito_rural", name: "Revisão de Crédito Rural", description: "Revise contratos de crédito rural conforme limites do PRONAF, PRONAMP e demais modalidades.", icon: Wheat },
      { id: "atualizacao_divida", name: "Atualização de Dívida", description: "Recálculo de contratos bancários com taxas abusivas.", icon: Percent },
    ],
  },
  {
    id: "penal", label: "Penal", icon: Gavel,
    calculadoras: [
      { id: "dosimetria_pena", name: "Dosimetria da Pena", description: "Cálculo trifásico para fixação da pena (base, agravantes, causas de aumento).", icon: Scale },
      { id: "prescricao", name: "Prescrição Penal", description: "Verifique os prazos prescricionais com base na pena aplicada.", icon: Clock },
      { id: "progressao_regime", name: "Progressão de Regime", description: "Acompanhe a execução penal incluindo remição, detração, interrupção e faltas graves.", icon: Gavel },
    ],
  },
  {
    id: "familiar", label: "Familiar", icon: Heart,
    calculadoras: [
      { id: "divorcio", name: "Divórcio", description: "Simule a divisão de bens e gere um formal de partilha claro e objetivo.", icon: Heart },
      { id: "pensao_alimenticia", name: "Pensão Alimentícia", description: "Encontre o valor devido de alimentos com relatório detalhado de despesas e três abordagens de design.", icon: Calculator },
      { id: "heranca", name: "Herança", description: "Calcular a linha de sucessão e a divisão de bens para cada herdeiro com base no regime de bens e grau de parentesco.", icon: Home },
      { id: "sucessor", name: "Sucessor", description: "Compare custos de inventário judicial, extrajudicial, doação com usufruto e holding familiar.", icon: Briefcase },
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
  trabalhista_geral: TrabalhistaCalc,
  correcao_fgts: CorrecaoFgtsCalc,
  atualizacao_divida: AtualizacaoDividaCalc,
  juros_simples_compostos: JurosCompostosCalc,
  dosimetria_pena: DosimetriaPenaCalc,
  prescricao: PrescricaoPenalCalc,
  progressao_regime: ProgressaoRegimeCalc,
  pensao_alimenticia: PensaoAlimenticiaCalc,
  partilha_bens: PartilhaBensCalc,
  divorcio: DivorcioCalc,
  heranca: HerancaCalc,
  sucessor: SucessorCalc,
  distrato_imovel: DistratoImovelCalc,
  dano_moral: DanoMoralCalc,
  cobranca_indevida: CobrancaIndevidaCalc,
  revisao_bancaria: RevisaoBancariaCalc,
  superendividamento: SuperendividamentoCalc,
  rmc_rcc: RmcRccCalc,
  amortizacao_comparativa: AmortizacaoComparativaCalc,
  financiamento: FinanciamentoCalc,
  taxa_media_bacen: TaxaMediaBacenCalc,
  busca_apreensao: BuscaApreensaoCalc,
  revisao_ccb: RevisaoCcbCalc,
  capital_giro: CapitalGiroCalc,
  credito_rural: CreditoRuralCalc,
  fator_previdenciario: FatorPrevidenciarioCalc,
  inss_restituicao: InssRestituicaoCalc,
  revisao_pasep: RevisaoPasepCalc,
  contribuicoes_atraso: ContribuicoesAtrasoCalc,
  restabelecimento: RestabelecimentoCalc,
  complementacao: ComplementacaoCalc,
  bpc_loas: BpcLoasCalc,
  restituicao_teto: RestituicaoTetoCalc,
  restituicao_ir_doenca: RestituicaoIrDoencaCalc,
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
