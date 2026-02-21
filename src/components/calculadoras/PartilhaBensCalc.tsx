import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Bem {
  descricao: string;
  valor: string;
}

export default function PartilhaBensCalc() {
  const [regime, setRegime] = useState("comunhao_parcial");
  const [bens, setBens] = useState<Bem[]>([{ descricao: "", valor: "" }]);
  const [bensParticulares, setBensParticulares] = useState("0");
  const [resultado, setResultado] = useState<{ totalBens: number; meacao: number; particular: number } | null>(null);

  const addBem = () => setBens([...bens, { descricao: "", valor: "" }]);
  const removeBem = (i: number) => setBens(bens.filter((_, idx) => idx !== i));
  const updateBem = (i: number, field: keyof Bem, value: string) => {
    const updated = [...bens];
    updated[i] = { ...updated[i], [field]: value };
    setBens(updated);
  };

  const calcular = () => {
    const totalBens = bens.reduce((acc, b) => acc + (parseFloat(b.valor) || 0), 0);
    const particular = parseFloat(bensParticulares) || 0;
    if (totalBens <= 0) { toast.error("Informe ao menos um bem"); return; }

    let meacao: number;
    if (regime === "comunhao_universal") {
      meacao = totalBens / 2;
    } else if (regime === "comunhao_parcial") {
      meacao = (totalBens - particular) / 2;
    } else {
      meacao = 0; // separação total
    }

    setResultado({ totalBens, meacao, particular });
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div><Label>Regime de Bens</Label>
        <Select value={regime} onValueChange={setRegime}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="comunhao_parcial">Comunhão Parcial</SelectItem>
            <SelectItem value="comunhao_universal">Comunhão Universal</SelectItem>
            <SelectItem value="separacao_total">Separação Total</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Bens a Partilhar</Label>
        {bens.map((b, i) => (
          <div key={i} className="flex gap-2">
            <Input value={b.descricao} onChange={e => updateBem(i, "descricao", e.target.value)} placeholder="Descrição" className="h-8 text-sm" />
            <Input type="number" value={b.valor} onChange={e => updateBem(i, "valor", e.target.value)} placeholder="Valor R$" className="h-8 text-sm w-32" />
            {bens.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeBem(i)}><Trash2 className="w-3.5 h-3.5" /></Button>}
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addBem} className="w-full"><Plus className="w-3.5 h-3.5 mr-1" />Adicionar Bem</Button>
      </div>
      {regime === "comunhao_parcial" && (
        <div><Label>Bens Particulares (R$)</Label><Input type="number" value={bensParticulares} onChange={e => setBensParticulares(e.target.value)} placeholder="Anteriores ao casamento" /></div>
      )}
      <Button onClick={calcular} className="w-full">Calcular Partilha</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total dos Bens</span><span className="font-semibold">R$ {resultado.totalBens.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
            {resultado.particular > 0 && <div className="flex justify-between"><span className="text-sm text-muted-foreground">Bens Particulares</span><span className="font-semibold">R$ {resultado.particular.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>}
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Meação (cada parte)</span><span className="text-lg font-bold text-foreground">R$ {resultado.meacao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
