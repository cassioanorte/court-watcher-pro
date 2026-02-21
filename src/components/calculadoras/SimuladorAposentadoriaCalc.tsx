import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

export default function SimuladorAposentadoriaCalc() {
  const [sexo, setSexo] = useState("masculino");
  const [idade, setIdade] = useState("");
  const [tempoContrib, setTempoContrib] = useState("");
  const [resultado, setResultado] = useState<{ regras: { nome: string; atende: boolean; detalhe: string }[] } | null>(null);

  const calcular = () => {
    const i = parseInt(idade);
    const t = parseInt(tempoContrib);
    if (!i || !t) { toast.error("Preencha idade e tempo de contribuição"); return; }

    const isM = sexo === "masculino";
    const regras = [
      {
        nome: "Idade Mínima Progressiva",
        atende: isM ? (i >= 65 && t >= 15) : (i >= 62 && t >= 15),
        detalhe: isM ? "65 anos + 15 anos de contribuição" : "62 anos + 15 anos de contribuição",
      },
      {
        nome: "Regra de Pontos",
        atende: isM ? (i + t >= 101 && t >= 35) : (i + t >= 91 && t >= 30),
        detalhe: isM ? `Pontos: ${i + t}/101 (mínimo 35a contrib)` : `Pontos: ${i + t}/91 (mínimo 30a contrib)`,
      },
      {
        nome: "Pedágio 50%",
        atende: isM ? (t >= 35) : (t >= 30),
        detalhe: isM ? "35 anos de contribuição + 50% do tempo faltante em 13/11/2019" : "30 anos de contribuição + 50% do tempo faltante em 13/11/2019",
      },
      {
        nome: "Pedágio 100%",
        atende: isM ? (i >= 60 && t >= 35) : (i >= 57 && t >= 30),
        detalhe: isM ? "60 anos + 35a contrib + pedágio 100%" : "57 anos + 30a contrib + pedágio 100%",
      },
      {
        nome: "Idade Mínima (Regra permanente)",
        atende: isM ? (i >= 65 && t >= 20) : (i >= 62 && t >= 15),
        detalhe: isM ? "65 anos + 20 anos contrib (novos segurados)" : "62 anos + 15 anos contrib",
      },
    ];
    setResultado({ regras });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Sexo</Label>
          <Select value={sexo} onValueChange={setSexo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Idade (anos)</Label><Input type="number" value={idade} onChange={e => setIdade(e.target.value)} /></div>
      </div>
      <div><Label>Tempo de Contribuição (anos)</Label><Input type="number" value={tempoContrib} onChange={e => setTempoContrib(e.target.value)} /></div>
      <Button onClick={calcular} className="w-full">Simular Aposentadoria</Button>
      {resultado && (
        <div className="space-y-2">
          {resultado.regras.map((r, i) => (
            <Card key={i} className={r.atende ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}>
              <CardContent className="p-3 flex items-start gap-2">
                {r.atende ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
                <div>
                  <p className="text-sm font-medium">{r.nome}</p>
                  <p className="text-xs text-muted-foreground">{r.detalhe}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
