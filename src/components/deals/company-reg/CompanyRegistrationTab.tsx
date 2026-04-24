'use client'

import type { CompanyProfile } from '@/types'
import { CompanyProfilePanel } from './CompanyProfilePanel'
import { DealFoundersPanel } from './DealFoundersPanel'
import { PKDSelector } from './PKDSelector'
import { DealBillingPanel } from './DealBillingPanel'
import { DealDocumentsPanel } from './DealDocumentsPanel'

interface Props {
  dealId: string
  pipeline: string
  metadata: Record<string, unknown> | null | undefined
}

export function CompanyRegistrationTab({ dealId, pipeline, metadata }: Props) {
  const profile = (metadata?.company_profile as CompanyProfile | undefined) || null

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <CompanyProfilePanel dealId={dealId} initial={profile} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <DealFoundersPanel dealId={dealId} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <PKDSelector dealId={dealId} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <DealBillingPanel dealId={dealId} pipeline={pipeline} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <DealDocumentsPanel dealId={dealId} />
        </div>
      </div>
    </div>
  )
}
