// Lightweight HTML sanitizer used for rendering untrusted content
// (calendar event descriptions, incoming email bodies). Allow-list based —
// anything outside the allowlist is unwrapped so text survives but active
// content (scripts, iframes, images, inline styles, event handlers) is stripped.

const ALLOWED_TAGS = new Set([
  'A','B','STRONG','I','EM','U','BR','P','DIV','SPAN','UL','OL','LI',
  'H1','H2','H3','H4','H5','H6','BLOCKQUOTE','CODE','PRE','HR',
  'TABLE','THEAD','TBODY','TR','TD','TH',
])

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined' || !html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        const parent = child.parentNode!
        while (child.firstChild) parent.insertBefore(child.firstChild, child)
        parent.removeChild(child)
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        if (child.tagName === 'A' && attr.name === 'href') {
          const v = attr.value.trim()
          if (!/^(https?:|mailto:)/i.test(v)) child.removeAttribute(attr.name)
        } else {
          child.removeAttribute(attr.name)
        }
      }
      if (child.tagName === 'A') {
        child.setAttribute('target', '_blank')
        child.setAttribute('rel', 'noopener noreferrer')
        child.setAttribute('class', 'text-blue-600 underline hover:text-blue-800')
      }
      walk(child)
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}

export function htmlToText(s: string | null | undefined): string {
  if (!s) return ''
  if (typeof window === 'undefined') return s
  const div = document.createElement('div')
  div.innerHTML = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
  return (div.textContent || div.innerText || '').replace(/\n{3,}/g, '\n\n').trim()
}
