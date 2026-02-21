import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, CalendarDays, Percent, BarChart3, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type TipoCalculo = "correcao" | "juros" | "correcao_juros";
type TipoJuros = "simples" | "compostos" | "moratorios";

const steps = [
  { id: 0, label: "Valor", icon: DollarSign },
  { id: 1, label: "Período", icon: CalendarDays },
  { id: 2, label: "Índice e Juros", icon: Percent },
  { id: 3, label: "Resultado", icon: BarChart3 },
];

export default function FacilCalc() {
  const [step, setStep] = useState(0);
  const [valor, setValor] = useState("");
  const [tipoCalculo, setTipoCalculo] = useState<TipoCalculo>("correcao_juros");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [indice, setIndice] = useState("ipca");
  const [tipoJuros, setTipoJuros] = useState<TipoJuros>("simples");
  const [taxaJuros, setTaxaJuros] = useState("1");
  const [resultado, setResultado] = useState<{ corrigido: number; juros: number; total: number } | null>(null);

  const valorNum = parseFloat(valor) || 0;

  const canNext = () => {
    if (step === 0) return valorNum > 0 && !!tipoCalculo;
    if (step === 1) return !!dataInicio && !!dataFim;
    if (step === 2) return true;
    return true;
  };

  const calcular = () => {
    const d1 = new Date(dataInicio);
    const d2 = new Date(dataFim);
    const meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    if (meses <= 0) { toast.error("A data final deve ser posterior à inicial"); return false; }

    const taxasIndice: Record<string, number> = { ipca: 0.004, inpc: 0.0045, selic: 0.008, igpm: 0.005, tr: 0.001 };
    const taxaIdx = taxasIndice[indice] || 0.004;
    const taxaJ = parseFloat(taxaJuros) / 100 || 0.01;

    let corrigido = valorNum;
    let jurosVal = 0;

    if (tipoCalculo === "correcao" || tipoCalculo === "correcao_juros") {
      corrigido = valorNum * Math.pow(1 + taxaIdx, meses);
    }

    if (tipoCalculo === "juros" || tipoCalculo === "correcao_juros") {
      const base = tipoCalculo === "correcao_juros" ? corrigido : valorNum;
      if (tipoJuros === "simples" || tipoJuros === "moratorios") {
        jurosVal = base * taxaJ * meses;
      } else {
        jurosVal = base * (Math.pow(1 + taxaJ, meses) - 1);
      }
    }

    setResultado({ corrigido, juros: jurosVal, total: corrigido + jurosVal });
    return true;
  };

  const handleNext = () => {
    if (!canNext()) { toast.error("Preencha todos os campos"); return; }
    if (step === 2) {
      if (calcular()) setStep(3);
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="flex items-center justify-between px-2">
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
              <div className={cn("flex-1 h-0.5 mx-2 mt-[-16px]", step > i ? "bg-accent" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-5 space-y-4">
          {step === 0 && (
            <>
              <h3 className="font-semibold text-foreground">Valor</h3>
              <div>
                <Label className="text-muted-foreground text-xs">Valor a atualizar (R$)</Label>
                <p className="text-[11px] text-muted-foreground mb-1">Informe o valor original que deseja concordar</p>
                <Input type="number" value={valor} onChange={e => setValor(e.target.value)} placeholder="10000" />
                {valorNum > 0 && (
                  <span className="inline-block mt-2 text-xs font-medium bg-accent/10 text-accent px-2 py-1 rounded">
                    R$ {valorNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Tipo de cálculo</Label>
                <p className="text-[11px] text-muted-foreground mb-2">O que deseja aplicar sobre o valor?</p>
                <div className="space-y-2">
                  {([
                    { value: "correcao", label: "Correção", desc: "Aplicar um índice econômico (IPCA, INPC, etc.)" },
                    { value: "juros", label: "Juros", desc: "Calcular juros simples, compostos ou moratórios" },
                    { value: "correcao_juros", label: "Correção + Juros", desc: "Aplicação de correção monetária e juros sobre o valor" },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTipoCalculo(opt.value)}
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
              <h3 className="font-semibold text-foreground">Índice e Juros</h3>
              {(tipoCalculo === "correcao" || tipoCalculo === "correcao_juros") && (
                <div>
                  <Label className="text-muted-foreground text-xs">Índice de correção</Label>
                  <Select value={indice} onValueChange={setIndice}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ipca">IPCA</SelectItem>
                      <SelectItem value="inpc">INPC</SelectItem>
                      <SelectItem value="selic">SELIC</SelectItem>
                      <SelectItem value="igpm">IGP-M</SelectItem>
                      <SelectItem value="tr">TR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(tipoCalculo === "juros" || tipoCalculo === "correcao_juros") && (
                <>
                  <div>
                    <Label className="text-muted-foreground text-xs">Tipo de juros</Label>
                    <Select value={tipoJuros} onValueChange={v => setTipoJuros(v as TipoJuros)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simples">Juros Simples</SelectItem>
                        <SelectItem value="compostos">Juros Compostos</SelectItem>
                        <SelectItem value="moratorios">Juros Moratórios (1% a.m.)</SelectItem>
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

          {step === 3 && resultado && (
            <>
              <h3 className="font-semibold text-foreground">Resultado</h3>
              <div className="space-y-3">
                {(tipoCalculo === "correcao" || tipoCalculo === "correcao_juros") && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor corrigido</span>
                    <span className="font-medium text-foreground">R$ {resultado.corrigido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {(tipoCalculo === "juros" || tipoCalculo === "correcao_juros") && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Juros acumulados</span>
                    <span className="font-medium text-foreground">R$ {resultado.juros.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-xl font-bold text-accent">R$ {resultado.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
        {step < 3 && (
          <Button size="sm" onClick={handleNext} disabled={!canNext()}>
            Próximo <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
        {step === 3 && (
          <Button size="sm" variant="outline" onClick={() => { setStep(0); setResultado(null); }}>
            Novo cálculo
          </Button>
        )}
      </div>
    </div>
  );
}
