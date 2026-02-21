import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function RmcRccCalc() {
  const [beneficio, setBeneficio] = useState("");
  const [valorEmprestimo, setValorEmprestimo] = useState("");
  const [taxaMensal, setTaxaMensal] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [tipo, setTipo] = useState("rmc");
  const [resultado, setResultado] = useState<{
    limiteReserva: number; parcelaCalculada: number; parcelaMaxima: number;
    excedeu: boolean; totalPago: number; jurosTotal: number;
  } | null>(null);

  const calcular = () => {
    const b = parseFloat(beneficio);
    const v = parseFloat(valorEmprestimo);
    const t = parseFloat(taxaMensal) / 100;
    const n = parseInt(parcelas);
    if (!b || !v || !t || !n) { toast.error("Preencha todos os campos"); return; }

    // RMC: limite 5% do benefício | RCC: limite 5% do benefício (cartão)
    const percentual = tipo === "rmc" ? 0.05 : 0.05;
    const limiteReserva = b * percentual;
    const parcelaCalculada = v * (t * Math.pow(1 + t, n)) / (Math.pow(1 + t, n) - 1);
    const parcelaMaxima = limiteReserva;
    const totalPago = parcelaCalculada * n;

    setResultado({ limiteReserva, parcelaCalculada, parcelaMaxima, excedeu: parcelaCalculada > parcelaMaxima, totalPago, jurosTotal: totalPago - v });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor do Benefício (R$)</Label><Input type="number" value={beneficio} onChange={e => setBeneficio(e.target.value)} /></div>
        <div><Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rmc">RMC (Reserva de Margem Consignável)</SelectItem>
              <SelectItem value="rcc">RCC (Cartão de Crédito Consignado)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Valor do Empréstimo (R$)</Label><Input type="number" value={valorEmprestimo} onChange={e => setValorEmprestimo(e.target.value)} /></div>
        <div><Label>Nº de Parcelas</Label><Input type="number" value={parcelas} onChange={e => setParcelas(e.target.value)} /></div>
        <div className="col-span-2"><Label>Taxa Mensal (%)</Label><Input type="number" value={taxaMensal} onChange={e => setTaxaMensal(e.target.value)} placeholder="Ex: 2.5" /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className={`border ${resultado.excedeu ? "bg-destructive/10 border-destructive/30" : "bg-accent/10 border-accent/30"}`}>
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Limite de Reserva (5%)</span><span className="font-semibold">R$ {fmt(resultado.limiteReserva)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Parcela Calculada</span><span className={`font-semibold ${resultado.excedeu ? "text-destructive" : "text-green-600"}`}>R$ {fmt(resultado.parcelaCalculada)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total Pago</span><span className="font-semibold">R$ {fmt(resultado.totalPago)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total de Juros</span><span className="font-semibold text-destructive">R$ {fmt(resultado.jurosTotal)}</span></div>
            {resultado.excedeu && <p className="text-xs text-destructive font-medium mt-2">⚠ Parcela excede o limite de reserva de margem consignável</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
