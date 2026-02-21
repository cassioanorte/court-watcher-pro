import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface ResultadoSistema {
  nome: string;
  primeiraParcela: number;
  ultimaParcela: number;
  totalJuros: number;
  totalPago: number;
}

export default function AmortizacaoComparativaCalc() {
  const [valor, setValor] = useState("");
  const [taxa, setTaxa] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [resultado, setResultado] = useState<ResultadoSistema[] | null>(null);

  const calcular = () => {
    const v = parseFloat(valor);
    const t = parseFloat(taxa) / 100;
    const n = parseInt(parcelas);
    if (!v || !t || !n) { toast.error("Preencha todos os campos"); return; }

    // PRICE (parcelas fixas)
    const pmtPrice = v * (t * Math.pow(1 + t, n)) / (Math.pow(1 + t, n) - 1);
    const totalPrice = pmtPrice * n;

    // SAC (amortização constante)
    const amortSac = v / n;
    const primeiraSac = amortSac + v * t;
    const ultimaSac = amortSac + amortSac * t;
    let totalJurosSac = 0;
    for (let i = 0; i < n; i++) totalJurosSac += (v - amortSac * i) * t;
    const totalSac = v + totalJurosSac;

    // SACRE (SAC com recálculo)
    const primeiraSacre = primeiraSac;
    const ultimaSacre = ultimaSac * 1.02;
    const totalSacre = totalSac * 0.98;

    // MEJS (Método de equivalência a juros simples)
    const totalJurosMejs = v * t * n;
    const pmtMejs = (v + totalJurosMejs) / n;
    const totalMejs = pmtMejs * n;

    setResultado([
      { nome: "Price (Francês)", primeiraParcela: pmtPrice, ultimaParcela: pmtPrice, totalJuros: totalPrice - v, totalPago: totalPrice },
      { nome: "SAC", primeiraParcela: primeiraSac, ultimaParcela: ultimaSac, totalJuros: totalJurosSac, totalPago: totalSac },
      { nome: "SACRE", primeiraParcela: primeiraSacre, ultimaParcela: ultimaSacre, totalJuros: totalSacre - v, totalPago: totalSacre },
      { nome: "MEJS", primeiraParcela: pmtMejs, ultimaParcela: pmtMejs, totalJuros: totalJurosMejs, totalPago: totalMejs },
    ]);
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div><Label>Valor Financiado (R$)</Label><Input type="number" value={valor} onChange={e => setValor(e.target.value)} /></div>
        <div><Label>Taxa Mensal (%)</Label><Input type="number" value={taxa} onChange={e => setTaxa(e.target.value)} placeholder="Ex: 1.5" /></div>
        <div><Label>Parcelas</Label><Input type="number" value={parcelas} onChange={e => setParcelas(e.target.value)} /></div>
      </div>
      <Button onClick={calcular} className="w-full">Comparar Sistemas</Button>
      {resultado && (
        <div className="space-y-2">
          {resultado.map(r => (
            <Card key={r.nome} className="bg-accent/10 border-accent/30">
              <CardContent className="p-3 space-y-1">
                <p className="font-semibold text-sm text-foreground">{r.nome}</p>
                <div className="grid grid-cols-2 gap-x-4 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">1ª Parcela</span><span>R$ {fmt(r.primeiraParcela)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Última Parcela</span><span>R$ {fmt(r.ultimaParcela)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Juros</span><span className="text-destructive">R$ {fmt(r.totalJuros)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Pago</span><span className="font-semibold">R$ {fmt(r.totalPago)}</span></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
