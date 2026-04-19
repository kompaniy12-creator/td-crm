// Built-in background presets for the CRM dashboard.
// Uses Unsplash CDN URLs (no auth, hot-linkable, free) — ok for static export.

export interface BackgroundPreset {
  id: string
  label: string
  url: string | null
  thumb: string
}

const u = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

export const BACKGROUNDS: BackgroundPreset[] = [
  {
    id: 'none',
    label: 'Без фона',
    url: null,
    thumb: '',
  },
  {
    id: 'clouds',
    label: 'Облака',
    url: u('photo-1601297183305-6df142704ea2', 2000),
    thumb: u('photo-1601297183305-6df142704ea2', 400),
  },
  {
    id: 'mountains',
    label: 'Горы',
    url: u('photo-1464822759023-fed622ff2c3b', 2000),
    thumb: u('photo-1464822759023-fed622ff2c3b', 400),
  },
  {
    id: 'ocean',
    label: 'Океан',
    url: u('photo-1505142468610-359e7d316be0', 2000),
    thumb: u('photo-1505142468610-359e7d316be0', 400),
  },
  {
    id: 'forest',
    label: 'Лес',
    url: u('photo-1448375240586-882707db888b', 2000),
    thumb: u('photo-1448375240586-882707db888b', 400),
  },
  {
    id: 'abstract',
    label: 'Абстракция',
    url: u('photo-1557682250-33bd709cbe85', 2000),
    thumb: u('photo-1557682250-33bd709cbe85', 400),
  },
]

export function findBackground(id: string | null | undefined): BackgroundPreset | undefined {
  if (!id) return undefined
  return BACKGROUNDS.find((b) => b.id === id)
}
