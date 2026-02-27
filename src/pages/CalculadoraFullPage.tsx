import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Clock, Calculator, Building2 } from "lucide-react";
import { printReport } from "@/lib/printReport";
import TempoContribuicaoCalc from "@/components/calculadoras/TempoContribuicaoCalc";
import FatorPrevidenciarioCalc from "@/components/calculadoras/FatorPrevidenciarioCalc";

const fullPageCalcs: Record<string, { name: string; description: string; icon: typeof Calculator; component: React.FC }> = {
  tempo_contribuicao: {
    name: "Tempo de Contribuição",
    description: "Calcule o tempo total de contribuição a partir dos vínculos.",
    icon: Clock,
    component: TempoContribuicaoCalc,
  },
  fator_previdenciario: {
    name: "Fator Previdenciário",
    description: "Calcule o fator previdenciário com base na idade, tempo de contribuição e expectativa de sobrevida.",
    icon: Calculator,
    component: FatorPrevidenciarioCalc,
  },
};

export const FULL_PAGE_CALC_IDS = new Set(Object.keys(fullPageCalcs));

export default function CalculadoraFullPage() {
  const { calcId } = useParams<{ calcId: string }>();
  const navigate = useNavigate();

  const calc = calcId ? fullPageCalcs[calcId] : null;
  if (!calc) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Calculadora não encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/calculadoras")}>
          Voltar
        </Button>
      </div>
    );
  }

  const CalcComponent = calc.component;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/calculadoras")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <calc.icon className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{calc.name}</h1>
            <p className="text-sm text-muted-foreground">{calc.description}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const printArea = document.getElementById("calc-print-area");
            if (!printArea) return;
            printReport({
              title: calc.name,
              subtitle: calc.description,
              content: printArea.innerHTML,
            });
          }}
        >
          <Printer className="w-3.5 h-3.5" /> Imprimir
        </Button>
      </div>

      <div id="calc-print-area">
        <CalcComponent />
      </div>
    </div>
  );
}
