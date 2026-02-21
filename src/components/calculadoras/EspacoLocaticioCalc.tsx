import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function EspacoLocaticioCalc() {
  const [areaUtil, setAreaUtil] = useState("");
  const [valorM2, setValorM2] = useState("");
  const [tipoImovel, setTipoImovel] = useState("residencial");
  const [mesesContrato, setMesesContrato] = useState("12");
  const [taxaReajuste, setTaxaReajuste] = useState("4.5");
  const [resultado, setResultado] = useState<{
    aluguelMensal: number;
    aluguelAnual: number;
    aluguelReajustado: number;
    condominio: number;
    iptu: number;
    totalMensal: number;
  } | null>(null);

  const calcular = () => {
    const area = parseFloat(areaUtil);
    const vm2 = parseFloat(valorM2);
    if (!area || !vm2) { toast.error("Informe a área e o valor por m²"); return; }

    const meses = parseInt(mesesContrato) || 12;
    const reajuste = parseFloat(taxaReajuste) || 0;

    const aluguelMensal = area * vm2;
    const aluguelAnual = aluguelMensal * meses;

    // Estimativas baseadas no tipo
    let condominioEstimado = 0;
    let iptuEstimado = 0;

    switch (tipoImovel) {
      case "residencial":
        condominioEstimado = area * 8;
        iptuEstimado = aluguelMensal * 0.08;
        break;
      case "comercial":
        condominioEstimado = area * 12;
        iptuEstimado = aluguelMensal * 0.12;
        break;
      case "industrial":
        condominioEstimado = area * 5;
        iptuEstimado = aluguelMensal * 0.06;
        break;
    }

    const aluguelReajustado = aluguelMensal * (1 + reajuste / 100);
    const totalMensal = aluguelMensal + condominioEstimado + iptuEstimado;

    setResultado({
      aluguelMensal,
      aluguelAnual,
      aluguelReajustado,
      condominio: condominioEstimado,
      iptu: iptuEstimado,
      totalMensal,
    });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Área útil (m²)</Label><Input type="number" value={areaUtil} onChange={e => setAreaUtil(e.target.value)} placeholder="Ex: 80" /></div>
        <div><Label>Valor por m² (R$)</Label><Input type="number" value={valorM2} onChange={e => setValorM2(e.target.value)} placeholder="Ex: 35" /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipo de Imóvel</Label>
          <Select value={tipoImovel} onValueChange={setTipoImovel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="residencial">Residencial</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
              <SelectItem value="industrial">Industrial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Meses do contrato</Label><Input type="number" value={mesesContrato} onChange={e => setMesesContrato(e.target.value)} placeholder="12" /></div>
      </div>

      <div>
        <Label>Taxa de reajuste anual (%)</Label>
        <Input type="number" value={taxaReajuste} onChange={e => setTaxaReajuste(e.target.value)} placeholder="Ex: 4.5 (IGPM/IPCA)" />
      </div>

      <Button onClick={calcular} className="w-full">Calcular Valores Locatícios</Button>

      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Aluguel mensal</span><br /><strong className="text-foreground">R$ {fmt(resultado.aluguelMensal)}</strong></div>
              <div><span className="text-muted-foreground">Após reajuste</span><br /><strong className="text-foreground">R$ {fmt(resultado.aluguelReajustado)}</strong></div>
              <div><span className="text-muted-foreground">Condomínio (est.)</span><br /><strong className="text-foreground">R$ {fmt(resultado.condominio)}</strong></div>
              <div><span className="text-muted-foreground">IPTU mensal (est.)</span><br /><strong className="text-foreground">R$ {fmt(resultado.iptu)}</strong></div>
            </div>
            <div className="border-t border-border pt-2 space-y-1 text-center">
              <p className="text-sm text-muted-foreground">Total mensal estimado</p>
              <p className="text-xl font-bold text-foreground">R$ {fmt(resultado.totalMensal)}</p>
              <p className="text-xs text-muted-foreground">Total no contrato ({mesesContrato} meses): R$ {fmt(resultado.aluguelAnual)}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
