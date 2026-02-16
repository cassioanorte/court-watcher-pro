import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, X, Camera, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type NewContactModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const ORIGIN_OPTIONS = [
  "Indicação",
  "Google",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Site",
  "OAB",
  "Outro",
];

const CONTACT_TYPE_OPTIONS = [
  "Cliente",
  "Parte Contrária",
  "Testemunha",
  "Perito",
  "Fornecedor",
  "Parceiro",
  "Outro",
];

const INITIAL = {
  full_name: "",
  email: "",
  password: "123456",
  phone: "",
  cpf: "",
  rg: "",
  birth_date: "",
  civil_status: "",
  origin: "",
  contact_type: "Cliente",
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
      ) : type === "origin-select" ? (
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 px-2 rounded border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Selecione...</option>
          {ORIGIN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "contact-type-select" ? (
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 px-2 rounded border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {CONTACT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const set = (field: string) => (value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "Erro", description: "Nome completo é obrigatório.", variant: "destructive" });
      return;
    }
    if (!form.password || form.password.length < 6) {
      toast({ title: "Erro", description: "Senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }

    // Auto-generate email if empty
    const finalEmail = form.email.trim() || `contato_${Date.now()}@interno.prevdoc.com`;
    // Auto-generate CPF placeholder if empty
    const finalCpf = form.cpf.trim() || undefined;

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
            email: finalEmail,
            fullName: form.full_name,
            phone: form.phone || undefined,
            cpf: finalCpf,
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
        "rg", "birth_date", "civil_status", "contact_type", "ctps", "pis", "titulo_eleitor",
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

      // Step 4: Upload avatar if selected
      if (avatarFile) {
        const filePath = `avatars/${userId}/${Date.now()}_${avatarFile.name}`;
        const { error: uploadError } = await supabase.storage.from("case-documents").upload(filePath, avatarFile);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("case-documents").getPublicUrl(filePath);
          await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", userId);
        }
      }

      toast({ title: "Sucesso!", description: `Contato "${form.full_name}" cadastrado.` });
      setForm(INITIAL);
      setAvatarFile(null);
      setAvatarPreview(null);
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
              {/* Avatar upload */}
              <div className="flex items-center py-3 border-b">
                <span className="w-40 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right pr-4 shrink-0">
                  Foto
                </span>
                <div className="flex-1 flex items-center gap-3">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAvatarFile(file);
                        setAvatarPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="w-14 h-14 rounded-full bg-muted flex items-center justify-center relative cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all group overflow-hidden"
                    title="Clique para adicionar foto"
                  >
                    {avatarPreview ? (
                      <>
                        <img src={avatarPreview} alt="" className="w-full h-full rounded-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                          <Camera className="w-4 h-4 text-white" />
                        </div>
                      </>
                    ) : (
                      <Camera className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {avatarPreview ? "Clique para trocar" : "Clique para adicionar"}
                  </span>
                </div>
              </div>
              <Field label="Nome Completo" value={form.full_name} onChange={set("full_name")} required />
              <Field label="Tipo de Contato" value={form.contact_type} onChange={set("contact_type")} type="contact-type-select" />
              <Field label="E-mail" value={form.email} onChange={set("email")} type="email" placeholder="Opcional" />
              <Field label="Senha" value={form.password} onChange={set("password")} type="password" placeholder="Mínimo 6 caracteres" required />
              <div className="flex items-center py-2 border-b">
                <span className="w-40 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right pr-4 shrink-0">
                  Telefone
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => set("phone")(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="h-8 px-2 rounded border bg-background text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {form.phone && (
                    <a
                      href={`https://wa.me/${form.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold transition-colors shrink-0"
                      title="Enviar WhatsApp"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
              <Field label="Nascimento" value={form.birth_date} onChange={set("birth_date")} type="date" />
              <Field label="Estado Civil" value={form.civil_status} onChange={set("civil_status")} type="select" />
              <Field label="Origem" value={form.origin} onChange={set("origin")} type="origin-select" />
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
