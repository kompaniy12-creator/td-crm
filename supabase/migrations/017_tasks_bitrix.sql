-- Bitrix24-like task extensions:
--   * multiple co-assignees + watchers (the classic Bitrix
--     Постановщик / Исполнитель / Соисполнители / Наблюдатели model)
--   * parent/child subtasks
--   * explicit start + estimate + time-spent for time tracking
--   * free-text result field (Bitrix "Результат")
--   * one-shot reminder timestamp
--   * activity feed + chat comments per task
--   * nested checklist items with ordering

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS watchers uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS co_assignees uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimate_seconds integer,
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS result text,
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);

-- Comments / activity feed (kind = 'comment' | 'event')
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'comment',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id, created_at);

-- Checklist items
CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  body text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_checklist_task ON public.task_checklist_items(task_id, position);

-- Permissive RLS (matches the rest of the tables in this CRM for now)
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_comments all" ON public.task_comments;
CREATE POLICY "task_comments all" ON public.task_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "task_checklist_items all" ON public.task_checklist_items;
CREATE POLICY "task_checklist_items all" ON public.task_checklist_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
