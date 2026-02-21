import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function FinanciamentoCalc() {
  const [valor, setValor] = useState("");
  const [taxa, setTaxa] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [sistema, setSistema] = useState("price");
  const [resultado, setResultado] = useState<{
    parcela: number; totalPago: number; totalJuros: number; cet: number;
  } | null>(null);

  const calcular = () => {
    const v = parseFloat(valor);
    const t = parseFloat(taxa) / 100;
    const n = parseInt(parcelas);
    if (!v || !t || !n) { toast.error("Preencha todos os campos"); return; }

    let parcela: number, totalPago: number;
    if (sistema === "price") {
      parcela = v * (t * Math.pow(1 + t, n)) / (Math.pow(1 + t, n) - 1);
      totalPago = parcela * n;
    } else {
      const amort = v / n;
      parcela = amort + v * t; // primeira parcela
      let total = 0;
      for (let i = 0; i < n; i++) total += amort + (v - amort * i) * t;
      totalPago = total;
    }
    const totalJuros = totalPago - v;
    const cet = (Math.pow(totalPago / v, 1 / (n / 12)) - 1) * 100;
    setResultado({ parcela, totalPago, totalJuros, cet });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor do Financiamento (R$)</Label><Input type="number" value={valor} onChange={e => setValor(e.target.value)} /></div>
        <div><Label>Nº de Parcelas</Label><Input type="number" value={parcelas} onChange={e => setParcelas(e.target.value)} /></div>
        <div><Label>Taxa Mensal (%)</Label><Input type="number" value={taxa} onChange={e => setTaxa(e.target.value)} placeholder="Ex: 1.5" /></div>
        <div><Label>Sistema de Amortização</Label>
          <Select value={sistema} onValueChange={setSistema}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="price">Price (Parcelas Fixas)</SelectItem>
              <SelectItem value="sac">SAC (Amortização Constante)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">{sistema === "price" ? "Parcela Fixa" : "1ª Parcela"}</span><span className="font-semibold">R$ {fmt(resultado.parcela)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total de Juros</span><span className="font-semibold text-destructive">R$ {fmt(resultado.totalJuros)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">CET Estimado (% a.a.)</span><span className="font-semibold">{resultado.cet.toFixed(2)}%</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Total Pago</span><span className="text-lg font-bold text-foreground">R$ {fmt(resultado.totalPago)}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
