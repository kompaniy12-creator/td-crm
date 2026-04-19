// Color helpers for rendering Google Calendar events with the same palette
// the user sees in Google. Background comes from calendarList metadata; text
// color is picked to have readable contrast against it.

export function pickTextColor(hex?: string | null): string {
  if (!hex) return '#1f2937'
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#1f2937'
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  // Relative luminance (sRGB).
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.6 ? '#1f2937' : '#ffffff'
}

// Fallback palette for locally-created events or calendars without colors.
export const FALLBACK_BG = '#dbeafe'
export const FALLBACK_FG = '#1e3a8a'
