import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createModule } from "../src/server/index.ts"
import { sample, designError, slots, groupSizes, wrapLabel } from "../src/shared/board.ts"
import { boardSvg } from "../src/shared/artwork.ts"
const places = Array.from({ length: 30 }, (_, i) => ({
  id: `place-${i}`,
  name: `Café ${i}`,
  category: "cafe",
}))
const design = () => ({
  templateVersion: 1 as const,
  title: "Bruxelles & friends",
  properties: sample(places, () => 0.5),
})
test("pool thresholds, unique sampling, and label checks", () => {
  for (const n of [0, 21]) assert.throws(() => sample(places.slice(0, n)), /more places/)
  for (const n of [22, 30]) {
    const selected = sample(places.slice(0, n))
    assert.equal(selected.length, 22)
    assert.equal(new Set(selected.map((p) => p.placeId)).size, 22)
  }
  assert.throws(() => sample(Array(22).fill(places[0])), /more places/)
  assert.equal(designError(design()), null)
  const d = design()
  d.properties[1] = d.properties[0]
  assert.match(designError(d)!, /unique/)
  assert.ok(wrapLabel("WWWWWWWWWWWWWW").length > 4)
  assert.ok(wrapLabel("Café Étoile").length <= 4)
})
test("layout has 40 spaces, 22 properties, correct groups and escaped text", () => {
  assert.equal(slots.length, 22)
  assert.equal(new Set(slots).size, 22)
  assert.equal(
    groupSizes.reduce((a, b) => a + b),
    22,
  )
  const svg = boardSvg(design())
  assert.equal((svg.match(/translate\(/g) ?? []).length, 80)
  assert.ok(svg.includes("Bruxelles &amp;"))
  assert.ok(svg.includes("Missed"))
  assert.ok(!svg.includes("undefined"))
})
test("interactive preview identifies only places and highlights invalid labels without affecting print artwork", () => {
  const d = design()
  d.properties[0].name = 'A "quoted" <place>'
  d.properties[0].label = "WWWWWWWWWWWWWW"
  d.properties[10].label = " "
  const preview = boardSvg(d, true)
  assert.equal((preview.match(/data-property-index=/g) ?? []).length, 22)
  assert.equal((preview.match(/aria-invalid="true"/g) ?? []).length, 2)
  assert.ok(preview.includes("A &quot;quoted&quot; &lt;place&gt;"))
  assert.ok(preview.includes('fill="#fee2e2"'))
  assert.ok(!boardSvg(d).includes("data-property-index"))
  assert.ok(!boardSvg(d).includes("#fee2e2"))
})
test("authenticated persistence, snapshots, owner isolation and revisions", async () => {
  const dir = mkdtempSync(join(tmpdir(), "placard-board-"))
  let available = places
  const app = createModule().createHttpApp
  const call = async (path: string, method = "GET", body?: unknown, ownerId = "alice") =>
    app(
      new Request("http://local/" + path, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      {
        ownerId,
        dataDir: dir,
        pathSuffix: path,
        hostFetch: async (_path, init) => {
          const filter = JSON.parse((init?.body as string) ?? "{}")
          return Response.json(
            available
              .filter((p) => !filter.category || p.category === filter.category)
              .map((place) => ({ place })),
          )
        },
      },
    )
  try {
    assert.equal((await call("boards", "GET", undefined, "")).status, 401)
    assert.equal((await call("search", "POST", { category: "park" })).status, 200)
    assert.deepEqual(await (await call("search", "POST", { category: "park" })).json(), [])
    let res = await call("boards", "POST", design())
    assert.equal(res.status, 201)
    const b = await res.json()
    assert.equal(b.revision, 1)
    assert.equal((await call(`boards/${b.id}`, "GET", undefined, "bob")).status, 404)
    assert.equal((await call(`boards/${b.id}`, "DELETE", undefined, "bob")).status, 404)
    assert.equal((await call(`boards/${b.id}`, "PUT", b, "bob")).status, 404)
    available = []
    res = await call(`boards/${b.id}`, "PUT", { ...b, title: "Snapshot" })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).revision, 2)
    assert.equal((await call(`boards/${b.id}`, "PUT", b)).status, 409)
    assert.equal((await call("boards", "POST", design())).status, 403)
    assert.equal((await call("boards", "POST", { ...b, duplicateOf: b.id })).status, 201)
    const changed = {
      ...b,
      revision: 2,
      properties: b.properties.map((p: unknown, i: number) =>
        i ? p : { placeId: "hidden", name: "Hidden", category: "cafe", label: "Hidden" },
      ),
    }
    assert.equal((await call(`boards/${b.id}`, "PUT", changed)).status, 403)
    assert.equal((await call("boards")).status, 200)
    assert.equal((await (await call(`boards/${b.id}`)).json()).title, "Snapshot")
    assert.equal((await call(`boards/${b.id}`, "DELETE")).status, 200)
    assert.equal((await call(`boards/${b.id}`)).status, 404)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
