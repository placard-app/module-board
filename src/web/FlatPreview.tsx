import { useEffect, useRef, useState } from "react"
import { boardSvg } from "../shared/artwork.ts"
import type { Design, Property } from "../shared/board.ts"

type DragPreview = { svg: string; width: number; height: number; x: number; y: number }

export function FlatPreview({
  board,
  onChange,
}: { board: Design; onChange: (properties: Property[]) => void }) {
  const root = useRef<HTMLDivElement>(null)
  const focusAfterSwap = useRef<number | null>(null)
  const drag = useRef<{
    index: number
    x: number
    y: number
    moved: boolean
    preview: DragPreview
  } | null>(null)
  const [preview, setPreview] = useState<DragPreview | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState("")
  useEffect(() => {
    if (focusAfterSwap.current === null) return
    root.current?.querySelector<SVGElement>(
      `[data-property-index="${focusAfterSwap.current}"]`,
    )?.focus()
    focusAfterSwap.current = null
  }, [board.properties])
  const tileIndex = (element: Element | null) => {
    const tile = element?.closest("[data-property-index]")
    return tile && root.current?.contains(tile)
      ? Number(tile.getAttribute("data-property-index"))
      : null
  }
  const swap = (from: number, to: number, keyboard = false) => {
    if (from !== to) {
      const properties = [...board.properties]
      ;[properties[from], properties[to]] = [properties[to], properties[from]]
      if (keyboard) focusAfterSwap.current = to
      onChange(properties)
      setAnnouncement(`Swapped ${board.properties[from].name} and ${board.properties[to].name}.`)
    }
    setSelected(null)
    setTarget(null)
  }
  return (
    <>
      <p className="muted" id="board-swap-help">
        Drag a place onto another to swap them. With a keyboard, select two places using Enter or
        Space. Escape cancels.
      </p>
      <div
        ref={root}
        className="flat-board"
        aria-describedby="board-swap-help"
        onPointerDown={(e) => {
          if (e.button !== 0 || !e.isPrimary) return
          const index = tileIndex(e.target as Element)
          if (index === null) return
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          const tile = root.current!.querySelector<SVGGElement>(`[data-property-index="${index}"]`)!
          tile.focus({ preventScroll: true })
          const bounds = tile.getBoundingClientRect()
          const boardBounds = tile.ownerSVGElement!.getBoundingClientRect()
          const scale = 1000 / boardBounds.width
          const copy = tile.cloneNode(true) as SVGGElement
          for (const attribute of [
            "data-property-index", "tabindex", "role", "aria-label", "aria-invalid",
          ]) copy.removeAttribute(attribute)
          const viewBox = [
            (bounds.x - boardBounds.x) * scale,
            (bounds.y - boardBounds.y) * scale,
            bounds.width * scale,
            bounds.height * scale,
          ].join(" ")
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><g font-family="BoardSans" fill="#263f36">${copy.outerHTML}</g></svg>`
          drag.current = {
            index,
            x: e.clientX,
            y: e.clientY,
            moved: false,
            preview: { svg, width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y },
          }
          setSelected(index)
        }}
        onPointerMove={(e) => {
          const current = drag.current
          if (!current) return
          if (Math.hypot(e.clientX - current.x, e.clientY - current.y) > 5) current.moved = true
          if (current.moved) {
            setPreview({
              ...current.preview,
              x: current.preview.x + e.clientX - current.x,
              y: current.preview.y + e.clientY - current.y,
            })
          }
          setTarget(tileIndex(document.elementFromPoint(e.clientX, e.clientY)))
        }}
        onPointerUp={(e) => {
          const current = drag.current
          const to = tileIndex(document.elementFromPoint(e.clientX, e.clientY))
          drag.current = null
          setPreview(null)
          if (current?.moved && to !== null) swap(current.index, to)
          else {
            setSelected(null)
            setTarget(null)
          }
        }}
        onLostPointerCapture={() => {
          drag.current = null
          setPreview(null)
          setSelected(null)
          setTarget(null)
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            drag.current = null
            setPreview(null)
            setSelected(null)
            setTarget(null)
          }
          if (e.key !== "Enter" && e.key !== " ") return
          const index = tileIndex(e.target as Element)
          if (index === null) return
          e.preventDefault()
          if (selected === null) {
            setSelected(index)
            setAnnouncement(`${board.properties[index].name} selected. Choose another place to swap.`)
          } else swap(selected, index, true)
        }}
      >
        <style>{`
          .pb .drag-preview{position:fixed;pointer-events:none;z-index:110;filter:drop-shadow(0 6px 8px #172c2560)}
          .pb .drag-preview svg{width:100%;height:100%;overflow:visible}
          .pb .flat-board [data-property-index]{cursor:grab;touch-action:none;user-select:none}
          .pb .flat-board [data-property-index]:focus{outline:none}
          .pb .flat-board [data-property-index]:focus-visible>rect:first-child,
          .pb .flat-board [data-property-index="${selected}"]>rect:first-child,
          .pb .flat-board [data-property-index="${target}"]>rect:first-child{stroke:#1565c0;stroke-width:5}
          .pb .flat-board [data-property-index="${selected}"]{opacity:.6;cursor:grabbing}
        `}</style>
        <div dangerouslySetInnerHTML={{ __html: boardSvg(board, true) }} />
      </div>
      {preview && (
        <div
          className="drag-preview"
          aria-hidden="true"
          style={{ left: preview.x, top: preview.y, width: preview.width, height: preview.height }}
          dangerouslySetInnerHTML={{ __html: preview.svg }}
        />
      )}
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </>
  )
}
