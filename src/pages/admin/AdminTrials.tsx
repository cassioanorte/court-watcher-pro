import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Clock, Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TenantTrial {
  id: string;
  name: string;
  slug: string;
  trial_ends_at: string | null;
  trial_duration_days: number | null;
  subscription_status: string;
}

const trialOptions = [
  { label: "7 dias", value: 7 },
  { label: "15 dias", value: 15 },
  { label: "30 dias", value: 30 },
];

const getTrialInfo = (t: TenantTrial) => {
  if (!t.trial_ends_at) return null;
  const now = new Date();
  const end = new Date(t.trial_ends_at);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return { label: "Expirado", days: 0, color: "text-red-400 bg-red-500/10 border-red-500/30" };
  if (diff <= 3) return { label: `${diff}d restantes`, days: diff, color: "text-red-400 bg-red-500/10 border-red-500/30" };
  if (diff <= 7) return { label: `${diff}d restantes`, days: diff, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
  return { label: `${diff}d restantes`, days: diff, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
};

const AdminTrials = () => {
  const [tenants, setTenants] = useState<TenantTrial[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    const { data } = await supabase.from("tenants").select("id, name, slug, trial_ends_at, trial_duration_days, subscription_status");
    setTenants((data || []) as TenantTrial[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const activateTrial = async (id: string, days: number) => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + days);
    const { error } = await supabase.from("tenants").update({
      trial_ends_at: trialEnd.toISOString(),
      trial_duration_days: days,
      subscription_status: "trial",
    }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Teste ativado!", description: `Período de ${days} dias iniciado.` });
      fetchData();
    }
  };

  const cancelTrial = async (id: string) => {
    const { error } = await supabase.from("tenants").update({
      trial_ends_at: null,
      trial_duration_days: null,
      subscription_status: "active",
    }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Teste cancelado!" });
      fetchData();
    }
  };

  const withTrial = tenants.filter((t) => t.trial_ends_at);
  const withoutTrial = tenants.filter((t) => !t.trial_ends_at);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Testes</h1>
        <p className="text-sm text-slate-400 mt-1">Gerencie os períodos de teste dos escritórios</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Em Teste</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{withTrial.filter(t => { const info = getTrialInfo(t); return info && info.days > 0; }).length}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Testes Expirados</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{withTrial.filter(t => { const info = getTrialInfo(t); return info && info.days <= 0; }).length}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Sem Teste</p>
          <p className="text-2xl font-bold text-white mt-1">{withoutTrial.length}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <>
          {/* Tenants with active/expired trials */}
          {withTrial.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Com teste ativo/expirado</h2>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden backdrop-blur">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className="px-5 py-3 font-medium">Escritório</th>
                      <th className="px-5 py-3 font-medium">Duração</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Expira em</th>
                      <th className="px-5 py-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withTrial.map((t, i) => {
                      const info = getTrialInfo(t);
                      return (
                        <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/30 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-violet-400" />
                              </div>
                              <div>
                                <span className="text-white font-medium block">{t.name}</span>
                                <span className="text-xs text-slate-500">{t.slug}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-300">{t.trial_duration_days} dias</td>
                          <td className="px-5 py-3">
                            {info && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${info.color}`}>
                                <Clock className="w-3 h-3" />
                                {info.label}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-400 text-sm">
                            {t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {trialOptions.map((opt) => (
                                <button key={opt.value} onClick={() => activateTrial(t.id, opt.value)} className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800 border border-slate-700 text-slate-400 hover:border-violet-500/40 hover:text-violet-300 transition-all" title={`Reiniciar com ${opt.label}`}>
                                  {opt.label}
                                </button>
                              ))}
                              <button onClick={() => cancelTrial(t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Cancelar teste">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tenants without trial */}
          {withoutTrial.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Sem teste</h2>
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden backdrop-blur">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className="px-5 py-3 font-medium">Escritório</th>
                      <th className="px-5 py-3 font-medium text-right">Ativar Teste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withoutTrial.map((t, i) => (
                      <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/30 flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                              <span className="text-white font-medium block">{t.name}</span>
                              <span className="text-xs text-slate-500">{t.slug}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {trialOptions.map((opt) => (
                              <button key={opt.value} onClick={() => activateTrial(t.id, opt.value)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:border-violet-500/40 hover:text-violet-300 transition-all">
                                <Play className="w-3 h-3" />
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminTrials;
