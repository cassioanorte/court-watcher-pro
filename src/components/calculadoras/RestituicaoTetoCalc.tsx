import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import CnisUpload from "./CnisUpload";
import type { CnisDados } from "@/lib/cnisParser";

// Tabela simplificada de tetos do INSS por ano (valores aproximados)
const TETOS_INSS: Record<number, number> = {
  2024: 7786.02, 2025: 8157.41, 2023: 7507.49, 2022: 7087.22, 2021: 6433.57,
  2020: 6101.06, 2019: 5839.45, 2018: 5645.80, 2017: 5531.31, 2016: 5189.82,
  2015: 4663.75, 2014: 4390.24, 2013: 4159.00, 2012: 3916.20, 2011: 3691.74,
  2010: 3467.40, 2009: 3218.90, 2008: 3038.99, 2007: 2894.28, 2006: 2801.56,
  2005: 2668.15, 2004: 2508.72, 2003: 1869.34, 2002: 1561.56, 2001: 1430.00,
  2000: 1328.25, 1999: 1255.32, 1998: 1200.00, 1997: 1031.87, 1996: 957.56,
};

function getTetoAno(ano: number): number {
  return TETOS_INSS[ano] || TETOS_INSS[2025];
}

interface ContribuicaoAcimaTeto {
  competencia: string;
  valor: number;
  teto: number;
  excedente: number;
}

export default function RestituicaoTetoCalc() {
  const [contribuicaoMensal, setContribuicaoMensal] = useState("");
  const [tetoVigente, setTetoVigente] = useState("8157.41");
  const [meses, setMeses] = useState("");
  const [resultado, setResultado] = useState<{
    excedenteMensal: number; totalRestituir: number; aliquotaMaxima: number;
    detalhes?: ContribuicaoAcimaTeto[];
  } | null>(null);

  const handleCnisData = (dados: CnisDados) => {
    if (dados.salarios.length === 0) {
      toast.warning("Nenhum salário de contribuição encontrado no CNIS");
      return;
    }

    const detalhes: ContribuicaoAcimaTeto[] = [];
    for (const s of dados.salarios) {
      const ano = parseInt(s.competencia.split("-")[0]);
      const teto = getTetoAno(ano);
      if (s.valor > teto) {
        detalhes.push({
          competencia: s.competencia,
          valor: s.valor,
          teto,
          excedente: s.valor - teto,
        });
      }
    }

    if (detalhes.length === 0) {
      toast.info("Nenhuma contribuição acima do teto encontrada no CNIS");
      return;
    }

    const totalRestituir = detalhes.reduce((acc, d) => acc + d.excedente, 0);
    const excedenteMedio = totalRestituir / detalhes.length;

    setMeses(String(detalhes.length));
    setContribuicaoMensal(String(Math.round(excedenteMedio * 100) / 100 + getTetoAno(2025) * 0.14));

    setResultado({
      excedenteMensal: excedenteMedio,
      totalRestituir,
      aliquotaMaxima: getTetoAno(2025) * 0.14,
      detalhes,
    });

    toast.success(`${detalhes.length} contribuição(ões) acima do teto encontrada(s)`);
  };

  const calcular = () => {
    const c = parseFloat(contribuicaoMensal);
    const t = parseFloat(tetoVigente);
    const m = parseInt(meses);
    if (!c || !t || !m) { toast.error("Preencha todos os campos"); return; }

    const aliquotaMaxima = 0.14;
    const contribuicaoMaxima = t * aliquotaMaxima;
    const excedente = c > contribuicaoMaxima ? c - contribuicaoMaxima : 0;
    if (excedente <= 0) { toast.error("Contribuição não excede o teto"); return; }

    setResultado({ excedenteMensal: excedente, totalRestituir: excedente * m, aliquotaMaxima: contribuicaoMaxima });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtComp = (c: string) => { const [y, m] = c.split("-"); return `${m}/${y}`; };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <CnisUpload onDataExtracted={handleCnisData} />

      <div className="grid grid-cols-2 gap-4">
        <div><Label>Contribuição Mensal Paga (R$)</Label><Input type="number" value={contribuicaoMensal} onChange={e => setContribuicaoMensal(e.target.value)} /></div>
        <div><Label>Teto do INSS Vigente (R$)</Label><Input type="number" value={tetoVigente} onChange={e => setTetoVigente(e.target.value)} /></div>
        <div className="col-span-2"><Label>Meses com Contribuição Acima do Teto</Label><Input type="number" value={meses} onChange={e => setMeses(e.target.value)} /></div>
      </div>
      <Button onClick={calcular} className="w-full">Calcular Restituição</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Contribuição Máxima (14% teto)</span><span className="font-semibold">R$ {fmt(resultado.aliquotaMaxima)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Excedente Mensal (média)</span><span className="font-semibold text-destructive">R$ {fmt(resultado.excedenteMensal)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Meses acima do teto</span><span className="font-semibold">{meses}</span></div>
            <div className="border-t pt-2 flex justify-between"><span className="text-sm font-bold">Total a Restituir</span><span className="text-lg font-bold text-green-600">R$ {fmt(resultado.totalRestituir)}</span></div>
          </CardContent>
        </Card>
      )}
      {resultado?.detalhes && resultado.detalhes.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Detalhamento por competência</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {resultado.detalhes.map((d, i) => (
                <div key={i} className="flex justify-between text-[11px] p-1.5 rounded bg-muted/50">
                  <span className="text-muted-foreground">{fmtComp(d.competencia)}</span>
                  <span>Salário: R$ {fmt(d.valor)}</span>
                  <span>Teto: R$ {fmt(d.teto)}</span>
                  <span className="font-semibold text-destructive">+R$ {fmt(d.excedente)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
