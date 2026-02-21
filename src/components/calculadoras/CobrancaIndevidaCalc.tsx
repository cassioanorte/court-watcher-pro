import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function CobrancaIndevidaCalc() {
  const [valorCobrado, setValorCobrado] = useState("");
  const [valorDevido, setValorDevido] = useState("0");
  const [indiceCorrecao, setIndiceCorrecao] = useState("selic");
  const [mesesCorrecao, setMesesCorrecao] = useState("");
  const [resultado, setResultado] = useState<{ excesso: number; devolucaoDobro: number; corrigido: number } | null>(null);

  const calcular = () => {
    const cobrado = parseFloat(valorCobrado);
    const devido = parseFloat(valorDevido) || 0;
    if (!cobrado) { toast.error("Informe o valor cobrado"); return; }
    if (cobrado <= devido) { toast.error("O valor cobrado deve ser maior que o devido"); return; }

    const excesso = cobrado - devido;
    const devolucaoDobro = excesso * 2; // Art. 42, parágrafo único CDC
    const meses = parseInt(mesesCorrecao) || 0;
    const taxas: Record<string, number> = { selic: 0.008, ipca: 0.004, inpc: 0.0045 };
    const taxa = taxas[indiceCorrecao] || 0.008;
    const corrigido = meses > 0 ? devolucaoDobro * Math.pow(1 + taxa, meses) : devolucaoDobro;

    setResultado({ excesso, devolucaoDobro, corrigido });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor Cobrado (R$)</Label><Input type="number" value={valorCobrado} onChange={e => setValorCobrado(e.target.value)} /></div>
        <div><Label>Valor Realmente Devido (R$)</Label><Input type="number" value={valorDevido} onChange={e => setValorDevido(e.target.value)} placeholder="0 se nada era devido" /></div>
        <div><Label>Índice de Correção</Label>
          <Select value={indiceCorrecao} onValueChange={setIndiceCorrecao}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="selic">SELIC</SelectItem>
              <SelectItem value="ipca">IPCA</SelectItem>
              <SelectItem value="inpc">INPC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Meses para Correção</Label><Input type="number" value={mesesCorrecao} onChange={e => setMesesCorrecao(e.target.value)} placeholder="Opcional" /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Excesso Cobrado</span><span className="font-semibold">R$ {resultado.excesso.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Devolução em Dobro (Art. 42 CDC)</span><span className="font-semibold">R$ {resultado.devolucaoDobro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Valor Corrigido</span><span className="text-lg font-bold text-foreground">R$ {resultado.corrigido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
