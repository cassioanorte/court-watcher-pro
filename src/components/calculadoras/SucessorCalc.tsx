import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const modalidades = [
  { value: "judicial", label: "Inventário Judicial", desc: "Procedimento judicial obrigatório quando há menores, incapazes ou litígio" },
  { value: "extrajudicial", label: "Inventário Extrajudicial", desc: "Via cartório, quando todos são capazes e concordam" },
  { value: "doacao", label: "Doação com Usufruto", desc: "Transferência em vida com reserva de uso pelo doador" },
  { value: "holding", label: "Holding Familiar", desc: "Empresa familiar para planejamento patrimonial e sucessório" },
];

export default function SucessorCalc() {
  const [patrimonio, setPatrimonio] = useState("");
  const [modalidade, setModalidade] = useState("judicial");
  const [resultado, setResultado] = useState<{ custos: { label: string; valor: number }[]; total: number } | null>(null);

  const calcular = () => {
    const pat = parseFloat(patrimonio);
    if (!pat) { toast.error("Informe o valor do patrimônio"); return; }

    const custos: { label: string; valor: number }[] = [];
    let itcmd = pat * 0.04; // ITCMD médio 4%

    switch (modalidade) {
      case "judicial": {
        const honorarios = pat * 0.06; // ~6% honorários
        const custas = pat * 0.01; // ~1% custas judiciais
        custos.push({ label: "ITCMD (4%)", valor: itcmd });
        custos.push({ label: "Honorários advocatícios (~6%)", valor: honorarios });
        custos.push({ label: "Custas judiciais (~1%)", valor: custas });
        custos.push({ label: "Avaliações e certidões (estimativa)", valor: 3000 });
        break;
      }
      case "extrajudicial": {
        const honorarios = pat * 0.05;
        const emolumentos = Math.min(pat * 0.005, 50000); // emolumentos cartório
        custos.push({ label: "ITCMD (4%)", valor: itcmd });
        custos.push({ label: "Honorários advocatícios (~5%)", valor: honorarios });
        custos.push({ label: "Emolumentos cartório", valor: emolumentos });
        custos.push({ label: "Certidões e registros", valor: 2000 });
        break;
      }
      case "doacao": {
        const honorarios = pat * 0.03;
        const registro = pat * 0.003;
        custos.push({ label: "ITCMD sobre doação (4%)", valor: itcmd });
        custos.push({ label: "Honorários (~3%)", valor: honorarios });
        custos.push({ label: "Registro de imóveis (~0,3%)", valor: registro });
        custos.push({ label: "Escritura pública", valor: 2500 });
        break;
      }
      case "holding": {
        const abertura = 8000;
        const honorarios = pat * 0.04;
        const itbi = pat * 0.02; // ITBI na integralização
        custos.push({ label: "ITBI na integralização (~2%)", valor: itbi });
        custos.push({ label: "Honorários consultoria (~4%)", valor: honorarios });
        custos.push({ label: "Abertura e registro PJ", valor: abertura });
        custos.push({ label: "Contabilidade anual (estimativa)", valor: 6000 });
        itcmd = 0; // Sem ITCMD na holding
        break;
      }
    }

    const total = custos.reduce((acc, c) => acc + c.valor, 0);
    setResultado({ custos, total });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Valor do Patrimônio (R$)</Label>
        <Input type="number" value={patrimonio} onChange={e => setPatrimonio(e.target.value)} placeholder="Ex: 1000000" />
      </div>

      <div>
        <Label className="text-sm font-semibold">Modalidade</Label>
        <div className="space-y-2 mt-2">
          {modalidades.map(m => (
            <button
              key={m.value}
              onClick={() => setModalidade(m.value)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all",
                modalidade === m.value ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
              )}
            >
              <p className="font-medium text-sm text-foreground">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <Button onClick={calcular} className="w-full">Comparar Custos</Button>

      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-2">
            {resultado.custos.map((c, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-border pb-1 last:border-0">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="font-medium text-foreground">R$ {c.valor.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-2 border-t border-border font-bold">
              <span className="text-foreground">Total estimado</span>
              <span className="text-foreground">R$ {resultado.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
