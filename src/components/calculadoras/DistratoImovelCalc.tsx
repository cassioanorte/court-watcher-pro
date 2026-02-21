import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const tipos = [
  { value: "sem_afetacao", label: "Incorporação SEM patrimônio de afetação", desc: "Lei 4.591/64 c/ alterações da Lei 13.786/2018 — retenção de até 25%", retencao: 0.25 },
  { value: "com_afetacao", label: "Incorporação COM patrimônio de afetação", desc: "Arte. 67-A, §5° Lei 4.591/64 — retenção de até 50%", retencao: 0.50 },
  { value: "loteamento", label: "Loteamento", desc: "Lei 6.766/79 c/ alterações da Lei 13.786/2018 — retenção de até 10%", retencao: 0.10 },
];

const causas = [
  { value: "comprador", label: "Comprador", desc: "Desistência voluntária — aplicação temporária" },
  { value: "incorporador", label: "Incorporador / Vendedor", desc: "Atraso na entrega, vínculos — devolução integral" },
];

export default function DistratoImovelCalc() {
  const [valorPago, setValorPago] = useState("");
  const [tipo, setTipo] = useState("sem_afetacao");
  const [causa, setCausa] = useState("comprador");
  const [resultado, setResultado] = useState<{ retencao: number; restituicao: number; percentual: number } | null>(null);

  const calcular = () => {
    const v = parseFloat(valorPago);
    if (!v) { toast.error("Informe o valor pago"); return; }

    if (causa === "incorporador") {
      // Culpa do incorporador: devolução integral
      setResultado({ retencao: 0, restituicao: v, percentual: 0 });
      return;
    }

    const tipoSel = tipos.find(t => t.value === tipo);
    const percentRetencao = tipoSel?.retencao || 0.25;
    const retencao = v * percentRetencao;
    setResultado({ retencao, restituicao: v - retencao, percentual: percentRetencao * 100 });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold">Tipo de empreendimento</Label>
        <div className="space-y-2 mt-2">
          {tipos.map(t => (
            <button
              key={t.value}
              onClick={() => setTipo(t.value)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all",
                tipo === t.value ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
              )}
            >
              <p className="font-medium text-sm text-foreground">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold">Quem deu causa ao distrato?</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {causas.map(c => (
            <button
              key={c.value}
              onClick={() => setCausa(c.value)}
              className={cn(
                "text-left p-3 rounded-lg border transition-all",
                causa === c.value ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
              )}
            >
              <p className="font-medium text-sm text-foreground">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Total Pago ao Incorporador (R$)</Label>
        <Input type="number" value={valorPago} onChange={e => setValorPago(e.target.value)} placeholder="Ex: 150000" />
      </div>

      <Button onClick={calcular} className="w-full">Calcular Distrato</Button>

      {resultado && (
        <Card className={causa === "incorporador" ? "bg-green-500/10 border-green-500/30" : "bg-accent/10 border-accent/30"}>
          <CardContent className="p-4 space-y-2">
            {causa === "incorporador" ? (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Culpa do incorporador/vendedor</p>
                <p className="text-2xl font-bold text-foreground">Devolução integral</p>
                <p className="text-lg font-bold text-green-600">R$ {resultado.restituicao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Retenção máxima ({resultado.percentual}%)</span>
                  <span className="font-semibold text-destructive">R$ {resultado.retencao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="text-sm font-bold text-foreground">Restituição mínima</span>
                  <span className="text-lg font-bold text-green-600">R$ {resultado.restituicao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
