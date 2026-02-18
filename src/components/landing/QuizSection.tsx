import { useState } from "react";
import { Phone, Mail, CheckCircle, XCircle, Loader2, ArrowRight, ArrowLeft } from "lucide-react";

interface QuizQuestion {
  id: string;
  question: string;
  options: { label: string; score: number }[];
}

interface QuizConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  questions: QuizQuestion[];
  qualifyThreshold: number;
  qualifiedMessage: string;
  qualifiedWhatsappMessage: string;
  unqualifiedMessage: string;
  collectContactOnUnqualified: boolean;
}

interface QuizSectionProps {
  quiz: QuizConfig;
  whatsappNumber?: string;
  tenantId: string;
  variant?: "classic" | "modern" | "minimal";
}

const normalizeWhatsapp = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
};

const QuizSection = ({ quiz, whatsappNumber, tenantId, variant = "classic" }: QuizSectionProps) => {
  const [currentStep, setCurrentStep] = useState(0); // 0 = intro, 1..n = questions, n+1 = result
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<"qualified" | "unqualified" | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", phone: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const totalQuestions = quiz.questions.length;
  const isIntro = currentStep === 0;
  const isResult = currentStep > totalQuestions;
  const currentQuestion = !isIntro && !isResult ? quiz.questions[currentStep - 1] : null;

  const totalScore = Object.values(answers).reduce((a, b) => a + b, 0);
  const isQualified = totalScore >= quiz.qualifyThreshold;

  const handleAnswer = (questionId: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
    if (currentStep < totalQuestions) {
      setCurrentStep((s) => s + 1);
    } else {
      // Last question answered
      const finalScore = Object.values({ ...answers, [questionId]: score }).reduce((a, b) => a + b, 0);
      setResult(finalScore >= quiz.qualifyThreshold ? "qualified" : "unqualified");
      setCurrentStep(totalQuestions + 1);
    }
  };

  const handleSubmitContact = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) return;
    setSubmitting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      await fetch(`${supabaseUrl}/functions/v1/save-quiz-lead`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          name: contactForm.name.trim(),
          phone: contactForm.phone.trim(),
          email: contactForm.email.trim() || null,
          quiz_answers: answers,
          quiz_score: totalScore,
          qualified: isQualified,
          quiz_title: quiz.title,
        }),
      });
      setSubmitted(true);
    } catch {
      // Still show success to avoid blocking
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  const handleWhatsappRedirect = () => {
    if (!whatsappNumber) return;
    const msg = encodeURIComponent(quiz.qualifiedWhatsappMessage || "Olá, acabei de fazer o quiz no site e fui qualificado. Gostaria de mais informações.");
    window.open(`https://wa.me/${normalizeWhatsapp(whatsappNumber)}?text=${msg}`, "_blank");
  };

  // Save qualified lead too
  const handleQualifiedContact = async () => {
    if (contactForm.name.trim() && contactForm.phone.trim()) {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        await fetch(`${supabaseUrl}/functions/v1/save-quiz-lead`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            name: contactForm.name.trim(),
            phone: contactForm.phone.trim(),
            email: contactForm.email.trim() || null,
            quiz_answers: answers,
            quiz_score: totalScore,
            qualified: true,
            quiz_title: quiz.title,
          }),
        });
      } catch { /* silent */ }
    }
    handleWhatsappRedirect();
  };

  // Styles per variant
  const styles = {
    classic: {
      bg: "bg-amber-50",
      card: "bg-white border shadow-sm",
      button: "bg-amber-500 hover:bg-amber-600 text-white",
      buttonOutline: "border-2 border-amber-500 text-amber-600 hover:bg-amber-50",
      accent: "text-amber-600",
      progress: "bg-amber-500",
    },
    modern: {
      bg: "bg-gradient-to-b from-indigo-50 to-purple-50",
      card: "bg-white border shadow-md rounded-2xl",
      button: "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90",
      buttonOutline: "border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50",
      accent: "text-indigo-600",
      progress: "bg-gradient-to-r from-indigo-500 to-purple-500",
    },
    minimal: {
      bg: "border-b",
      card: "border",
      button: "bg-gray-900 text-white hover:bg-gray-800",
      buttonOutline: "border-2 border-gray-900 text-gray-900 hover:bg-gray-50",
      accent: "text-gray-900",
      progress: "bg-gray-900",
    },
  };

  const s = styles[variant];

  return (
    <section className={`py-16 px-6 ${s.bg}`}>
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        {!isIntro && !isResult && (
          <div className="mb-8">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Pergunta {currentStep} de {totalQuestions}</span>
              <span>{Math.round((currentStep / totalQuestions) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full ${s.progress} rounded-full transition-all duration-500`} style={{ width: `${(currentStep / totalQuestions) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Intro */}
        {isIntro && (
          <div className={`${s.card} p-8 text-center rounded-xl`}>
            <h2 className={`text-2xl md:text-3xl font-bold mb-3 ${s.accent}`}>{quiz.title}</h2>
            <p className="text-gray-600 mb-6">{quiz.subtitle}</p>
            <button onClick={() => setCurrentStep(1)} className={`${s.button} px-8 py-3 rounded-lg font-semibold transition-all inline-flex items-center gap-2`}>
              Começar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Question */}
        {currentQuestion && (
          <div className={`${s.card} p-8 rounded-xl`}>
            <h3 className="text-lg md:text-xl font-semibold mb-6">{currentQuestion.question}</h3>
            <div className="space-y-3">
              {currentQuestion.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(currentQuestion.id, opt.score)}
                  className={`w-full text-left p-4 rounded-lg border hover:border-gray-400 transition-all hover:shadow-sm flex items-center gap-3`}
                >
                  <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
            {currentStep > 1 && (
              <button onClick={() => setCurrentStep((s) => s - 1)} className="mt-4 text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Voltar
              </button>
            )}
          </div>
        )}

        {/* Result: Qualified */}
        {isResult && result === "qualified" && (
          <div className={`${s.card} p-8 rounded-xl text-center`}>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-3 text-green-700">Parabéns!</h3>
            <p className="text-gray-600 mb-6">{quiz.qualifiedMessage}</p>
            <div className="space-y-3 max-w-sm mx-auto mb-6">
              <input
                type="text"
                placeholder="Seu nome *"
                value={contactForm.name}
                onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm"
              />
              <input
                type="tel"
                placeholder="Seu WhatsApp *"
                value={contactForm.phone}
                onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm"
              />
              <input
                type="email"
                placeholder="Seu email (opcional)"
                value={contactForm.email}
                onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 border rounded-lg text-sm"
              />
            </div>
            {whatsappNumber ? (
              <button
                onClick={handleQualifiedContact}
                disabled={!contactForm.name.trim() || !contactForm.phone.trim()}
                className={`${s.button} px-8 py-3 rounded-lg font-semibold transition-all inline-flex items-center gap-2 disabled:opacity-50`}
              >
                <Phone className="w-4 h-4" /> Falar com Advogado pelo WhatsApp
              </button>
            ) : (
              <button
                onClick={handleQualifiedContact}
                disabled={!contactForm.name.trim() || !contactForm.phone.trim()}
                className={`${s.button} px-8 py-3 rounded-lg font-semibold transition-all disabled:opacity-50`}
              >
                Enviar
              </button>
            )}
          </div>
        )}

        {/* Result: Unqualified */}
        {isResult && result === "unqualified" && (
          <div className={`${s.card} p-8 rounded-xl text-center`}>
            <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-3 text-gray-700">Resultado</h3>
            <p className="text-gray-600 mb-6">{quiz.unqualifiedMessage}</p>

            {quiz.collectContactOnUnqualified && !submitted && (
              <div className="space-y-3 max-w-sm mx-auto">
                <p className="text-sm text-gray-500">Deixe seu contato e entraremos em contato para avaliar melhor seu caso:</p>
                <input
                  type="text"
                  placeholder="Seu nome *"
                  value={contactForm.name}
                  onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border rounded-lg text-sm"
                />
                <input
                  type="tel"
                  placeholder="Seu telefone *"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 border rounded-lg text-sm"
                />
                <input
                  type="email"
                  placeholder="Seu email (opcional)"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-2.5 border rounded-lg text-sm"
                />
                <button
                  onClick={handleSubmitContact}
                  disabled={submitting || !contactForm.name.trim() || !contactForm.phone.trim()}
                  className={`${s.button} w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2`}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {submitting ? "Enviando..." : "Enviar contato"}
                </button>
              </div>
            )}

            {submitted && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <p className="text-green-700 text-sm font-medium">Recebemos seu contato! Entraremos em contato em breve.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default QuizSection;
export type { QuizConfig, QuizQuestion };
