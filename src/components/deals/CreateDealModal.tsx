'use client'

import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { DealPipeline } from '@/types'
import { DealCreateForm } from './DealCreateForm'

interface CreateDealModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  defaultPipeline: DealPipeline
  defaultStage?: string
}

export function CreateDealModal({
  open, onClose, onCreated, defaultPipeline, defaultStage,
}: CreateDealModalProps) {
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" className="flex max-h-[90vh] flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Новая сделка</DialogTitle>
          <p className="text-xs text-gray-500">
            Заполните поля договора — без них сделку нельзя превратить в клиента.
          </p>
        </DialogHeader>

        {open && (
          <DealCreateForm
            defaultPipeline={defaultPipeline}
            defaultStage={defaultStage}
            onCancel={onClose}
            onSubmitted={({ dealId }, openAfter) => {
              onCreated()
              onClose()
              if (openAfter) router.push(`/deals/detail/?id=${dealId}`)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
