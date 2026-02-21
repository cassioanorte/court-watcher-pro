import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function JurosMoratoriosCalc() {
  const [valor, setValor] = useState("");
  const [taxa, setTaxa] = useState("1");
  const [meses, setMeses] = useState("");
  const [tipo, setTipo] = useState("simples");
  const [resultado, setResultado] = useState<number | null>(null);

  const calcular = () => {
    const v = parseFloat(valor);
    const t = parseFloat(taxa) / 100;
    const m = parseInt(meses);
    if (!v || !t || !m) { toast.error("Preencha todos os campos"); return; }
    const r = tipo === "simples" ? v * (1 + t * m) : v * Math.pow(1 + t, m);
    setResultado(r);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Valor Principal (R$)</Label><Input type="number" value={valor} onChange={e => setValor(e.target.value)} /></div>
        <div><Label>Taxa mensal (%)</Label><Input type="number" value={taxa} onChange={e => setTaxa(e.target.value)} /></div>
        <div><Label>Meses de atraso</Label><Input type="number" value={meses} onChange={e => setMeses(e.target.value)} /></div>
        <div><Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simples">Juros Simples</SelectItem>
              <SelectItem value="compostos">Juros Compostos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado !== null && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Valor com Juros</p>
            <p className="text-2xl font-bold text-foreground">R$ {resultado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground mt-1">Juros: R$ {(resultado - parseFloat(valor)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
