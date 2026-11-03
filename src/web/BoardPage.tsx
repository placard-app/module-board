import { useEffect, useRef, useState } from "react"
import {
  categories,
  colorAt,
  designError,
  sample,
  wrapLabel,
  type Board,
  type Design,
  type Place,
  type Property,
} from "../shared/board.ts"
import { boardSvg } from "../shared/artwork.ts"
import { loadFont } from "./font.ts"
const API = "/api/m/places.board"
async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error ?? "Request failed")
  return result
}
const styles = `.pb{--ink:#263f36;--paper:#fffaf0;color:var(--ink);max-width:1440px;margin:auto;padding:24px;font:14px/1.5 system-ui}.pb *{box-sizing:border-box}.pb h1{font:500 clamp(30px,4vw,48px)/1.1 Georgia,serif;margin:8px 0}.pb h2{font:500 24px Georgia,serif}.pb p{margin:8px 0 20px}.pb button,.pb input,.pb select{font:inherit;border:1px solid #b9c4b7;border-radius:8px;padding:9px 12px;color:var(--ink);background:#fffdf7}.pb button{cursor:pointer}.pb button:hover{background:#eee9db}.pb button:disabled{opacity:.45;cursor:not-allowed}.pb button.primary{background:var(--ink);color:white}.pb input{min-width:0}.pb .bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pb .muted{color:#667469;font-size:12px}.pb .eyebrow{font-size:11px;letter-spacing:3px;text-transform:uppercase}.pb .gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;margin-top:28px}.pb .card{padding:18px;background:#f3efdf;border:1px solid #d6dacb;border-radius:16px}.pb svg{display:block;width:100%;height:auto}.pb .workspace{display:grid;grid-template-columns:minmax(0,1fr) 350px;gap:24px;margin-top:20px;align-items:start}.pb .preview{background:#eeeade;padding:20px;border-radius:16px;position:sticky;top:16px}.pb .editor{background:#fffaf0;border:1px solid #d6dacb;border-radius:16px;padding:16px}.pb label{display:block;margin:10px 0 4px}.pb label input,.pb label select{display:block;width:100%;margin-top:4px}.pb .property{border-top:1px solid #dddcca;padding:12px 0}.pb .property-head{display:flex;align-items:center;gap:8px;font-size:12px}.pb .dot{width:12px;height:12px;border-radius:50%;flex:none}.pb .notice{padding:12px 16px;border-radius:8px;background:#fbe7d6;margin:12px 0}.pb .success{background:#e2eddf}.pb .three{height:540px;width:100%;touch-action:none}.pb .three canvas{display:block}.pb .list{max-height:320px;overflow:auto}.pb .list button{display:block;width:100%;text-align:left;margin:5px 0}.pb .toolbar{margin:16px 0}.pb .small{padding:4px 8px;font-size:12px}.pb details{margin:14px 0}.pb summary{cursor:pointer}.pb .modal{position:fixed;inset:0;background:#172c2580;display:grid;place-items:center;z-index:100;padding:20px}.pb .dialog{background:#fffaf0;border-radius:16px;padding:24px;width:min(540px,100%);max-height:85vh;overflow:auto}@media(max-width:850px){.pb{padding:14px}.pb .workspace{grid-template-columns:1fr}.pb .preview{position:static;padding:8px}.pb .three{height:360px}.pb .editor{width:100%}}`
function ThreePreview({ svg, onFail }: { svg: string; onFail: (message: string) => void }) {
  const root = useRef<HTMLDivElement>(null)
  const handle = useRef<{ dispose: () => void; reset: () => void } | null>(null)
  useEffect(() => {
    let cancelled = false
    import("./three-view.ts")
      .then((m) => (cancelled ? null : m.mountBoard(root.current!, svg)))
      .then((value) => {
        if (!value) return
        if (cancelled) value.dispose()
        else handle.current = value
      })
      .catch(() => {
        if (!cancelled)
          onFail("3D is unavailable on this device. You can still edit and print the flat board.")
      })
    return () => {
      cancelled = true
      handle.current?.dispose()
      handle.current = null
    }
  }, [svg])
  return (
    <>
      <div ref={root} className="three" />
      <div className="bar">
        <button onClick={() => handle.current?.reset()}>Reset view</button>
        <span className="muted">Drag to rotate · Scroll or pinch to zoom</span>
      </div>
    </>
  )
}
export function BoardPage() {
  const [boards, setBoards] = useState<Board[]>([]),
    [pool, setPool] = useState<Place[]>([]),
    [allPlaces, setAllPlaces] = useState<Place[]>([]),
    [lists, setLists] = useState<{ id: string; name: string }[]>([]),
    [draft, setDraft] = useState<(Design & Partial<Board>) | null>(null),
    [baseline, setBaseline] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [view, setView] = useState("flat"),
    [fontReady, setFontReady] = useState(false),
    [category, setCategory] = useState(""),
    [tag, setTag] = useState(""),
    [list, setList] = useState(""),
    [text, setText] = useState(""),
    [replace, setReplace] = useState<number | null>(null),
    [query, setQuery] = useState(""),
    [filtering, setFiltering] = useState(false)
  const dirty = !!draft && JSON.stringify(draft) !== baseline
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  useEffect(() => {
    let active = true
    Promise.all([
      api<Board[]>("/boards"),
      api<Place[]>("/search", "POST", {}),
      loadFont(),
      api<{ id: string; name: string }[]>("/lists"),
    ])
      .then(([b, p, _, l]) => {
        if (active) {
          setBoards(b)
          setLists(l)
          setAllPlaces(p)
          setPool(p)
          setFontReady(true)
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message)
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a[href]")
      if (a && dirtyRef.current && !window.confirm("Leave without saving this board?")) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", handler)
    document.addEventListener("click", click, true)
    return () => {
      window.removeEventListener("beforeunload", handler)
      document.removeEventListener("click", click, true)
    }
  }, [])
  useEffect(() => {
    let active = true
    setFiltering(true)
    const timer = setTimeout(
      () =>
        api<Place[]>("/search", "POST", {
          ...(category ? { category } : {}),
          ...(tag ? { tag } : {}),
          ...(list ? { list } : {}),
          ...(text.trim() ? { text: text.trim() } : {}),
        })
          .then((p) => {
            if (active) setPool(p)
          })
          .catch((e) => {
            if (active) setMessage(e.message)
          })
          .finally(() => {
            if (active) setFiltering(false)
          }),
      200,
    )
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [category, tag, list, text])
  const canLeave = () => !dirty || window.confirm("Discard unsaved changes?")
  const open = (b: Board) => {
    if (!canLeave()) return
    setDraft(b)
    setBaseline(JSON.stringify(b))
    setView("flat")
    setMessage("")
  }
  const change = (properties: Property[]) => setDraft((d) => (d ? { ...d, properties } : d))
  const create = () => {
    if (!canLeave()) return
    setDraft({ templateVersion: 1, title: "Our favorite places", properties: [] })
    setBaseline("")
    setMessage("")
    setView("flat")
  }
  async function task(fn: () => Promise<void>) {
    setBusy(true)
    setMessage("")
    try {
      await fn()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    if (!draft) return
    await task(async () => {
      const b = await api<Board>(
        draft.id ? `/boards/${draft.id}` : "/boards",
        draft.id ? "PUT" : "POST",
        draft,
      )
      setDraft(b)
      setBaseline(JSON.stringify(b))
      setBoards(await api<Board[]>("/boards"))
      setMessage("Board saved.")
    })
  }
  async function duplicate(b: Board) {
    if (!canLeave()) return
    await task(async () => {
      const saved = await api<Board>("/boards", "POST", {
        ...b,
        title: `${b.title.slice(0, 53)} (copy)`,
        duplicateOf: b.id,
      })
      setBoards(await api<Board[]>("/boards"))
      setDraft(saved)
      setBaseline(JSON.stringify(saved))
      setView("flat")
    })
  }
  const tags = [...new Map(allPlaces.flatMap((p) => p.tags ?? []).map((t) => [t.id, t])).values()]
  const error = draft ? designError(draft) : null
  const svg = draft && draft.properties.length === 22 ? boardSvg(draft) : ""
  return (
    <main className="pb">
      <style>{styles}</style>
      <header className="bar" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow">Placard / Travel workshop</div>
          <h1>Your places. Your board.</h1>
          <p>Turn the places you love into something worth gathering around.</p>
        </div>
        <button className="primary" onClick={create} disabled={busy}>
          Create board
        </button>
      </header>
      {message && (
        <div role="status" className={`notice ${message === "Board saved." ? "success" : ""}`}>
          {message}
        </div>
      )}
      {!draft ? (
        <>
          <div className="bar">
            <h2>Your collection</h2>
            <span className="muted">{boards.length} saved boards</span>
          </div>
          {!boards.length && (
            <div className="card">
              <h2>A little adventure, made by you.</h2>
              <p>
                Choose 22 places, make them your own, and print a 50 cm board for your next
                get-together.
              </p>
              <button onClick={create}>Make your first board</button>
            </div>
          )}
          <div className="gallery">
            {boards.map((b) => (
              <article className="card" key={b.id}>
                <div dangerouslySetInnerHTML={{ __html: boardSvg(b) }} />
                <h2>{b.title}</h2>
                <div className="bar">
                  <button onClick={() => open(b)}>Open board</button>
                  <button disabled={busy} onClick={() => duplicate(b)}>
                    Duplicate
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete “${b.title}”?`))
                        task(async () => {
                          await api(`/boards/${b.id}`, "DELETE")
                          setBoards(boards.filter((x) => x.id !== b.id))
                        })
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="bar">
            <button
              onClick={() => {
                if (canLeave()) setDraft(null)
              }}
            >
              ← Collection
            </button>
            <button className="primary" onClick={save} disabled={busy || !!error}>
              {busy ? "Working…" : "Save board"}
            </button>
            <span className="muted">{dirty ? "Unsaved changes" : "All changes saved"}</span>
            {draft.id && (
              <button
                onClick={() =>
                  task(async () => {
                    if (!canLeave()) return
                    const b = await api<Board>(`/boards/${draft.id}`)
                    setDraft(b)
                    setBaseline(JSON.stringify(b))
                  })
                }
              >
                Reopen saved version
              </button>
            )}
          </div>
          <div className="workspace">
            <section className="preview">
              <div className="bar toolbar">
                <button aria-pressed={view === "flat"} onClick={() => setView("flat")}>
                  Flat board
                </button>
                <button
                  aria-pressed={view === "3d"}
                  disabled={!svg || !fontReady}
                  onClick={() => setView("3d")}
                >
                  Explore in 3D
                </button>
              </div>
              {!svg ? (
                <div style={{ padding: "100px 20px", textAlign: "center" }}>
                  <h2>Every adventure starts somewhere.</h2>
                  <p>Choose a selection with at least 22 places, then auto-fill your board.</p>
                </div>
              ) : view === "flat" ? (
                <div dangerouslySetInnerHTML={{ __html: svg }} />
              ) : (
                <ThreePreview
                  svg={svg}
                  onFail={(m) => {
                    setMessage(m)
                    setView("flat")
                  }}
                />
              )}
              <div className="bar toolbar">
                <button
                  disabled={busy || !!error || !fontReady}
                  onClick={() =>
                    task(async () => {
                      const { exportBoard } = await import("./export.ts")
                      await exportBoard(draft, false)
                    })
                  }
                >
                  Print-shop PDF · 50 cm
                </button>
                <button
                  disabled={busy || !!error || !fontReady}
                  onClick={() =>
                    task(async () => {
                      const { exportBoard } = await import("./export.ts")
                      await exportBoard(draft, true)
                    })
                  }
                >
                  Home PDF · 6 × A4
                </button>
              </div>
              <p className="muted">
                Home printing: actual size / 100%, single-sided. Check the 50 mm ruler, trim at
                crosshairs, and match overlapping artwork.
              </p>
            </section>
            <aside className="editor">
              <h2>Make it yours</h2>
              <label>
                Board title
                <input
                  value={draft.title}
                  maxLength={60}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <details open={draft.properties.length === 0}>
                <summary>Choose your places</summary>
                <label>
                  Search
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Find a place"
                  />
                </label>
                <label>
                  Category
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tag
                  <select value={tag} onChange={(e) => setTag(e.target.value)}>
                    <option value="">All tags</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  List
                  <select value={list} onChange={(e) => setList(e.target.value)}>
                    <option value="">All lists</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p role="status">
                  {filtering
                    ? "Finding places…"
                    : `${pool.length} available · ${Math.min(pool.length, 22)}/22 needed`}
                  {!filtering &&
                    pool.length < 22 &&
                    ` · Add ${22 - pool.length} more or broaden your filters.`}
                </p>
                <button
                  disabled={filtering || pool.length < 22}
                  onClick={() => {
                    if (
                      draft.properties.length &&
                      !window.confirm("Replace all 22 places with a new selection?")
                    )
                      return
                    change(sample(pool))
                  }}
                >
                  Auto-fill 22 places
                </button>
              </details>
              {draft.properties.length === 22 && (
                <button
                  onClick={() => {
                    const p = [...draft.properties]
                    for (let i = p.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1))
                      ;[p[i], p[j]] = [p[j], p[i]]
                    }
                    change(p)
                  }}
                >
                  Shuffle order
                </button>
              )}
              {error && (
                <p className="notice" role="status">
                  {error}
                </p>
              )}
              {draft.properties.map((p, i) => (
                <div key={p.placeId} className="property">
                  <div className="property-head">
                    <span className="dot" style={{ background: colorAt(i) }} />
                    {i + 1}. {p.name}
                  </div>
                  <label>
                    Printed label
                    <input
                      value={p.label}
                      maxLength={80}
                      aria-invalid={wrapLabel(p.label).length > 4}
                      onChange={(e) =>
                        change(
                          draft.properties.map((v, n) =>
                            n === i ? { ...v, label: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="bar">
                    <button
                      className="small"
                      onClick={() => {
                        setReplace(i)
                        setQuery("")
                      }}
                    >
                      Replace
                    </button>
                    <button
                      className="small"
                      aria-label={`Move ${p.name} up`}
                      disabled={i === 0}
                      onClick={() => {
                        const items = [...draft.properties]
                        ;[items[i - 1], items[i]] = [items[i], items[i - 1]]
                        change(items)
                      }}
                    >
                      ↑
                    </button>
                    <button
                      className="small"
                      aria-label={`Move ${p.name} down`}
                      disabled={i === 21}
                      onClick={() => {
                        const items = [...draft.properties]
                        ;[items[i + 1], items[i]] = [items[i], items[i + 1]]
                        change(items)
                      }}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </aside>
          </div>
        </>
      )}
      {replace !== null && draft && (
        <div className="modal">
          <div
            className="dialog"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setReplace(null)
                return
              }
              if (e.key === "Tab") {
                const items = e.currentTarget.querySelectorAll<HTMLElement>("button,input")
                const first = items[0],
                  last = items[items.length - 1]
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault()
                  last?.focus()
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault()
                  first?.focus()
                }
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Replace place"
          >
            <h2>Find a new favorite</h2>
            <label>
              Search your library
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setReplace(null)
                }}
              />
            </label>
            <div className="list">
              {allPlaces
                .filter(
                  (p) =>
                    !draft.properties.some((x) => x.placeId === p.id) &&
                    p.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      change(
                        draft.properties.map((v, i) =>
                          i === replace
                            ? { placeId: p.id, name: p.name, category: p.category, label: p.name }
                            : v,
                        ),
                      )
                      setReplace(null)
                    }}
                  >
                    {p.name}
                    <span className="muted"> · {p.category}</span>
                  </button>
                ))}
            </div>
            <button onClick={() => setReplace(null)}>Cancel</button>
          </div>
        </div>
      )}
    </main>
  )
}
