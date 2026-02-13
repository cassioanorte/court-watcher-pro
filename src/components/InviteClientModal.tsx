import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { X, Copy, Check } from "lucide-react";

interface InviteClientModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const InviteClientModal = ({ open, onClose, onSuccess }: InviteClientModalProps) => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-client", {
        body: { email, fullName, phone: phone || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ tempPassword: data.tempPassword });
      toast({ title: "Cliente convidado!", description: `${fullName} foi cadastrado com sucesso.` });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setEmail("");
    setFullName("");
    setPhone("");
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-foreground/30" onClick={handleClose} />
      <div className="relative bg-card rounded-xl border shadow-lg w-full max-w-md p-6 animate-scale-in">
        <button onClick={handleClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-lg font-bold text-foreground mb-1">Convidar Cliente</h2>
        <p className="text-sm text-muted-foreground mb-5">O cliente receberá acesso ao portal</p>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome completo *</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" placeholder="Maria Silva" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" placeholder="cliente@email.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Telefone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg bg-background border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40" placeholder="(51) 99999-0000" />
            </div>
            <button type="submit" disabled={loading} className="w-full h-10 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? "Criando..." : "Convidar cliente"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-success/10 border border-success/20 rounded-lg p-4">
              <p className="text-sm font-semibold text-foreground mb-1">✅ Cliente cadastrado!</p>
              <p className="text-xs text-muted-foreground">Compartilhe a senha temporária abaixo com o cliente:</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm font-mono text-foreground">{result.tempPassword}</code>
              <button onClick={handleCopy} className="h-9 w-9 rounded-lg border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">O cliente deve alterar a senha após o primeiro acesso.</p>
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
