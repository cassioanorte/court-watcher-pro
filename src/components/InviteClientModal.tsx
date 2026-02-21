import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { X, Copy, Check, Upload, FileText, Trash2 } from "lucide-react";
import { FileDropZone } from "@/components/ui/file-drop-zone";

interface InviteClientModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const originOptions = [
  "Indicação",
  "Google",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Site",
  "OAB",
  "Outro",
];

const InviteClientModal = ({ open, onClose, onSuccess }: InviteClientModalProps) => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [address, setAddress] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tempPassword: string | null; alreadyExisted?: boolean; message?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  if (!open) return null;

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-client", {
        body: {
          email,
          fullName,
          phone: phone || undefined,
          cpf: cpf.replace(/\D/g, "") || undefined,
          address: address || undefined,
          origin: origin || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Upload documents if any
      if (files.length > 0 && data?.userId) {
        setUploadingFiles(true);
        for (const file of files) {
          const filePath = `clients/${data.userId}/${Date.now()}_${file.name}`;
          await supabase.storage.from("case-documents").upload(filePath, file);
        }
        setUploadingFiles(false);
      }

      setResult({
        tempPassword: data.tempPassword,
        alreadyExisted: data.alreadyExisted,
        message: data.message,
      });
      toast({ title: "Cliente cadastrado!", description: `${fullName} foi cadastrado com sucesso.` });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.tempPassword) {
      navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setEmail("");
    setFullName("");
    setPhone("");
    setCpf("");
    setAddress("");
    setOrigin("");
    setResult(null);
    setFiles([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-foreground/30" onClick={handleClose} />
      <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-lg p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        <button onClick={handleClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-lg font-bold text-foreground mb-1">Cadastrar Cliente</h2>
        <p className="text-sm text-muted-foreground mb-5">Preencha os dados do cliente</p>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome completo *</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" placeholder="Maria Silva" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" placeholder="cliente@email.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CPF</label>
                <input type="text" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-accent/40" placeholder="000.000.000-00" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Telefone</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" placeholder="(51) 99999-0000" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Origem</label>
                <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40">
                  <option value="">Selecione...</option>
                  {originOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Endereço</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" placeholder="Rua, número, bairro, cidade - UF" />
              </div>
            </div>

            {/* Document upload */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Documentos</label>
              <div className="mt-1 space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-foreground">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                <FileDropZone
                  onFiles={(files) => {
                    setAttachments(prev => [...prev, ...files]);
                  }}
                  onFile={(f) => setAttachments(prev => [...prev, f])}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  multiple
                  label="Arraste documentos aqui ou clique para anexar"
                  compact
                />
            </div>

            <button type="submit" disabled={loading} className="w-full h-10 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? (uploadingFiles ? "Enviando documentos..." : "Cadastrando...") : "Cadastrar cliente"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-success/10 border border-success/20 rounded-lg p-4">
              <p className="text-sm font-semibold text-foreground mb-1">✅ Cliente cadastrado!</p>
              <p className="text-xs text-muted-foreground">
                {result.alreadyExisted
                  ? result.message
                  : "Compartilhe a senha temporária abaixo com o cliente:"}
              </p>
            </div>
            {result.tempPassword && (
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm font-mono text-foreground">{result.tempPassword}</code>
                <button onClick={handleCopy} className="h-9 w-9 rounded-lg border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
            {result.tempPassword && (
              <p className="text-[10px] text-muted-foreground">O cliente deve alterar a senha após o primeiro acesso.</p>
            )}
            <button onClick={handleClose} className="w-full h-10 rounded-lg border text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteClientModal;
