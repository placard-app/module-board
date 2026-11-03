import { colors, colorAt, slots, wrapLabel, type Design } from "./board.ts"
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  )
const fixed: Record<number, string> = {
  0: "Departure",
  2: "Postcard",
  4: "Travel fund",
  5: "City tram",
  7: "Detour",
  10: "Layover",
  12: "Coffee break",
  15: "River ferry",
  17: "Postcard",
  20: "Scenic Stop",
  22: "Detour",
  25: "Night train",
  28: "Picnic stop",
  30: "Missed Connection",
  33: "Postcard",
  35: "Airport bus",
  36: "Detour",
  38: "Souvenir tax",
}
const icons: Record<string, string> = {
  restaurant: "M-12-14v12m6-12v12m-3-12v28m17-28v28m-5-28v12h5",
  cafe: "M-12-10h20v18h-20zM8-8h6v12H8M-15 13h26",
  bar: "M-12-12h24L0 2v12M-8 14H8",
  park: "M0-15l-13 20h26zM0 5v10",
  museum: "M-15-7L0-16l15 9zM-11-3v15M0-3v15M11-3v15M-15 15h30",
  cinema: "M-15-10h30v23h-30zM-15-4h30M-8-10l5 6M3-10l5 6",
  hotel: "M-14-5h28v15h-28zM-14-12v27M14-5v20M-8-5v7",
  trail: "M-16 12L-4-12 6 7 12-4 18 12M-4-12v-5h10",
  other: "M0-16c-18 0-18 18 0 32 18-14 18-32 0-32z",
}
export function boardSvg(board: Design): string {
  let tiles = ""
  for (let i = 0; i < 40; i++) {
    const side = Math.floor(i / 10),
      step = i % 10,
      corner = step === 0
    const w = corner ? 130 : 82.222222
    const x = corner ? 870 : 870 - step * 82.222222
    const p = board.properties[slots.indexOf(i)]
    const color = p ? colorAt(slots.indexOf(i)) : "#e6dfcd"
    const label = p?.label ?? fixed[i]
    const wrapped = wrapLabel(label, corner ? 15 : 13)
    const lines = wrapped.length > 4 ? ["Shorten label"] : wrapped
    tiles += `<g transform="rotate(${side * 90} 500 500) translate(${x} 870)"><rect width="${w}" height="130" fill="#fffaf0" stroke="#334a43" stroke-width="1.5"/><rect width="${w}" height="22" fill="${color}"/><g transform="translate(${w / 2} 44) scale(.55)" fill="none" stroke="#334a43" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[p?.category ?? "other"] ?? icons.other}"/></g>${lines.map((line, n) => `<text x="${w / 2}" y="${65 + n * 13}" text-anchor="middle" font-size="10.5">${esc(line)}</text>`).join("")}</g>`
  }
  const titleLines = wrapLabel(board.title, 28)
  const title = titleLines.length > 3 ? ["Shorten title"] : titleLines
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000"><g font-family="BoardSans" fill="#263f36"><rect width="1000" height="1000" fill="#f1ecdc"/>${tiles}<rect x="155" y="155" width="690" height="690" rx="12" fill="none" stroke="#c4ccba" stroke-width="2"/><path d="M240 620Q360 310 500 650T760 360" stroke="#c8c9b1" stroke-width="3" stroke-dasharray="8 9" fill="none"/><circle cx="240" cy="620" r="8" fill="#de825c"/><circle cx="760" cy="360" r="8" fill="#de825c"/><text x="500" y="310" text-anchor="middle" font-size="16" letter-spacing="6">PLACARD / FIELD NOTES</text><text x="500" y="368" text-anchor="middle" font-size="13" letter-spacing="3">A JOURNEY THROUGH YOUR PLACES</text>${title.map((line, n) => `<text x="500" y="${455 + n * 43}" text-anchor="middle" font-size="36">${esc(line)}</text>`).join("")}<path d="M475 630l25-45 25 45-25-13z" fill="none" stroke="#486554" stroke-width="3"/><text x="500" y="687" text-anchor="middle" font-size="13" letter-spacing="3">22 PLACES. COUNTLESS MEMORIES.</text><g>${colors.map((c, n) => `<rect x="${396 + n * 26}" y="727" width="20" height="5" fill="${c}"/>`).join("")}</g></g></svg>`
}
