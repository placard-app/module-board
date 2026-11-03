import { jsPDF } from "jspdf"
import "svg2pdf.js"
import { boardSvg } from "../shared/artwork.ts"
import { designError, type Design } from "../shared/board.ts"
import { base64, loadFont } from "./font.ts"
export async function exportBoard(board: Design, tiled: boolean) {
  const error = designError(board)
  if (error) throw new Error(error)
  const font = await loadFont()
  const pdf = new jsPDF({ unit: "mm", format: tiled ? "a4" : [500, 500], orientation: "portrait" })
  pdf.addFileToVFS("BoardSans.ttf", base64(font))
  pdf.addFont("BoardSans.ttf", "BoardSans", "normal")
  pdf.setFont("BoardSans")
  const svg = new DOMParser().parseFromString(boardSvg(board), "image/svg+xml")
    .documentElement as unknown as SVGElement
  const pages = tiled ? 6 : 1
  for (let page = 0; page < pages; page++) {
    if (page) pdf.addPage("a4", "portrait")
    if (tiled) {
      const col = page % 3,
        row = Math.floor(page / 3)
      const tileSvg = boardSvg(board)
        .replace(
          /<svg[^>]*>/,
          `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="520" viewBox="0 0 380 520"><defs><clipPath id="tile"><rect width="380" height="520"/></clipPath></defs><g clip-path="url(#tile)"><g transform="translate(${-col * 330} ${-row * 500})">`,
        )
        .replace("</svg>", "</g></g></svg>")
      const tile = new DOMParser().parseFromString(tileSvg, "image/svg+xml")
        .documentElement as unknown as SVGElement
      await pdf.svg(tile, { x: 10, y: 10, width: 190, height: 260 })
      pdf.setDrawColor(80)
      pdf.setLineWidth(0.2)
      for (const x of [10, 175])
        for (const y of [10, 260]) {
          pdf.line(x - 2, y, x + 2, y)
          pdf.line(x, y - 2, x, y + 2)
        }
      pdf.setFontSize(8)
      pdf.text(`Column ${col + 1}/3 · Row ${row + 1}/2 · Print at 100% · Match crosshairs`, 10, 277)
      pdf.line(10, 284, 60, 284)
      pdf.line(10, 282, 10, 286)
      pdf.line(60, 282, 60, 286)
      pdf.text("50 mm scale check", 65, 285)
    } else await pdf.svg(svg, { x: 0, y: 0, width: 500, height: 500 })
  }
  pdf.save(`placard-board-${tiled ? "a4-assembly" : "500mm"}.pdf`)
}
