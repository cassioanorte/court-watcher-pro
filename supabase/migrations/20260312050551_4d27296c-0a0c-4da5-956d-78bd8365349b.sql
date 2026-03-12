
-- Conversations table
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  title TEXT DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations" ON public.ai_conversations
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own conversations" ON public.ai_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Users update own conversations" ON public.ai_conversations
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own conversations" ON public.ai_conversations
  FOR DELETE USING (user_id = auth.uid());

-- Messages table
CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB DEFAULT NULL,
  tool_results JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own messages" ON public.ai_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
  ));
CREATE POLICY "Users insert own messages" ON public.ai_messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
  ) AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Users delete own messages" ON public.ai_messages
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
  ));
