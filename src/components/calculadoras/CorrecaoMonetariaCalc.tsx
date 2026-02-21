import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function CorrecaoMonetariaCalc() {
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
