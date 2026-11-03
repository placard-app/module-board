// Bundled, licensed font; shared by SVG, WebGL texture and PDF export.
import fontUrl from "./assets/BoardSans.ttf"
let pending: Promise<ArrayBuffer> | undefined
export function loadFont() {
  return (pending ??= (async () => {
    const response = await fetch(new URL(fontUrl, import.meta.url))
    if (!response.ok) throw new Error("Could not load board font")
    const bytes = await response.arrayBuffer()
    const font = new FontFace("BoardSans", bytes)
    await font.load()
    document.fonts.add(font)
    return bytes
  })())
}
export function base64(bytes: ArrayBuffer) {
  let result = ""
  for (const byte of new Uint8Array(bytes)) result += String.fromCharCode(byte)
  return btoa(result)
}
