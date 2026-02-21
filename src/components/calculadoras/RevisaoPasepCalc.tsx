import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function RevisaoPasepCalc() {
  const [saldoInformado, setSaldoInformado] = useState("");
  const [dataAbertura, setDataAbertura] = useState("");
  const [dataConsulta, setDataConsulta] = useState("");
  const [resultado, setResultado] = useState<{
    saldoCorrigido: number; juros: number; diferenca: number;
  } | null>(null);

  const calcular = () => {
    const s = parseFloat(saldoInformado);
    if (!s || !dataAbertura || !dataConsulta) { toast.error("Preencha todos os campos"); return; }

    const d1 = new Date(dataAbertura);
    const d2 = new Date(dataConsulta);
    const meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    if (meses <= 0) { toast.error("Data de consulta deve ser posterior"); return; }

    // Correção pelo INPC + juros progressivos (3% a 6% a.a.)
    const taxaCorrecao = 0.004; // INPC médio mensal
    const taxaJuros = 0.005; // juros médio mensal
    const saldoCorrigido = s * Math.pow(1 + taxaCorrecao, meses);
    const juros = saldoCorrigido * taxaJuros * meses;
    const total = saldoCorrigido + juros;

    setResultado({ saldoCorrigido: total, juros, diferenca: total - s });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Label>Saldo Informado pelo Banco (R$)</Label><Input type="number" value={saldoInformado} onChange={e => setSaldoInformado(e.target.value)} /></div>
        <div><Label>Data de Abertura da Conta</Label><Input type="date" value={dataAbertura} onChange={e => setDataAbertura(e.target.value)} /></div>
        <div><Label>Data da Consulta</Label><Input type="date" value={dataConsulta} onChange={e => setDataConsulta(e.target.value)} /></div>
      </div>
      <Button onClick={calcular} className="w-full">Recalcular PASEP</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Saldo Corrigido + Juros</span><span className="font-semibold">R$ {fmt(resultado.saldoCorrigido)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Juros Devidos</span><span className="font-semibold text-green-600">R$ {fmt(resultado.juros)}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Diferença a Receber</span><span className="text-lg font-bold text-green-600">R$ {fmt(resultado.diferenca)}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
