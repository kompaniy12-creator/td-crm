import { createClient } from '@/lib/supabase/client'
import type { CompanyProfile } from '@/types'

/**
 * Idempotent creation of the two hard-deadline tasks that every sp. z o. o.
 * has to respect:
 *
 *  - PCC-3: must be filed within 14 days of signing the articles of
 *    association. Penalty up to 720 zł + interest.
 *  - CRBR: beneficial-owners filing within 14 days of KRS registration.
 *    Penalty up to 1 000 000 zł.
 *
 * Called from the CompanyProfilePanel after a successful save. We de-dup
 * by a tag ('auto:pcc3' / 'auto:crbr') so repeated saves never spawn
 * duplicate tasks; if the milestone timestamp changes we update the
 * existing task's due_date.
 */
export async function ensureDeadlineTasks(params: {
  dealId: string
  profile: CompanyProfile
  createdByUserId: string
}): Promise<void> {
  const { dealId, profile, createdByUserId } = params
  const supabase = createClient()

  async function upsertTask(tag: string, init: {
    title: string
    description: string
    due: Date
    priority: 'urgent' | 'high'
  }) {
    const { data: existing } = await supabase
      .from('tasks')
      .select('id, tags, due_date')
      .eq('deal_id', dealId)
      .contains('tags', [tag])
      .limit(1)
      .maybeSingle()
    if (existing) {
      // Update due_date if milestone shifted
      if (existing.due_date !== init.due.toISOString()) {
        await supabase.from('tasks')
          .update({ due_date: init.due.toISOString() })
          .eq('id', existing.id as string)
      }
      return
    }
    await supabase.from('tasks').insert({
      title: init.title,
      description: init.description,
      status: 'todo',
      priority: init.priority,
      due_date: init.due.toISOString(),
      created_by: createdByUserId,
      deal_id: dealId,
      tags: [tag, 'auto', 'deadline'],
    })
  }

  // PCC-3 — 14 days from signed_at
  if (profile.signed_at) {
    const due = new Date(profile.signed_at)
    due.setDate(due.getDate() + 14)
    await upsertTask('auto:pcc3', {
      title: 'Подать PCC-3 и оплатить налог',
      description:
        `Срок: 14 дней от подписания umowy spółki (${new Date(profile.signed_at).toLocaleDateString('ru-RU')}).\n` +
        `Сумма: 0,5% от kapitału zakładowego минус 350 zł opłaty sądowej.\n` +
        `Штраф за просрочку: до 720 zł + %.`,
      due,
      priority: 'urgent',
    })
  }

  // CRBR — 14 days from krs_registered_at
  if (profile.krs_registered_at) {
    const due = new Date(profile.krs_registered_at)
    due.setDate(due.getDate() + 14)
    await upsertTask('auto:crbr', {
      title: 'Подать зглашение в CRBR (beneficjenci rzeczywisti)',
      description:
        `Срок: 14 дней от wpisu в KRS (${new Date(profile.krs_registered_at).toLocaleDateString('ru-RU')}).\n` +
        `Штраф за нарушение: до 1 000 000 zł.\n` +
        `Подаётся электронно через crbr.podatki.gov.pl подписью UBO.`,
      due,
      priority: 'urgent',
    })
  }
}
