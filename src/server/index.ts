import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { randomUUID } from "node:crypto"
import { designError, type Board, type Design, type Place } from "../shared/board.ts"
type Context = {
  ownerId: string
  dataDir: string
  pathSuffix: string
  hostFetch: (path: string, init?: RequestInit) => Promise<Response>
}
class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
function database<T>(dir: string, fn: (db: DatabaseSync) => T): T {
  mkdirSync(dir, { recursive: true })
  const db = new DatabaseSync(join(dir, "boards.sqlite"))
  try {
    db.exec(
      "PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, owner TEXT NOT NULL, body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS board_owner ON boards(owner);",
    )
    return fn(db)
  } finally {
    db.close()
  }
}
function read(db: DatabaseSync, id: string, owner: string): Board {
  const row = db.prepare("SELECT body FROM boards WHERE id=? AND owner=?").get(id, owner) as
    | { body: string }
    | undefined
  if (!row) throw new HttpError(404, "Board not found")
  return JSON.parse(row.body)
}
async function search(ctx: Context, filter: unknown): Promise<Place[]> {
  const response = await ctx.hostFetch("/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(filter),
  })
  if (!response.ok) throw new HttpError(response.status, "Could not load places")
  const hits = (await response.json()) as { place: Place }[]
  return hits.map((h) => h.place)
}
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } })
export function createModule() {
  return {
    createHttpApp: async (request: Request, ctx: Context): Promise<Response> => {
      try {
        if (!ctx.ownerId) throw new HttpError(401, "Sign in to use boards")
        const path = ctx.pathSuffix.replace(/^\/+|\/+$/g, "")
        if (path === "lists" && request.method === "GET") {
          const response = await ctx.hostFetch("/api/lists")
          if (!response.ok) throw new HttpError(response.status, "Could not load lists")
          return json(await response.json())
        }
        if (path === "search" && request.method === "POST")
          return json(await search(ctx, await request.json()))
        if (path === "boards" && request.method === "GET")
          return json(
            database(ctx.dataDir, (db) =>
              db
                .prepare("SELECT body FROM boards WHERE owner=? ORDER BY rowid DESC")
                .all(ctx.ownerId)
                .map((row) => JSON.parse(row.body as string)),
            ),
          )
        const match = /^boards\/([a-f0-9-]+)$/.exec(path)
        const id = match?.[1]
        if (id && request.method === "GET")
          return json(database(ctx.dataDir, (db) => read(db, id, ctx.ownerId)))
        if (id && request.method === "DELETE") {
          database(ctx.dataDir, (db) => {
            read(db, id, ctx.ownerId)
            db.prepare("DELETE FROM boards WHERE id=? AND owner=?").run(id, ctx.ownerId)
          })
          return json({ ok: true })
        }
        if ((path === "boards" && request.method === "POST") || (id && request.method === "PUT")) {
          const raw = await request.text()
          if (raw.length > 50000) throw new HttpError(413, "Board is too large")
          const input = JSON.parse(raw) as Design & { revision?: number; duplicateOf?: string }
          const error = designError(input)
          if (error) throw new HttpError(400, error)
          const previous = id
            ? database(ctx.dataDir, (db) => read(db, id, ctx.ownerId))
            : input.duplicateOf
              ? database(ctx.dataDir, (db) => read(db, input.duplicateOf!, ctx.ownerId))
              : undefined
          const accessible = new Map((await search(ctx, {})).map((p) => [p.id, p]))
          const properties = input.properties.map((p) => {
            const captured = previous?.properties.find((old) => old.placeId === p.placeId)
            const source = accessible.get(p.placeId)
            if (!captured && !source)
              throw new HttpError(403, "A selected place is no longer accessible")
            return {
              placeId: p.placeId,
              name: captured?.name ?? source!.name,
              category: captured?.category ?? source!.category,
              label: p.label.trim(),
            }
          })
          const board: Board = {
            id: id ?? randomUUID(),
            templateVersion: 1,
            title: input.title.trim(),
            properties,
            revision: (id ? previous!.revision : 0) + 1,
            updatedAt: new Date().toISOString(),
          }
          database(ctx.dataDir, (db) => {
            db.exec("BEGIN IMMEDIATE")
            try {
              if (id) {
                const current = read(db, id, ctx.ownerId)
                if (current.revision !== input.revision)
                  throw new HttpError(
                    409,
                    "This board changed on another device. Reopen it before saving.",
                  )
                db.prepare("UPDATE boards SET body=? WHERE id=? AND owner=?").run(
                  JSON.stringify(board),
                  id,
                  ctx.ownerId,
                )
              } else
                db.prepare("INSERT INTO boards VALUES (?,?,?)").run(
                  board.id,
                  ctx.ownerId,
                  JSON.stringify(board),
                )
              db.exec("COMMIT")
            } catch (e) {
              db.exec("ROLLBACK")
              throw e
            }
          })
          return json(board, id ? 200 : 201)
        }
        throw new HttpError(404, "Not found")
      } catch (e) {
        return json(
          {
            error:
              e instanceof HttpError || e instanceof SyntaxError
                ? e.message
                : "Board operation failed",
          },
          e instanceof HttpError
            ? e.status
            : e instanceof SyntaxError || e instanceof TypeError
              ? 400
              : 500,
        )
      }
    },
  }
}
