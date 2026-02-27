import { useState } from "react";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, Building2, DollarSign, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { extractTextFromPdf, parseCnisText, type CnisDados } from "@/lib/cnisParser";

interface CnisUploadProps {
  onDataExtracted: (dados: CnisDados) => void;
}

export default function CnisUpload({ onDataExtracted }: CnisUploadProps) {
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<CnisDados | null>(null);
  const [fileName, setFileName] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const handleFile = async (file: File) => {
    const isPdfByExtension = file.name.toLowerCase().endsWith(".pdf");
    const isPdfByMime = file.type.toLowerCase() === "application/pdf";

    if (!isPdfByExtension && !isPdfByMime) {
      toast.error("Apenas arquivos PDF são aceitos");
      return;
    }

    setLoading(true);
    try {
      const text = await extractTextFromPdf(file);
      const parsed = parseCnisText(text);

      if (parsed.vinculos.length === 0 && parsed.salarios.length === 0) {
        toast.warning("Não foi possível extrair dados deste PDF. Verifique se é um CNIS válido do Meu INSS.");
        setLoading(false);
        return;
      }

      setDados(parsed);
      setFileName(file.name);
      onDataExtracted(parsed);
      toast.success(`CNIS importado: ${parsed.vinculos.length} vínculo(s) e ${parsed.salarios.length} salário(s) encontrado(s)`);
    } catch (err) {
      console.error("Erro ao processar CNIS:", err);
      toast.error("Erro ao processar o PDF. Verifique se o arquivo é válido.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setDados(null);
    setFileName("");
  };

  if (!dados) {
    return (
      <FileDropZone
        onFile={handleFile}
        accept=".pdf"
        loading={loading}
        loadingText="Processando CNIS..."
        label="Arraste o CNIS (PDF) aqui ou clique para selecionar"
        sublabel="Extrato do Meu INSS • Extração automática sem IA"
        fileName={fileName}
        onClear={handleClear}
        compact
      />
    );
  }

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{fileName}</span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClear}>
            Trocar arquivo
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {dados.nome && <Badge variant="secondary" className="text-[10px]">{dados.nome}</Badge>}
          <Badge variant="outline" className="text-[10px] gap-1">
            <Building2 className="w-3 h-3" /> {dados.vinculos.length} vínculo(s)
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1">
            <DollarSign className="w-3 h-3" /> {dados.salarios.length} salário(s)
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Clock className="w-3 h-3" /> {dados.tempoTotal.anos}a {dados.tempoTotal.meses}m {dados.tempoTotal.dias}d
          </Badge>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
          {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
        </Button>

        {showDetails && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {dados.vinculos.map((v, i) => (
              <div key={i} className="text-[11px] p-2 rounded bg-background border">
                <p className="font-medium text-foreground">{v.empresa}</p>
                <p className="text-muted-foreground">
                  {v.cnpj && `CNPJ: ${v.cnpj} • `}
                  {new Date(v.inicio).toLocaleDateString("pt-BR")} a {new Date(v.fim).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
