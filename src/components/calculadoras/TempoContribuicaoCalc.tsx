import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import CnisUpload from "./CnisUpload";
import type { CnisDados } from "@/lib/cnisParser";

interface Vinculo {
  inicio: string;
  fim: string;
  empresa: string;
  funcao: string;
  especial: "nao" | "15" | "20" | "25";
}

const ESPECIAL_LABELS: Record<string, string> = {
  nao: "Não",
  "15": "15 anos",
  "20": "20 anos",
  "25": "25 anos",
};

function parseDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function calcDiasVinculo(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const d1 = new Date(inicio);
  const d2 = new Date(fim);
  if (d2 <= d1) return 0;
  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function diasToLabel(dias: number): string {
  if (dias <= 0) return "0 dias";
  const a = Math.floor(dias / 365);
  const m = Math.floor((dias % 365) / 30);
  const d = dias % 365 % 30;
  const parts: string[] = [];
  if (a > 0) parts.push(`${a} ano${a > 1 ? "s" : ""}`);
  if (m > 0) parts.push(`${m} ${m > 1 ? "meses" : "mês"}`);
  if (d > 0) parts.push(`${d} dia${d > 1 ? "s" : ""}`);
  return parts.join(" ") || "0 dias";
}

function calcTempoConvertido(dias: number, especial: string, sexo: "masculino" | "feminino"): number {
  if (especial === "nao") return dias;
  // Fator de conversão para tempo comum
  // Homem: tempo comum = 35 anos
  // Mulher: tempo comum = 30 anos
  const tempoComum = sexo === "masculino" ? 35 : 30;
  const tempoEspecial = parseInt(especial);
  const fator = tempoComum / tempoEspecial;
  return Math.round(dias * fator);
}

const emptyVinculo = (): Vinculo => ({ inicio: "", fim: "", empresa: "", funcao: "", especial: "nao" });

export default function TempoContribuicaoCalc() {
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [sexo, setSexo] = useState<"masculino" | "feminino">("masculino");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Vinculo>(emptyVinculo());
  const [showModal, setShowModal] = useState(false);

  const handleCnisData = (dados: CnisDados) => {
    if (dados.vinculos.length > 0) {
      setVinculos(dados.vinculos.map(v => ({
        inicio: v.inicio,
        fim: v.fim,
        empresa: v.cnpj ? `${v.cnpj} ${v.empresa}` : v.empresa,
        funcao: "",
        especial: "nao" as const,
      })));
      toast.success(`${dados.vinculos.length} vínculos importados do CNIS`);
    }
  };

  const openAdd = () => {
    setEditIdx(null);
    setEditForm(emptyVinculo());
    setShowModal(true);
  };

  const openEdit = (i: number) => {
    setEditIdx(i);
    setEditForm({ ...vinculos[i] });
    setShowModal(true);
  };

  const saveVinculo = () => {
    if (!editForm.inicio || !editForm.fim) {
      toast.error("Preencha as datas de início e fim");
      return;
    }
    if (new Date(editForm.fim) <= new Date(editForm.inicio)) {
      toast.error("Data fim deve ser posterior ao início");
      return;
    }
    if (editIdx !== null) {
      const updated = [...vinculos];
      updated[editIdx] = editForm;
      setVinculos(updated);
    } else {
      setVinculos([...vinculos, editForm]);
    }
    setShowModal(false);
  };

  const removeVinculo = (i: number) => {
    setVinculos(vinculos.filter((_, idx) => idx !== i));
  };

  const resultado = useMemo(() => {
    if (vinculos.length === 0) return null;
    let totalDiasComum = 0;
    let totalDiasConvertido = 0;
    for (const v of vinculos) {
      const dias = calcDiasVinculo(v.inicio, v.fim);
      totalDiasComum += dias;
      totalDiasConvertido += calcTempoConvertido(dias, v.especial, sexo);
    }
    return { totalDiasComum, totalDiasConvertido };
  }, [vinculos, sexo]);

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="w-40">
          <Label className="text-xs">Sexo</Label>
          <Select value={sexo} onValueChange={(v: "masculino" | "feminino") => setSexo(v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="masculino">Homem</SelectItem>
              <SelectItem value="feminino">Mulher</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CnisUpload onDataExtracted={handleCnisData} />
      </div>

      <div className="flex gap-2">
        <Button variant="default" size="sm" onClick={openAdd}><Plus className="w-3.5 h-3.5 mr-1" />Incluir</Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-[90px]">Início</TableHead>
              <TableHead className="text-xs w-[90px]">Fim</TableHead>
              <TableHead className="text-xs">Empresa</TableHead>
              <TableHead className="text-xs w-[100px]">Função</TableHead>
              <TableHead className="text-xs w-[100px]">Regime Especial</TableHead>
              <TableHead className="text-xs w-[140px] text-right">Tempo Calculado</TableHead>
              <TableHead className="text-xs w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vinculos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">
                  Nenhum vínculo adicionado. Importe do CNIS ou clique em "Incluir".
                </TableCell>
              </TableRow>
            )}
            {vinculos.map((v, i) => {
              const dias = calcDiasVinculo(v.inicio, v.fim);
              const diasConv = calcTempoConvertido(dias, v.especial, sexo);
              return (
                <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onDoubleClick={() => openEdit(i)}>
                  <TableCell className="text-xs py-1.5">{parseDateBR(v.inicio)}</TableCell>
                  <TableCell className="text-xs py-1.5">{parseDateBR(v.fim)}</TableCell>
                  <TableCell className="text-xs py-1.5 max-w-[250px] truncate" title={v.empresa}>{v.empresa}</TableCell>
                  <TableCell className="text-xs py-1.5">{v.funcao || "—"}</TableCell>
                  <TableCell className="text-xs py-1.5">
                    <span className={v.especial !== "nao" ? "text-blue-600 dark:text-blue-400 font-medium" : "text-muted-foreground"}>
                      {ESPECIAL_LABELS[v.especial]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs py-1.5 text-right font-medium">
                    {v.especial !== "nao" ? (
                      <span className="text-blue-600 dark:text-blue-400" title={`Original: ${diasToLabel(dias)}`}>
                        {diasToLabel(diasConv)}
                      </span>
                    ) : (
                      diasToLabel(dias)
                    )}
                  </TableCell>
                  <TableCell className="text-xs py-1.5">
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(i)}><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeVinculo(i)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Tempo Total Calculado</span>
              <span className="text-lg font-bold text-foreground">{diasToLabel(resultado.totalDiasConvertido)}</span>
            </div>
            {resultado.totalDiasConvertido !== resultado.totalDiasComum && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Tempo comum (sem conversão especial)</span>
                <span className="text-sm text-muted-foreground">{diasToLabel(resultado.totalDiasComum)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total em dias</span>
              <span className="text-sm text-muted-foreground">{resultado.totalDiasConvertido} dias</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit/Add Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editIdx !== null ? "Alterar parcela" : "Incluir parcela"}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {editIdx !== null ? "Modifique os campos da parcela" : "Preencha os campos do novo vínculo"}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="date" value={editForm.inicio} onChange={e => setEditForm(f => ({ ...f, inicio: e.target.value }))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="date" value={editForm.fim} onChange={e => setEditForm(f => ({ ...f, fim: e.target.value }))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Tempo Especial</Label>
                <Select value={editForm.especial} onValueChange={(v: Vinculo["especial"]) => setEditForm(f => ({ ...f, especial: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não</SelectItem>
                    <SelectItem value="25">25 anos</SelectItem>
                    <SelectItem value="20">20 anos</SelectItem>
                    <SelectItem value="15">15 anos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Empresa</Label>
                <Input value={editForm.empresa} onChange={e => setEditForm(f => ({ ...f, empresa: e.target.value }))} placeholder="CNPJ + Razão Social" />
              </div>
              <div>
                <Label className="text-xs">Função</Label>
                <Input value={editForm.funcao} onChange={e => setEditForm(f => ({ ...f, funcao: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            {editForm.inicio && editForm.fim && new Date(editForm.fim) > new Date(editForm.inicio) && (
              <p className="text-xs text-muted-foreground">
                Tempo: {diasToLabel(calcTempoConvertido(calcDiasVinculo(editForm.inicio, editForm.fim), editForm.especial, sexo))}
                {editForm.especial !== "nao" && (
                  <span className="text-blue-600 dark:text-blue-400 ml-1">
                    (original: {diasToLabel(calcDiasVinculo(editForm.inicio, editForm.fim))})
                  </span>
                )}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={saveVinculo}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
