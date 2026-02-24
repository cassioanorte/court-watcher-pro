
-- Personal tasks table (like Google Tasks)
CREATE TABLE public.user_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  due_time TIME,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subtasks table
CREATE TABLE public.user_task_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.user_tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for user_tasks
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tasks"
  ON public.user_tasks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own tasks"
  ON public.user_tasks FOR INSERT
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users update own tasks"
  ON public.user_tasks FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own tasks"
  ON public.user_tasks FOR DELETE
  USING (user_id = auth.uid());

-- RLS for subtasks
ALTER TABLE public.user_task_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subtasks"
  ON public.user_task_subtasks FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_tasks WHERE id = task_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users insert own subtasks"
  ON public.user_task_subtasks FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_tasks WHERE id = task_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users update own subtasks"
  ON public.user_task_subtasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.user_tasks WHERE id = task_id AND user_id = auth.uid()));

CREATE POLICY "Users delete own subtasks"
  ON public.user_task_subtasks FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.user_tasks WHERE id = task_id AND user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX idx_user_tasks_case_id ON public.user_tasks(case_id);
CREATE INDEX idx_user_task_subtasks_task_id ON public.user_task_subtasks(task_id);
