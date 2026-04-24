import { createClient } from '@/lib/supabase/client'
import {
  COMPANY_REGISTRATION_STAGE_KEYS,
  PIPELINE_STAGES,
  type PipelineStageTemplate,
} from '@/types'

/** Maps the visible Russian label (deals.stage) to the stable internal key
 *  used in pipeline_stage_templates.stage for company_registration. */
export function companyRegStageKey(label: string): string | null {
  const labels = PIPELINE_STAGES.company_registration
  const idx = labels.indexOf(label)
  if (idx < 0) return null
  return COMPANY_REGISTRATION_STAGE_KEYS[idx] || null
}

interface ApplyResult {
  created: number
  skipped: number
}

/**
 * Auto-create tasks from pipeline_stage_templates when a deal enters a stage.
 *
 * - Looks up templates for (pipeline, stage) with auto_create_on_enter=true.
 * - Skips templates whose task_title already exists as a task on this deal
 *   (avoids duplicates when the user re-enters a stage).
 * - Resolves default_assignee_role to a profile via profiles.role first,
 *   falling back to unassigned.
 * - Computes due_date from due_offset_hours (now + N hours).
 */
export async function applyStageChecklist(params: {
  dealId: string
  pipeline: string
  stageKey: string
  createdByUserId: string
}): Promise<ApplyResult> {
  const supabase = createClient()
  const { dealId, pipeline, stageKey, createdByUserId } = params

  const { data: tpls } = await supabase
    .from('pipeline_stage_templates')
    .select('*')
    .eq('pipeline', pipeline)
    .eq('stage', stageKey)
    .eq('active', true)
    .eq('auto_create_on_enter', true)
    .order('order_index', { ascending: true })
  const templates = (tpls as PipelineStageTemplate[]) || []
  if (templates.length === 0) return { created: 0, skipped: 0 }

  // Existing tasks on this deal — to skip duplicates
  const { data: existing } = await supabase
    .from('tasks')
    .select('title')
    .eq('deal_id', dealId)
  const existingTitles = new Set(((existing as Array<{ title: string }>) || []).map((t) => t.title))

  // Role resolution — one lookup per unique role
  const roles = Array.from(new Set(templates.map((t) => t.default_assignee_role).filter(Boolean) as string[]))
  const roleToUser = new Map<string, string>()
  for (const role of roles) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, role, department')
      .or(`role.eq.${role},department.eq.${role}`)
      .limit(1)
    const pick = (profs as Array<{ id: string }>)?.[0]
    if (pick) roleToUser.set(role, pick.id)
  }

  const now = Date.now()
  const rows = templates
    .filter((t) => !existingTitles.has(t.task_title))
    .map((t) => ({
      title: t.task_title,
      description: t.task_description || null,
      status: 'todo' as const,
      priority: t.priority,
      due_date: t.due_offset_hours != null
        ? new Date(now + t.due_offset_hours * 3_600_000).toISOString()
        : null,
      assigned_to: t.default_assignee_role ? (roleToUser.get(t.default_assignee_role) || null) : null,
      created_by: createdByUserId,
      deal_id: dealId,
      tags: ['auto', `stage:${stageKey}`],
    }))

  if (rows.length === 0) return { created: 0, skipped: templates.length }
  const { error } = await supabase.from('tasks').insert(rows)
  if (error) {
    console.error('applyStageChecklist insert failed', error)
    return { created: 0, skipped: templates.length }
  }
  return { created: rows.length, skipped: templates.length - rows.length }
}
