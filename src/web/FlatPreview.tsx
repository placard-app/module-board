import { useEffect, useRef, useState } from "react"
import { boardSvg } from "../shared/artwork.ts"
import type { Design, Property } from "../shared/board.ts"

export function FlatPreview({
  board,
  onChange,
}: { board: Design; onChange: (properties: Property[]) => void }) {
  const root = useRef<HTMLDivElement>(null)
  const focusAfterSwap = useRef<number | null>(null)
  const drag = useRef<{ index: number; x: number; y: number; moved: boolean } | null>(null)
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
          drag.current = { index, x: e.clientX, y: e.clientY, moved: false }
          setSelected(index)
        }}
        onPointerMove={(e) => {
          const current = drag.current
          if (!current) return
          if (Math.hypot(e.clientX - current.x, e.clientY - current.y) > 5) current.moved = true
          setTarget(tileIndex(document.elementFromPoint(e.clientX, e.clientY)))
        }}
        onPointerUp={(e) => {
          const current = drag.current
          const to = tileIndex(document.elementFromPoint(e.clientX, e.clientY))
          drag.current = null
          if (current?.moved && to !== null) swap(current.index, to)
          else {
            setSelected(null)
            setTarget(null)
          }
        }}
        onLostPointerCapture={() => {
          drag.current = null
          setSelected(null)
          setTarget(null)
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            drag.current = null
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
          .pb .flat-board [data-property-index]{cursor:grab;touch-action:none;user-select:none}
          .pb .flat-board [data-property-index]:focus{outline:none}
          .pb .flat-board [data-property-index]:focus-visible>rect:first-child,
          .pb .flat-board [data-property-index="${selected}"]>rect:first-child,
          .pb .flat-board [data-property-index="${target}"]>rect:first-child{stroke:#1565c0;stroke-width:5}
          .pb .flat-board [data-property-index="${selected}"]{opacity:.6;cursor:grabbing}
        `}</style>
        <div dangerouslySetInnerHTML={{ __html: boardSvg(board, true) }} />
      </div>
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </>
  )
}
