import { useState } from "react";
import { Plus, Trash2, Sparkles, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { QuizConfig, QuizQuestion } from "./QuizSection";

interface QuizEditorProps {
  quiz: QuizConfig;
  onChange: (quiz: QuizConfig) => void;
}

const newQuestion = (): QuizQuestion => ({
  id: crypto.randomUUID(),
  question: "",
  options: [
    { label: "", score: 1 },
    { label: "", score: 0 },
  ],
});

const DEFAULT_QUIZ: QuizConfig = {
  enabled: false,
  title: "Descubra se você tem direito",
  subtitle: "Responda algumas perguntas rápidas e descubra se você pode ter direito a esse benefício.",
  questions: [],
  qualifyThreshold: 3,
  qualifiedMessage: "Você pode ter direito! Fale agora com um advogado especialista.",
  qualifiedWhatsappMessage: "Olá, acabei de fazer o quiz no site e fui qualificado. Gostaria de mais informações.",
  unqualifiedMessage: "Infelizmente, com base nas suas respostas, pode ser que você não se enquadre neste benefício no momento.",
  collectContactOnUnqualified: true,
};

const QuizEditor = ({ quiz: quizProp, onChange }: QuizEditorProps) => {
  const quiz = { ...DEFAULT_QUIZ, ...quizProp };
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTopic, setAiTopic] = useState("");

  const update = (patch: Partial<QuizConfig>) => onChange({ ...quiz, ...patch });

  const updateQuestion = (idx: number, patch: Partial<QuizQuestion>) => {
    const updated = quiz.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q));
    update({ questions: updated });
  };

  const updateOption = (qIdx: number, oIdx: number, field: "label" | "score", value: string | number) => {
    const questions = [...quiz.questions];
    const opts = [...questions[qIdx].options];
    opts[oIdx] = { ...opts[oIdx], [field]: value };
    questions[qIdx] = { ...questions[qIdx], options: opts };
    update({ questions });
  };

  const addOption = (qIdx: number) => {
    const questions = [...quiz.questions];
    questions[qIdx] = { ...questions[qIdx], options: [...questions[qIdx].options, { label: "", score: 0 }] };
    update({ questions });
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const questions = [...quiz.questions];
    questions[qIdx] = { ...questions[qIdx], options: questions[qIdx].options.filter((_, i) => i !== oIdx) };
    update({ questions });
  };

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { topic: aiTopic },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
      } else if (data?.quiz) {
        onChange({ ...quiz, ...data.quiz, enabled: true });
        toast({ title: "Quiz gerado com IA!", description: "Revise as perguntas e ajuste os pontos." });
        setShowAiDialog(false);
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar quiz", description: err.message, variant: "destructive" });
    }
    setAiLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* Toggle + AI button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch checked={quiz.enabled} onCheckedChange={(v) => update({ enabled: v })} />
          <Label className="text-sm font-medium">Quiz ativo na landing page</Label>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAiDialog(true)}>
          <Sparkles className="w-4 h-4" /> Gerar Quiz com IA
        </Button>
      </div>

      {quiz.enabled && (
        <>
          {/* General settings */}
          <div className="space-y-3 border rounded-lg p-4">
            <div>
              <Label className="text-xs">Título do quiz</Label>
              <Input value={quiz.title} onChange={(e) => update({ title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Subtítulo</Label>
              <Input value={quiz.subtitle} onChange={(e) => update({ subtitle: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Pontuação mínima para qualificar</Label>
              <Input
                type="number"
                value={quiz.qualifyThreshold}
                onChange={(e) => update({ qualifyThreshold: parseInt(e.target.value) || 0 })}
                className="mt-1 w-32"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Total possível: {quiz.questions.reduce((t, q) => t + Math.max(...q.options.map((o) => o.score), 0), 0)} pontos
              </p>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold">Perguntas ({quiz.questions.length})</Label>
            {quiz.questions.map((q, qIdx) => (
              <div key={q.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-2.5 shrink-0" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Pergunta {qIdx + 1}</Label>
                    <Input
                      value={q.question}
                      onChange={(e) => updateQuestion(qIdx, { question: e.target.value })}
                      placeholder="Ex: Você trabalhou com carteira assinada?"
                      className="mt-1"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0"
                    onClick={() => update({ questions: quiz.questions.filter((_, i) => i !== qIdx) })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="ml-6 space-y-2">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4" translate="no">{String.fromCharCode(65 + oIdx)}</span>
                      <Input
                        value={opt.label}
                        onChange={(e) => updateOption(qIdx, oIdx, "label", e.target.value)}
                        placeholder="Texto da opção"
                        className="flex-1 text-sm"
                      />
                      <Input
                        type="number"
                        value={opt.score}
                        onChange={(e) => updateOption(qIdx, oIdx, "score", parseInt(e.target.value) || 0)}
                        className="w-16 text-sm text-center"
                        title="Pontos"
                      />
                      {q.options.length > 2 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeOption(qIdx, oIdx)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="text-xs gap-1 ml-4" onClick={() => addOption(qIdx)}>
                    <Plus className="w-3 h-3" /> Opção
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1" onClick={() => update({ questions: [...quiz.questions, newQuestion()] })}>
              <Plus className="w-4 h-4" /> Adicionar pergunta
            </Button>
          </div>

          {/* Messages */}
          <div className="space-y-3 border rounded-lg p-4">
            <Label className="text-sm font-semibold">Mensagens de resultado</Label>
            <div>
              <Label className="text-xs text-green-600">✅ Mensagem para qualificados</Label>
              <Textarea value={quiz.qualifiedMessage} onChange={(e) => update({ qualifiedMessage: e.target.value })} rows={2} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-green-600">💬 Mensagem pré-preenchida no WhatsApp</Label>
              <Textarea value={quiz.qualifiedWhatsappMessage} onChange={(e) => update({ qualifiedWhatsappMessage: e.target.value })} rows={2} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-red-500">❌ Mensagem para não qualificados</Label>
              <Textarea value={quiz.unqualifiedMessage} onChange={(e) => update({ unqualifiedMessage: e.target.value })} rows={2} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={quiz.collectContactOnUnqualified} onCheckedChange={(v) => update({ collectContactOnUnqualified: v })} />
              <Label className="text-xs">Coletar contato de não qualificados</Label>
            </div>
          </div>
        </>
      )}

      {/* AI Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Gerar Quiz com IA
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Informe o tema e a IA gerará as perguntas automaticamente.</p>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Tema do quiz *</Label>
              <Textarea
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Ex: Auxílio maternidade para trabalhadoras CLT&#10;Ex: Aposentadoria por tempo de contribuição&#10;Ex: Indenização por acidente de trabalho"
                rows={3}
              />
            </div>
            <Button onClick={handleAiGenerate} disabled={aiLoading || !aiTopic.trim()} className="w-full gap-2">
              {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : <><Sparkles className="w-4 h-4" /> Gerar Quiz</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuizEditor;
