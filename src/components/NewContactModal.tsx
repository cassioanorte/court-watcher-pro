import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type NewContactModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const INITIAL = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  cpf: "",
  rg: "",
  birth_date: "",
  civil_status: "",
  origin: "",
  address: "",
  ctps: "",
  pis: "",
  titulo_eleitor: "",
  cnh: "",
  passaporte: "",
  certidao_reservista: "",
  atividade_economica: "",
  nome_pai: "",
  nome_mae: "",
  naturalidade: "",
  nacionalidade: "",
  comentarios: "",
  banco: "",
  agencia: "",
  conta_bancaria: "",
  chave_pix: "",
  falecido: false,
};

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string | boolean;
  onChange: (v: any) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) => (
  <div className="flex items-center py-2 border-b last:border-0">
    <span className="w-40 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right pr-4 shrink-0">
      {label} {required && <span className="text-destructive">*</span>}
    </span>
    <div className="flex-1">
      {type === "checkbox" ? (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border accent-primary"
        />
      ) : type === "select" ? (
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 px-2 rounded border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Selecione...</option>
          <option value="Solteiro(a)">Solteiro(a)</option>
          <option value="Casado(a)">Casado(a)</option>
          <option value="Divorciado(a)">Divorciado(a)</option>
          <option value="Viúvo(a)">Viúvo(a)</option>
          <option value="União Estável">União Estável</option>
        </select>
      ) : (
        <input
          type={type}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 px-2 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      )}
    </div>
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="py-2.5 px-1">
    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </span>
  </div>
);

const NewContactModal = ({ open, onClose, onCreated }: NewContactModalProps) => {
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const set = (field: string) => (value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "Erro", description: "Nome completo é obrigatório.", variant: "destructive" });
      return;
    }
    if (!form.email.trim()) {
      toast({ title: "Erro", description: "E-mail é obrigatório.", variant: "destructive" });
      return;
    }
    if (!form.password || form.password.length < 6) {
      toast({ title: "Erro", description: "Senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Step 1: Create user via invite-client
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-client`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: form.email,
            fullName: form.full_name,
            phone: form.phone || undefined,
            cpf: form.cpf || undefined,
            address: form.address || undefined,
            origin: form.origin || undefined,
            role: "client",
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao criar contato");

      const userId = result.userId;

      // Step 2: Update password
      const passRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-client-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId, password: form.password }),
        }
      );
      if (!passRes.ok) {
        const passResult = await passRes.json();
        console.warn("Password update warning:", passResult.error);
      }

      // Step 3: Update all extra profile fields
      const extraFields: Record<string, any> = {};
      const profileFields = [
        "rg", "birth_date", "civil_status", "ctps", "pis", "titulo_eleitor",
        "cnh", "passaporte", "certidao_reservista", "atividade_economica",
        "nome_pai", "nome_mae", "naturalidade", "nacionalidade", "comentarios",
        "banco", "agencia", "conta_bancaria", "chave_pix",
      ];
      profileFields.forEach((f) => {
        if (form[f as keyof typeof form]) extraFields[f] = form[f as keyof typeof form];
      });
      if (typeof form.falecido === "boolean") extraFields.falecido = form.falecido;

      if (Object.keys(extraFields).length > 0) {
        await supabase.from("profiles").update(extraFields).eq("user_id", userId);
      }

      toast({ title: "Sucesso!", description: `Contato "${form.full_name}" cadastrado.` });
      setForm(INITIAL);
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-bold">Novo Contato</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-130px)] px-6">
          <div className="divide-y">
            <SectionTitle>Dados Pessoais</SectionTitle>
            <div>
              <Field label="Nome Completo" value={form.full_name} onChange={set("full_name")} required />
              <Field label="E-mail" value={form.email} onChange={set("email")} type="email" required />
              <Field label="Senha" value={form.password} onChange={set("password")} type="password" placeholder="Mínimo 6 caracteres" required />
              <Field label="Telefone" value={form.phone} onChange={set("phone")} />
              <Field label="Nascimento" value={form.birth_date} onChange={set("birth_date")} type="date" />
              <Field label="Estado Civil" value={form.civil_status} onChange={set("civil_status")} type="select" />
              <Field label="Origem" value={form.origin} onChange={set("origin")} />
              <Field label="Endereço" value={form.address} onChange={set("address")} />
            </div>

            <SectionTitle>Documentos</SectionTitle>
            <div>
              <Field label="CPF" value={form.cpf} onChange={set("cpf")} />
              <Field label="RG" value={form.rg} onChange={set("rg")} />
              <Field label="CTPS" value={form.ctps} onChange={set("ctps")} />
              <Field label="PIS" value={form.pis} onChange={set("pis")} />
              <Field label="Título de Eleitor" value={form.titulo_eleitor} onChange={set("titulo_eleitor")} />
              <Field label="CNH" value={form.cnh} onChange={set("cnh")} />
              <Field label="Passaporte" value={form.passaporte} onChange={set("passaporte")} />
              <Field label="Cert. Reservista" value={form.certidao_reservista} onChange={set("certidao_reservista")} />
            </div>

            <SectionTitle>Informações Adicionais</SectionTitle>
            <div>
              <Field label="Atividade Econ." value={form.atividade_economica} onChange={set("atividade_economica")} />
              <Field label="Nome do Pai" value={form.nome_pai} onChange={set("nome_pai")} />
              <Field label="Nome da Mãe" value={form.nome_mae} onChange={set("nome_mae")} />
              <Field label="Naturalidade" value={form.naturalidade} onChange={set("naturalidade")} />
              <Field label="Nacionalidade" value={form.nacionalidade} onChange={set("nacionalidade")} />
              <Field label="Comentários" value={form.comentarios} onChange={set("comentarios")} />
            </div>

            <SectionTitle>Conta Bancária</SectionTitle>
            <div>
              <Field label="Banco" value={form.banco} onChange={set("banco")} />
              <Field label="Agência" value={form.agencia} onChange={set("agencia")} />
              <Field label="Conta" value={form.conta_bancaria} onChange={set("conta_bancaria")} />
              <Field label="Chave PIX" value={form.chave_pix} onChange={set("chave_pix")} />
            </div>

            <div className="py-2">
              <Field label="Falecido?" value={form.falecido} onChange={set("falecido")} type="checkbox" />
            </div>
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" /> Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Cadastrar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewContactModal;
