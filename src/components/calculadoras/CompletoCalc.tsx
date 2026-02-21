import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DollarSign, CalendarDays, TrendingUp, Percent, BarChart3, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type TipoCalculo = "debito_judicial" | "debito_extrajudicial" | "atualizacao_simples" | "personalizado";

const steps = [
  { id: 0, label: "Valor", icon: DollarSign },
  { id: 1, label: "Período", icon: CalendarDays },
  { id: 2, label: "Correção", icon: TrendingUp },
  { id: 3, label: "Juros", icon: Percent },
  { id: 4, label: "Resultado", icon: BarChart3 },
];

const presets: Record<TipoCalculo, { indice: string; tipoJuros: string; taxa: string }> = {
  debito_judicial: { indice: "ipca", tipoJuros: "simples", taxa: "1" },
  debito_extrajudicial: { indice: "igpm", tipoJuros: "compostos", taxa: "1" },
  atualizacao_simples: { indice: "ipca", tipoJuros: "nenhum", taxa: "0" },
  personalizado: { indice: "ipca", tipoJuros: "simples", taxa: "1" },
};

export default function CompletoCalc() {
  const [step, setStep] = useState(0);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoCalculo, setTipoCalculo] = useState<TipoCalculo>("debito_judicial");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [indice, setIndice] = useState("ipca");
  const [tipoJuros, setTipoJuros] = useState("simples");
  const [taxaJuros, setTaxaJuros] = useState("1");
  const [resultado, setResultado] = useState<{ original: number; corrigido: number; juros: number; total: number } | null>(null);

  const valorNum = parseFloat(valor) || 0;

  const handleTipoChange = (tipo: TipoCalculo) => {
    setTipoCalculo(tipo);
    const p = presets[tipo];
    setIndice(p.indice);
    setTipoJuros(p.tipoJuros);
    setTaxaJuros(p.taxa);
  };

  const canNext = () => {
    if (step === 0) return valorNum > 0;
    if (step === 1) return !!dataInicio && !!dataFim;
    return true;
  };

  const calcular = () => {
    const d1 = new Date(dataInicio);
    const d2 = new Date(dataFim);
    const meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    if (meses <= 0) { toast.error("A data final deve ser posterior à inicial"); return false; }

    const taxasIndice: Record<string, number> = { ipca: 0.004, inpc: 0.0045, selic: 0.008, igpm: 0.005, tr: 0.001 };
    const taxaIdx = taxasIndice[indice] || 0.004;
    const taxaJ = parseFloat(taxaJuros) / 100 || 0;

    const corrigido = valorNum * Math.pow(1 + taxaIdx, meses);
    let jurosVal = 0;

    if (tipoJuros === "simples") {
      jurosVal = corrigido * taxaJ * meses;
    } else if (tipoJuros === "compostos") {
      jurosVal = corrigido * (Math.pow(1 + taxaJ, meses) - 1);
    }

    setResultado({ original: valorNum, corrigido, juros: jurosVal, total: corrigido + jurosVal });
    return true;
  };

  const handleNext = () => {
    if (!canNext()) { toast.error("Preencha todos os campos obrigatórios"); return; }
    if (step === 3) {
      if (calcular()) setStep(4);
    } else {
      setStep(s => s + 1);
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="flex items-center justify-between px-1">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all",
                step > i ? "bg-accent text-accent-foreground" : step === i ? "bg-accent/20 text-accent border-2 border-accent" : "bg-muted text-muted-foreground"
              )}>
                {step > i ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </div>
              <span className={cn("text-[10px]", step >= i ? "text-accent font-medium" : "text-muted-foreground")}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-1.5 mt-[-16px]", step > i ? "bg-accent" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          {step === 0 && (
            <>
              <h3 className="font-semibold text-foreground">Valor</h3>
              <div>
                <Label className="font-medium text-foreground text-sm">Valor principal (R$)</Label>
                <Input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="10000" className="mt-1" />
                {valorNum > 0 && (
                  <span className="inline-block mt-2 text-xs font-medium bg-accent/10 text-accent px-2 py-1 rounded">
                    R$ {fmt(valorNum)}
                  </span>
                )}
              </div>
              <div>
                <Label className="font-medium text-foreground text-sm">Descrição</Label>
                <p className="text-[11px] text-muted-foreground mb-1">Opcional — para identificação do cálculo</p>
                <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Ação nº 0001234-56.2024..." rows={3} />
              </div>
              <div>
                <Label className="font-medium text-foreground text-sm">Tipo de cálculo</Label>
                <div className="space-y-2 mt-2">
                  {([
                    { value: "debito_judicial", label: "Débito judicial", desc: "Ações judiciais com correção e juros legais" },
                    { value: "debito_extrajudicial", label: "Débito extrajudicial", desc: "Cobranças, acordos e títulos extrajudiciais" },
                    { value: "atualizacao_simples", label: "Atualização simples", desc: "Apenas política monetária correção sem juros" },
                    { value: "personalizado", label: "Personalizado", desc: "Configurar índices e juros livremente" },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleTipoChange(opt.value)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all",
                        tipoCalculo === opt.value ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                      )}
                    >
                      <p className="font-medium text-sm text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h3 className="font-semibold text-foreground">Período</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Data Início</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Data Fim</Label>
                  <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="font-semibold text-foreground">Correção Monetária</h3>
              <div>
                <Label className="text-muted-foreground text-xs">Índice de correção</Label>
                <Select value={indice} onValueChange={setIndice}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ipca">IPCA (IBGE)</SelectItem>
                    <SelectItem value="inpc">INPC (IBGE)</SelectItem>
                    <SelectItem value="selic">SELIC (BCB)</SelectItem>
                    <SelectItem value="igpm">IGP-M (FGV)</SelectItem>
                    <SelectItem value="tr">TR (BCB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {tipoCalculo === "debito_judicial" && "Para débitos judiciais, o IPCA é o índice padrão conforme jurisprudência do STJ."}
                {tipoCalculo === "debito_extrajudicial" && "Para débitos extrajudiciais, o IGP-M é comumente utilizado em contratos."}
                {tipoCalculo === "atualizacao_simples" && "Apenas correção monetária será aplicada, sem juros."}
                {tipoCalculo === "personalizado" && "Escolha o índice que melhor se adequa ao seu caso."}
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="font-semibold text-foreground">Juros</h3>
              {tipoCalculo === "atualizacao_simples" ? (
                <p className="text-sm text-muted-foreground">Nenhum juros será aplicado neste tipo de cálculo.</p>
              ) : (
                <>
                  <div>
                    <Label className="text-muted-foreground text-xs">Tipo de juros</Label>
                    <Select value={tipoJuros} onValueChange={setTipoJuros}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simples">Juros Simples</SelectItem>
                        <SelectItem value="compostos">Juros Compostos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Taxa de juros (% a.m.)</Label>
                    <Input type="number" value={taxaJuros} onChange={e => setTaxaJuros(e.target.value)} step="0.1" />
                  </div>
                </>
              )}
            </>
          )}

          {step === 4 && resultado && (
            <>
              <h3 className="font-semibold text-foreground">Resultado</h3>
              {descricao && <p className="text-xs text-muted-foreground italic">{descricao}</p>}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor original</span>
                  <span className="text-foreground">R$ {fmt(resultado.original)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Correção monetária ({indice.toUpperCase()})</span>
                  <span className="text-foreground">R$ {fmt(resultado.corrigido - resultado.original)}</span>
                </div>
                {resultado.juros > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Juros ({tipoJuros})</span>
                    <span className="text-foreground">R$ {fmt(resultado.juros)}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold text-foreground">Total atualizado</span>
                  <span className="text-xl font-bold text-accent">R$ {fmt(resultado.total)}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div key={i} className={cn("w-2 h-2 rounded-full", step === i ? "bg-accent" : "bg-muted")} />
          ))}
        </div>
        {step < 4 ? (
          <Button size="sm" onClick={handleNext} disabled={!canNext()}>
            Próximo <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => { setStep(0); setResultado(null); }}>
            Novo cálculo
          </Button>
        )}
      </div>
    </div>
  );
}
