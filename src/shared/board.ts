export type Place = {
  id: string
  name: string
  category: string
  tags?: { id: string; name: string }[]
  listIds?: string[]
}
export type Property = { placeId: string; name: string; category: string; label: string }
export type Design = { templateVersion: 1; title: string; properties: Property[] }
export type Board = Design & { id: string; revision: number; updatedAt: string }
export const categories = [
  "restaurant",
  "cafe",
  "bar",
  "park",
  "museum",
  "cinema",
  "hotel",
  "trail",
  "other",
]
export const slots = [
  1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37, 39,
]
export const groupSizes = [2, 3, 3, 3, 3, 3, 3, 2]
export const colors = [
  "#a96745",
  "#67bfc7",
  "#c674a6",
  "#e99a49",
  "#dc6558",
  "#e6c957",
  "#71a883",
  "#668bb9",
]
export function colorAt(index: number) {
  let n = 0
  return colors[groupSizes.findIndex((size) => (n += size) > index)]
}
export const textWidth = (text: string) =>
  [...text].reduce(
    (n, c) =>
      n + (/[MW@%]/.test(c) ? 1 : /[ilI.,!' :;]/.test(c) ? 0.32 : /[A-Z]/.test(c) ? 0.78 : 0.66),
    0,
  )
export function wrapLabel(text: string, width = 13): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.trim().split(/\s+/)) {
    if (textWidth(word) > width * 0.55) return Array(5).fill(word)
    if (textWidth((line + " " + word).trim()) > width * 0.55) {
      lines.push(line)
      line = word
    } else line = (line + " " + word).trim()
  }
  if (line) lines.push(line)
  return lines
}
export function labelError(label: string): string | null {
  if (!label?.trim()) return "Enter a printed label"
  if (label.length > 80 || wrapLabel(label).length > 4)
    return "Shorten this label so it fits on the board"
  return null
}
export function designError(d: Design): string | null {
  if (d.templateVersion !== 1) return "Unsupported board template"
  if (!d.title?.trim() || d.title.length > 60) return "Use a board title of 1–60 characters"
  if (wrapLabel(d.title, 28).length > 3) return "Shorten the board title so it fits"
  if (!Array.isArray(d.properties) || d.properties.length !== 22) return "Choose exactly 22 places"
  if (new Set(d.properties.map((p) => p.placeId)).size !== 22) return "Each place must be unique"
  for (const p of d.properties) {
    if (!p.placeId || !p.name || !categories.includes(p.category)) return "Invalid place"
    if (labelError(p.label)) return `Shorten the printed label for ${p.name}`
  }
  return null
}
export function sample(pool: Place[], random = Math.random): Property[] {
  const items = [...new Map(pool.map((p) => [p.id, p])).values()]
  if (items.length < 22) throw new Error(`Add ${22 - items.length} more places to this selection`)
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
    .slice(0, 22)
    .map((p) => ({ placeId: p.id, name: p.name, category: p.category, label: p.name }))
}
