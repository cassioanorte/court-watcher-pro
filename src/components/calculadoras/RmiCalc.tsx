import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export default function RmiCalc() {
  const [salarios, setSalarios] = useState<string[]>(["", "", ""]);
  const [regra, setRegra] = useState("pos_reforma");
  const [resultado, setResultado] = useState<{ media: number; coeficiente: number; rmi: number } | null>(null);

  const addSalario = () => setSalarios([...salarios, ""]);
  const removeSalario = (i: number) => setSalarios(salarios.filter((_, idx) => idx !== i));
  const updateSalario = (i: number, value: string) => {
    const updated = [...salarios];
    updated[i] = value;
    setSalarios(updated);
  };

  const calcular = () => {
    const valores = salarios.map(s => parseFloat(s)).filter(v => !isNaN(v) && v > 0);
    if (valores.length < 1) { toast.error("Informe ao menos um salário de contribuição"); return; }

    let media: number;
    let coeficiente: number;

    if (regra === "pos_reforma") {
      // Pós EC 103/2019: média de 100% dos salários, coeficiente 60% + 2% por ano acima de 20a (homem) / 15a (mulher)
      media = valores.reduce((a, b) => a + b, 0) / valores.length;
      coeficiente = 0.6; // base 60%
    } else {
      // Pré-reforma: média dos 80% maiores
      const sorted = [...valores].sort((a, b) => b - a);
      const top80 = sorted.slice(0, Math.ceil(sorted.length * 0.8));
      media = top80.reduce((a, b) => a + b, 0) / top80.length;
      coeficiente = 0.7; // base simplificado
    }

    const rmi = media * coeficiente;
    setResultado({ media, coeficiente, rmi });
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div>
        <Label>Regra de cálculo</Label>
        <Select value={regra} onValueChange={setRegra}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pos_reforma">Pós-Reforma (EC 103/2019)</SelectItem>
            <SelectItem value="pre_reforma">Pré-Reforma (80% maiores)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Salários de Contribuição (R$)</Label>
        {salarios.map((s, i) => (
          <div key={i} className="flex gap-2">
            <Input type="number" value={s} onChange={e => updateSalario(i, e.target.value)} placeholder={`Salário ${i + 1}`} className="h-8 text-sm" />
            {salarios.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeSalario(i)}><Trash2 className="w-3.5 h-3.5" /></Button>}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addSalario} className="w-full"><Plus className="w-3.5 h-3.5 mr-1" />Adicionar Salário</Button>
      </div>
      <Button onClick={calcular} className="w-full">Calcular RMI</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Média Salarial</span><span className="font-semibold">R$ {resultado.media.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Coeficiente</span><span className="font-semibold">{(resultado.coeficiente * 100).toFixed(0)}%</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-medium">RMI Estimada</span><span className="text-lg font-bold text-foreground">R$ {resultado.rmi.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
