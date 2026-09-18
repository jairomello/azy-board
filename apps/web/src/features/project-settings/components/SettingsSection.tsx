import type { ReactNode } from 'react'
import { AccordionSection } from '../../../components/AccordionSection'

export interface SettingsSectionProps {
  id: string
  title: string
  isOpen: boolean
  onToggle: (id: string) => void
  children: ReactNode
}

/** Fronteira única de apresentação das seções, mantendo o acordeão existente. */
export function SettingsSection(props: SettingsSectionProps) {
  return <AccordionSection {...props} />
}
