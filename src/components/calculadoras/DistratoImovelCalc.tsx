import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function DistratoImovelCalc() {
  const [valorPago, setValorPago] = useState("");
  const [tipoIncorporacao, setTipoIncorporacao] = useState("patrimonio_afetacao");
  const [resultado, setResultado] = useState<{ retencao: number; restituicao: number } | null>(null);

  const calcular = () => {
    const v = parseFloat(valorPago);
    if (!v) { toast.error("Informe o valor pago"); return; }

    // Lei 13.786/2018
    // Patrimônio de afetação: retenção até 50%
    // Sem patrimônio de afetação: retenção até 25%
    const percentRetencao = tipoIncorporacao === "patrimonio_afetacao" ? 0.5 : 0.25;
    const retencao = v * percentRetencao;
    setResultado({ retencao, restituicao: v - retencao });
  };

  return (
    <div className="space-y-4">
      <div><Label>Total Pago ao Incorporador (R$)</Label><Input type="number" value={valorPago} onChange={e => setValorPago(e.target.value)} /></div>
      <div><Label>Tipo de Incorporação</Label>
        <Select value={tipoIncorporacao} onValueChange={setTipoIncorporacao}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="patrimonio_afetacao">Com Patrimônio de Afetação (retenção até 50%)</SelectItem>
            <SelectItem value="sem_afetacao">Sem Patrimônio de Afetação (retenção até 25%)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Retenção Máxima</span><span className="font-semibold text-destructive">R$ {resultado.retencao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Restituição Mínima</span><span className="text-lg font-bold text-green-600">R$ {resultado.restituicao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
