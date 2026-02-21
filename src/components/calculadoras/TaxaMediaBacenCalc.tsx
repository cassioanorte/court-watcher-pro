import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const TAXAS_BACEN: Record<string, { mensal: number; anual: number }> = {
  pessoal: { mensal: 6.5, anual: 112.7 },
  consignado: { mensal: 1.8, anual: 23.9 },
  veiculos: { mensal: 1.6, anual: 20.9 },
  cheque_especial: { mensal: 7.8, anual: 147.2 },
  cartao_rotativo: { mensal: 13.5, anual: 349.5 },
  cartao_parcelado: { mensal: 7.2, anual: 131.0 },
  capital_giro: { mensal: 2.1, anual: 28.3 },
  conta_garantida: { mensal: 5.8, anual: 96.7 },
};

export default function TaxaMediaBacenCalc() {
  const [modalidade, setModalidade] = useState("pessoal");
  const [taxaContratual, setTaxaContratual] = useState("");
  const [valorEmprestimo, setValorEmprestimo] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [resultado, setResultado] = useState<{
    taxaBacen: number; taxaContratual: number; diferenca: number;
    economia: number; abusiva: boolean;
  } | null>(null);

  const calcular = () => {
    const tc = parseFloat(taxaContratual);
    const v = parseFloat(valorEmprestimo);
    const n = parseInt(parcelas);
    if (!tc) { toast.error("Informe a taxa contratual"); return; }

    const bacen = TAXAS_BACEN[modalidade];
    const diferenca = tc - bacen.mensal;
    let economia = 0;
    if (v && n) {
      const pmtContratual = v * ((tc / 100) * Math.pow(1 + tc / 100, n)) / (Math.pow(1 + tc / 100, n) - 1);
      const pmtBacen = v * ((bacen.mensal / 100) * Math.pow(1 + bacen.mensal / 100, n)) / (Math.pow(1 + bacen.mensal / 100, n) - 1);
      economia = (pmtContratual - pmtBacen) * n;
    }

    setResultado({ taxaBacen: bacen.mensal, taxaContratual: tc, diferenca, economia, abusiva: tc > bacen.mensal * 1.5 });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Modalidade de Crédito</Label>
          <Select value={modalidade} onValueChange={setModalidade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pessoal">Crédito Pessoal</SelectItem>
              <SelectItem value="consignado">Consignado</SelectItem>
              <SelectItem value="veiculos">Veículos</SelectItem>
              <SelectItem value="cheque_especial">Cheque Especial</SelectItem>
              <SelectItem value="cartao_rotativo">Cartão Rotativo</SelectItem>
              <SelectItem value="cartao_parcelado">Cartão Parcelado</SelectItem>
              <SelectItem value="capital_giro">Capital de Giro</SelectItem>
              <SelectItem value="conta_garantida">Conta Garantida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Taxa Contratual (% a.m.)</Label><Input type="number" value={taxaContratual} onChange={e => setTaxaContratual(e.target.value)} /></div>
        <div><Label>Valor do Empréstimo (R$)</Label><Input type="number" value={valorEmprestimo} onChange={e => setValorEmprestimo(e.target.value)} placeholder="Opcional" /></div>
        <div><Label>Nº de Parcelas</Label><Input type="number" value={parcelas} onChange={e => setParcelas(e.target.value)} placeholder="Opcional" /></div>
      </div>
      <p className="text-xs text-muted-foreground">Taxa Média BACEN ({modalidade.replace("_", " ")}): {TAXAS_BACEN[modalidade].mensal}% a.m. / {TAXAS_BACEN[modalidade].anual}% a.a.</p>
      <Button onClick={calcular} className="w-full">Comparar Taxas</Button>
      {resultado && (
        <Card className={`border ${resultado.abusiva ? "bg-destructive/10 border-destructive/30" : "bg-accent/10 border-accent/30"}`}>
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Taxa Contratual</span><span className="font-semibold text-destructive">{resultado.taxaContratual.toFixed(2)}% a.m.</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Taxa Média BACEN</span><span className="font-semibold text-green-600">{resultado.taxaBacen.toFixed(2)}% a.m.</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Diferença</span><span className="font-semibold">{resultado.diferenca.toFixed(2)} p.p.</span></div>
            {resultado.economia > 0 && <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Economia Potencial</span><span className="text-lg font-bold text-green-600">R$ {fmt(resultado.economia)}</span></div>}
            {resultado.abusiva && <p className="text-xs text-destructive font-medium mt-2">⚠ Taxa contratual superior a 1,5x a média BACEN – possível abusividade</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
