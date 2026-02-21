import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function VerbasRescisoriasCalc() {
  const [salario, setSalario] = useState("");
  const [mesesTrabalhados, setMesesTrabalhados] = useState("");
  const [diasUltimoMes, setDiasUltimoMes] = useState("");
  const [feriasVencidas, setFeriasVencidas] = useState("nao");
  const [tipoRescisao, setTipoRescisao] = useState("sem_justa_causa");
  const [resultado, setResultado] = useState<Record<string, number> | null>(null);

  const calcular = () => {
    const sal = parseFloat(salario);
    const meses = parseInt(mesesTrabalhados);
    const dias = parseInt(diasUltimoMes) || 0;
    if (!sal || !meses) { toast.error("Preencha salário e meses trabalhados"); return; }

    const saldoSalario = (sal / 30) * dias;
    const avisoIndenizado = tipoRescisao === "sem_justa_causa" ? sal : 0;
    const mesesAviso = tipoRescisao === "sem_justa_causa" ? meses + 1 : meses;
    const decimoTerceiro = sal * (mesesAviso % 12) / 12;
    const feriasProporcionais = sal * (mesesAviso % 12) / 12;
    const tercoFerias = feriasProporcionais / 3;
    const feriasVenc = feriasVencidas === "sim" ? sal + sal / 3 : 0;
    const multaFgts = tipoRescisao === "sem_justa_causa" ? sal * meses * 0.08 * 0.4 : 0;

    const total = saldoSalario + avisoIndenizado + decimoTerceiro + feriasProporcionais + tercoFerias + feriasVenc + multaFgts;

    setResultado({
      "Saldo de Salário": saldoSalario,
      "Aviso Prévio Indenizado": avisoIndenizado,
      "13º Proporcional": decimoTerceiro,
      "Férias Proporcionais": feriasProporcionais,
      "1/3 de Férias": tercoFerias,
      ...(feriasVenc > 0 ? { "Férias Vencidas + 1/3": feriasVenc } : {}),
      "Multa FGTS (40%)": multaFgts,
      "TOTAL": total,
    });
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Salário (R$)</Label><Input type="number" value={salario} onChange={e => setSalario(e.target.value)} /></div>
        <div><Label>Meses Trabalhados</Label><Input type="number" value={mesesTrabalhados} onChange={e => setMesesTrabalhados(e.target.value)} /></div>
        <div><Label>Dias no último mês</Label><Input type="number" value={diasUltimoMes} onChange={e => setDiasUltimoMes(e.target.value)} /></div>
        <div><Label>Férias Vencidas?</Label>
          <Select value={feriasVencidas} onValueChange={setFeriasVencidas}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao">Não</SelectItem>
              <SelectItem value="sim">Sim</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Tipo de Rescisão</Label>
        <Select value={tipoRescisao} onValueChange={setTipoRescisao}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sem_justa_causa">Sem Justa Causa</SelectItem>
            <SelectItem value="justa_causa">Justa Causa</SelectItem>
            <SelectItem value="pedido_demissao">Pedido de Demissão</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={calcular} className="w-full">Calcular</Button>
      {resultado && (
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-4 space-y-1">
            {Object.entries(resultado).map(([label, value]) => (
              <div key={label} className={`flex justify-between ${label === "TOTAL" ? "border-t pt-2 mt-2" : ""}`}>
                <span className={`text-sm ${label === "TOTAL" ? "font-bold" : "text-muted-foreground"}`}>{label}</span>
                <span className={label === "TOTAL" ? "text-lg font-bold text-foreground" : "font-semibold"}>
                  R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
