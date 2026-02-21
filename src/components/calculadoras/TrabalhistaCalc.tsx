import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function TrabalhistaCalc() {
  const [salario, setSalario] = useState("");
  const [mesesTrabalhados, setMesesTrabalhados] = useState("");
  const [tipoCalculo, setTipoCalculo] = useState("adicional_noturno");
  const [horasNoturnas, setHorasNoturnas] = useState("");
  const [percentualInsalubridade, setPercentualInsalubridade] = useState("20");
  const [percentualPericulosidade] = useState("30");
  const [resultado, setResultado] = useState<{ label: string; valor: number; detalhes: string[] } | null>(null);

  const calcular = () => {
    const sal = parseFloat(salario);
    if (!sal) { toast.error("Informe o salário base"); return; }

    const salarioMinimo = 1518; // 2025
    let label = "";
    let valor = 0;
    const detalhes: string[] = [];

    switch (tipoCalculo) {
      case "adicional_noturno": {
        const horas = parseFloat(horasNoturnas) || 0;
        if (!horas) { toast.error("Informe as horas noturnas"); return; }
        const valorHora = sal / 220;
        const adicional = valorHora * 0.2;
        const horaNoturnaReduzida = 52.5; // minutos
        const horasReduzidas = horas * (60 / horaNoturnaReduzida);
        valor = horasReduzidas * (valorHora + adicional);
        label = "Adicional Noturno";
        detalhes.push(`Valor hora: R$ ${valorHora.toFixed(2)}`);
        detalhes.push(`Adicional 20%: R$ ${adicional.toFixed(2)}/h`);
        detalhes.push(`Horas reduzidas: ${horasReduzidas.toFixed(1)}h`);
        break;
      }
      case "insalubridade": {
        const perc = parseFloat(percentualInsalubridade) / 100;
        valor = salarioMinimo * perc;
        label = "Adicional de Insalubridade";
        detalhes.push(`Base: Salário mínimo (R$ ${salarioMinimo.toFixed(2)})`);
        detalhes.push(`Grau: ${(perc * 100).toFixed(0)}%`);
        break;
      }
      case "periculosidade": {
        const perc = parseFloat(percentualPericulosidade) / 100;
        valor = sal * perc;
        label = "Adicional de Periculosidade";
        detalhes.push(`Base: Salário (R$ ${sal.toFixed(2)})`);
        detalhes.push(`Percentual: 30%`);
        break;
      }
      case "salario_familia": {
        // Valores 2025 (referência)
        const meses = parseInt(mesesTrabalhados) || 1;
        const valorPorFilho = sal <= 1819.26 ? 62.04 : 0;
        valor = valorPorFilho * meses;
        label = "Salário-Família";
        detalhes.push(`Valor mensal por filho: R$ ${valorPorFilho.toFixed(2)}`);
        detalhes.push(`Meses: ${meses}`);
        if (valorPorFilho === 0) detalhes.push("Salário acima do teto – sem direito");
        break;
      }
      case "dsr": {
        const meses = parseInt(mesesTrabalhados) || 1;
        const diasUteis = 26;
        const domFer = 4;
        const dsrMensal = (sal / diasUteis) * domFer;
        valor = dsrMensal * meses;
        label = "DSR (Descanso Semanal Remunerado)";
        detalhes.push(`DSR mensal: R$ ${dsrMensal.toFixed(2)}`);
        detalhes.push(`Meses: ${meses}`);
        break;
      }
    }

    setResultado({ label, valor, detalhes });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Salário Base (R$)</Label><Input type="number" value={salario} onChange={e => setSalario(e.target.value)} placeholder="Ex: 3000" /></div>
        <div>
          <Label>Tipo de Cálculo</Label>
          <Select value={tipoCalculo} onValueChange={setTipoCalculo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="adicional_noturno">Adicional Noturno</SelectItem>
              <SelectItem value="insalubridade">Insalubridade</SelectItem>
              <SelectItem value="periculosidade">Periculosidade</SelectItem>
              <SelectItem value="salario_familia">Salário-Família</SelectItem>
              <SelectItem value="dsr">DSR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {tipoCalculo === "adicional_noturno" && (
        <div><Label>Horas Noturnas (22h-5h)</Label><Input type="number" value={horasNoturnas} onChange={e => setHorasNoturnas(e.target.value)} placeholder="Ex: 40" /></div>
      )}
      {tipoCalculo === "insalubridade" && (
        <div>
          <Label>Grau de Insalubridade</Label>
          <Select value={percentualInsalubridade} onValueChange={setPercentualInsalubridade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">Mínimo (10%)</SelectItem>
              <SelectItem value="20">Médio (20%)</SelectItem>
              <SelectItem value="40">Máximo (40%)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {(tipoCalculo === "salario_familia" || tipoCalculo === "dsr") && (
        <div><Label>Meses</Label><Input type="number" value={mesesTrabalhados} onChange={e => setMesesTrabalhados(e.target.value)} placeholder="Ex: 12" /></div>
      )}

      <Button onClick={calcular} className="w-full">Calcular</Button>

      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">{resultado.label}</p>
            <p className="text-2xl font-bold text-foreground">R$ {resultado.valor.toFixed(2)}</p>
            {resultado.detalhes.map((d, i) => (
              <p key={i} className="text-xs text-muted-foreground">{d}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
