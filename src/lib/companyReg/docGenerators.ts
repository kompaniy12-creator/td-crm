import {
  Document, Paragraph, TextRun, AlignmentType, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  Packer,
} from 'docx'
import type { CompanyProfile, DealFounder } from '@/types'

// ═══════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════

function p(text: string, opts: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 22 })],
  })
}

function spacer(count = 1) {
  return Array.from({ length: count }, () => new Paragraph({ children: [new TextRun('')] }))
}

function headerCell(text: string) {
  return new TableCell({
    shading: { fill: 'E5E7EB' },
    children: [p(text, { bold: true, size: 20 })],
  })
}
function bodyCell(text: string) {
  return new TableCell({ children: [p(text, { size: 20 })] })
}

function cityAndDate(city?: string) {
  const d = new Date()
  const dateStr = d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' })
  return p(`${city || 'Warszawa'}, dnia ${dateStr} r.`, { align: AlignmentType.RIGHT, size: 22 })
}

function companyHeader(profile: CompanyProfile) {
  const name = profile.company_name_approved || profile.company_name_proposed || '[Nazwa spółki]'
  const addr = profile.registered_office
  const addrLine = addr
    ? [addr.street, `${addr.postal_code || ''} ${addr.city || ''}`.trim()].filter(Boolean).join(', ')
    : '[Adres siedziby]'
  return [
    p(name, { bold: true, size: 24 }),
    p(addrLine, { size: 22 }),
  ]
}

function founderName(f: DealFounder): string {
  if (f.entity_type === 'legal_entity') {
    const extra = f.entity_registry_no ? ` (KRS ${f.entity_registry_no})` : ''
    const rep = f.entity_representative ? ` — reprezentowana przez: ${f.entity_representative}` : ''
    return `${f.entity_name}${extra}${rep}`
  }
  return f.full_name || '(bez imienia)'
}

// ═══════════════════════════════════════════════════════════════
// 1. Lista wspólników z adresami do doręczeń
// ═══════════════════════════════════════════════════════════════

export function buildListaWspolnikow(params: { profile: CompanyProfile; founders: DealFounder[] }) {
  const { profile, founders } = params
  const shareholders = founders.filter((f) => f.roles.includes('wspolnik'))

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Lp.'),
          headerCell('Wspólnik'),
          headerCell('Adres do doręczeń'),
          headerCell('Udziały'),
          headerCell('%'),
        ],
      }),
      ...shareholders.map((f, i) => new TableRow({
        children: [
          bodyCell(String(i + 1)),
          bodyCell(founderName(f)),
          bodyCell(f.delivery_address),
          bodyCell(f.shares_count != null ? String(f.shares_count) : '—'),
          bodyCell(f.share_percent != null ? `${f.share_percent}%` : '—'),
        ],
      })),
    ],
  })

  return new Document({
    sections: [{
      children: [
        cityAndDate(profile.registered_office?.city),
        ...spacer(1),
        ...companyHeader(profile),
        ...spacer(2),
        p('LISTA WSPÓLNIKÓW', { bold: true, size: 28, align: AlignmentType.CENTER }),
        p('wraz z adresami do doręczeń', { size: 22, align: AlignmentType.CENTER }),
        ...spacer(2),
        table,
        ...spacer(3),
        p('___________________________', { align: AlignmentType.RIGHT }),
        p('Podpis osoby reprezentującej spółkę', { align: AlignmentType.RIGHT, size: 18 }),
      ],
    }],
  })
}

// ═══════════════════════════════════════════════════════════════
// 2. Lista członków zarządu z adresami do doręczeń
// ═══════════════════════════════════════════════════════════════

export function buildListaZarzadu(params: { profile: CompanyProfile; founders: DealFounder[] }) {
  const { profile, founders } = params
  const board = founders.filter((f) =>
    f.roles.includes('zarzad') || f.roles.includes('prezes') || f.roles.includes('wiceprezes'),
  )

  const roleLabel = (f: DealFounder) => {
    if (f.roles.includes('prezes'))     return 'Prezes zarządu'
    if (f.roles.includes('wiceprezes')) return 'Wiceprezes zarządu'
    return 'Członek zarządu'
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Lp.'),
          headerCell('Imię i nazwisko'),
          headerCell('Funkcja'),
          headerCell('Adres do doręczeń w Polsce'),
        ],
      }),
      ...board.map((f, i) => new TableRow({
        children: [
          bodyCell(String(i + 1)),
          bodyCell(founderName(f)),
          bodyCell(roleLabel(f)),
          bodyCell(f.delivery_address),
        ],
      })),
    ],
  })

  return new Document({
    sections: [{
      children: [
        cityAndDate(profile.registered_office?.city),
        ...spacer(1),
        ...companyHeader(profile),
        ...spacer(2),
        p('LISTA CZŁONKÓW ZARZĄDU', { bold: true, size: 28, align: AlignmentType.CENTER }),
        p('wraz z adresami do doręczeń', { size: 22, align: AlignmentType.CENTER }),
        ...spacer(2),
        table,
        ...spacer(1),
        p(
          'Niniejszym oświadczam, że powyższe adresy są aktualnymi adresami do doręczeń członków zarządu spółki.',
          { size: 20 },
        ),
        ...spacer(3),
        p('___________________________', { align: AlignmentType.RIGHT }),
        p('Podpis osoby reprezentującej spółkę', { align: AlignmentType.RIGHT, size: 18 }),
      ],
    }],
  })
}

// ═══════════════════════════════════════════════════════════════
// 3. Oświadczenie — cudzoziemcy / nieruchomości
// ═══════════════════════════════════════════════════════════════

export function buildOswiadczenieCudzoziemcy(params: { profile: CompanyProfile }) {
  const { profile } = params
  const foreign = profile.foreign_majority
  const property = profile.owns_real_property

  const foreignLine = foreign
    ? 'Udziałowcy zagraniczni posiadają co najmniej 50% udziałów w kapitale zakładowym spółki.'
    : 'Udziałowcy zagraniczni nie posiadają co najmniej 50% udziałów w kapitale zakładowym spółki.'

  const propertyLine = property
    ? 'Spółka jest właścicielem lub użytkownikiem wieczystym nieruchomości położonych na terytorium Rzeczypospolitej Polskiej.'
    : 'Spółka nie jest właścicielem ani użytkownikiem wieczystym nieruchomości położonych na terytorium Rzeczypospolitej Polskiej.'

  return new Document({
    sections: [{
      children: [
        cityAndDate(profile.registered_office?.city),
        ...spacer(1),
        ...companyHeader(profile),
        ...spacer(2),
        p('OŚWIADCZENIE', { bold: true, size: 28, align: AlignmentType.CENTER }),
        p(
          'w przedmiocie statusu cudzoziemców oraz posiadania nieruchomości',
          { size: 22, align: AlignmentType.CENTER },
        ),
        ...spacer(2),
        p(
          'Niniejszym, działając w imieniu wyżej wymienionej spółki, oświadczam, co następuje:',
          { size: 22 },
        ),
        ...spacer(1),
        p(`1. ${foreignLine}`, { size: 22 }),
        ...spacer(1),
        p(`2. ${propertyLine}`, { size: 22 }),
        ...spacer(1),
        p(
          'Oświadczenie składam świadomie i zgodnie z wymogami ustawy z dnia 24 marca 1920 r. ' +
          'o nabywaniu nieruchomości przez cudzoziemców oraz art. 19c ustawy o Krajowym Rejestrze Sądowym.',
          { size: 20 },
        ),
        ...spacer(4),
        p('___________________________', { align: AlignmentType.RIGHT }),
        p('Podpis osoby reprezentującej spółkę', { align: AlignmentType.RIGHT, size: 18 }),
      ],
    }],
  })
}

// ═══════════════════════════════════════════════════════════════
// 4. Uchwała o powołaniu zarządu
// ═══════════════════════════════════════════════════════════════

export function buildUchwalaZarzad(params: { profile: CompanyProfile; founders: DealFounder[] }) {
  const { profile, founders } = params
  const board = founders.filter((f) =>
    f.roles.includes('zarzad') || f.roles.includes('prezes') || f.roles.includes('wiceprezes'),
  )

  const roleLabel = (f: DealFounder) => {
    if (f.roles.includes('prezes'))     return 'Prezesa zarządu'
    if (f.roles.includes('wiceprezes')) return 'Wiceprezesa zarządu'
    return 'Członka zarządu'
  }

  const boardParas = board.map((f, i) =>
    p(`${i + 1}. Pana/Panią ${founderName(f)} — na stanowisko ${roleLabel(f)}.`, { size: 22 }),
  )

  return new Document({
    sections: [{
      children: [
        cityAndDate(profile.registered_office?.city),
        ...spacer(1),
        ...companyHeader(profile),
        ...spacer(2),
        p('UCHWAŁA ZGROMADZENIA WSPÓLNIKÓW', { bold: true, size: 26, align: AlignmentType.CENTER }),
        p('w sprawie powołania zarządu', { bold: true, size: 24, align: AlignmentType.CENTER }),
        ...spacer(2),
        p('§ 1', { bold: true, align: AlignmentType.CENTER, size: 22 }),
        p('Zgromadzenie Wspólników niniejszym powołuje w skład zarządu spółki:', { size: 22 }),
        ...boardParas,
        ...spacer(1),
        p('§ 2', { bold: true, align: AlignmentType.CENTER, size: 22 }),
        p('Uchwała wchodzi w życie z dniem podjęcia.', { size: 22 }),
        ...spacer(3),
        p('___________________________', { align: AlignmentType.RIGHT }),
        p('Przewodniczący Zgromadzenia', { align: AlignmentType.RIGHT, size: 18 }),
      ],
    }],
  })
}

// ═══════════════════════════════════════════════════════════════
// Dispatcher
// ═══════════════════════════════════════════════════════════════

export async function generateDocumentBlob(
  templateCode: string,
  data: { profile: CompanyProfile; founders: DealFounder[] },
): Promise<{ blob: Blob; fileName: string } | null> {
  let doc: Document | null = null
  let fileName = ''
  switch (templateCode) {
    case 'lista_wspolnikow':
      doc = buildListaWspolnikow(data)
      fileName = 'Lista wspólników.docx'
      break
    case 'lista_zarzadu':
      doc = buildListaZarzadu(data)
      fileName = 'Lista członków zarządu.docx'
      break
    case 'oswiadczenie_cudzoziemcy':
      doc = buildOswiadczenieCudzoziemcy(data)
      fileName = 'Oświadczenie — cudzoziemcy i nieruchomości.docx'
      break
    case 'uchwala_zarzad':
      doc = buildUchwalaZarzad(data)
      fileName = 'Uchwała o powołaniu zarządu.docx'
      break
    default:
      return null
  }
  if (!doc) return null
  // Packer.toBlob works in the browser; server-only `toBuffer` intentionally
  // avoided so the module is safe to import from client components.
  const blob = await Packer.toBlob(doc)
  return { blob, fileName }
}

export const GENERATABLE_CODES = [
  'lista_wspolnikow',
  'lista_zarzadu',
  'oswiadczenie_cudzoziemcy',
  'uchwala_zarzad',
]

/**
 * Validate that enough data is filled for a given template.
 * Returns a list of missing-field labels, empty array = ready to generate.
 */
export function validateTemplateData(
  templateCode: string,
  data: { profile: CompanyProfile | null; founders: DealFounder[] },
): string[] {
  const missing: string[] = []
  const { profile, founders } = data

  const needsProfileName = ['lista_wspolnikow','lista_zarzadu','oswiadczenie_cudzoziemcy','uchwala_zarzad']
  if (needsProfileName.includes(templateCode)) {
    if (!profile?.company_name_proposed && !profile?.company_name_approved) {
      missing.push('Название spółki')
    }
  }

  if (templateCode === 'lista_wspolnikow') {
    const sh = founders.filter((f) => f.roles.includes('wspolnik'))
    if (sh.length === 0) missing.push('Хотя бы один wspólnik')
    if (sh.some((f) => !f.delivery_address?.trim())) missing.push('Адреса всех wspólników')
  }

  if (templateCode === 'lista_zarzadu' || templateCode === 'uchwala_zarzad') {
    const board = founders.filter((f) =>
      f.roles.includes('zarzad') || f.roles.includes('prezes') || f.roles.includes('wiceprezes'),
    )
    if (board.length === 0) missing.push('Хотя бы один członek zarządu')
    if (board.some((f) => !f.delivery_address?.trim())) missing.push('Адреса всех членов zarządu')
  }

  if (templateCode === 'oswiadczenie_cudzoziemcy') {
    if (profile?.foreign_majority == null) missing.push('Декларация о foreign majority')
    if (profile?.owns_real_property == null) missing.push('Декларация о недвижимости')
  }

  return missing
}
