import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function FatorPrevidenciarioCalc() {
  const [idade, setIdade] = useState("");
  const [tempoContribuicao, setTempoContribuicao] = useState("");
  const [sexo, setSexo] = useState("masculino");
  const [mediaSalarios, setMediaSalarios] = useState("");
  const [resultado, setResultado] = useState<{
    fator: number; expectativaSobrevida: number; beneficioSemFator: number;
    beneficioComFator: number; aliquota: number;
  } | null>(null);

  const calcular = () => {
    const id = parseFloat(idade);
    const tc = parseFloat(tempoContribuicao);
    const ms = parseFloat(mediaSalarios);
    if (!id || !tc) { toast.error("Informe idade e tempo de contribuição"); return; }

    // Tabela simplificada de expectativa de sobrevida (IBGE 2023)
    const tabelaEs: Record<number, number> = {
      50: 30.8, 51: 29.9, 52: 29.0, 53: 28.1, 54: 27.2, 55: 26.3,
      56: 25.5, 57: 24.6, 58: 23.8, 59: 22.9, 60: 22.1, 61: 21.3,
      62: 20.5, 63: 19.7, 64: 18.9, 65: 18.2, 66: 17.4, 67: 16.7,
      68: 15.9, 69: 15.2, 70: 14.5,
    };

    const idadeInt = Math.round(id);
    const es = tabelaEs[idadeInt] || (idadeInt < 50 ? 35 : 12);

    // Alíquota de contribuição
    const a = 0.31; // alíquota padrão (empregado + empregador)

    // Fórmula: f = (Tc x a / Es) x (1 + Id + Tc x a / 100)
    const fator = (tc * a / es) * (1 + (id + tc * a) / 100);

    const beneficioSemFator = ms || 0;
    const beneficioComFator = beneficioSemFator * fator;

    setResultado({ fator, expectativaSobrevida: es, beneficioSemFator, beneficioComFator, aliquota: a });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Idade (anos)</Label><Input type="number" value={idade} onChange={e => setIdade(e.target.value)} /></div>
        <div><Label>Tempo de Contribuição (anos)</Label><Input type="number" value={tempoContribuicao} onChange={e => setTempoContribuicao(e.target.value)} /></div>
        <div><Label>Sexo</Label>
          <Select value={sexo} onValueChange={setSexo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="feminino">Feminino (+5 anos bônus)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Média dos Salários (R$)</Label><Input type="number" value={mediaSalarios} onChange={e => setMediaSalarios(e.target.value)} placeholder="Opcional" /></div>
      </div>
      <p className="text-xs text-muted-foreground">Fórmula: f = (Tc × a ÷ Es) × [1 + (Id + Tc × a) ÷ 100]</p>
      <Button onClick={calcular} className="w-full">Calcular Fator</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Expectativa de Sobrevida</span><span className="font-semibold">{resultado.expectativaSobrevida.toFixed(1)} anos</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Alíquota (a)</span><span className="font-semibold">{(resultado.aliquota * 100).toFixed(0)}%</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Fator Previdenciário</span><span className={`text-lg font-bold ${resultado.fator >= 1 ? "text-green-600" : "text-destructive"}`}>{resultado.fator.toFixed(4)}</span></div>
            {resultado.beneficioSemFator > 0 && (
              <>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Benefício sem Fator</span><span className="font-semibold">R$ {fmt(resultado.beneficioSemFator)}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Benefício com Fator</span><span className={`font-semibold ${resultado.fator >= 1 ? "text-green-600" : "text-destructive"}`}>R$ {fmt(resultado.beneficioComFator)}</span></div>
              </>
            )}
            {resultado.fator < 1 && <p className="text-xs text-destructive mt-2">⚠ Fator redutor — considere aguardar mais tempo para aposentadoria</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
