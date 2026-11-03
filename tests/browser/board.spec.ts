import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
test("Marketplace board designer, exports, 3D and retention", async ({ page, baseURL }) => {
  test.setTimeout(180000)
  const headers = { origin: baseURL! }
  const account = {
    name: "Board tester",
    email: "board@example.com",
    password: "correct horse battery",
  }
  const setup = await (await page.request.get("/api/setup")).json()
  expect(
    (
      await page.request.post(`/api/auth/${setup.signupOpen ? "sign-up" : "sign-in"}/email`, {
        headers,
        data: account,
      })
    ).ok(),
  ).toBeTruthy()
  const upload = () =>
    page.request.post("/api/modules/upload", {
      headers,
      data: {
        filename: "places.board.zip",
        contentBase64: readFileSync("dist/places.board-0.1.0.zip").toString("base64"),
      },
    })
  const installed = await upload()
  expect(installed.ok(), await installed.text()).toBeTruthy()
  for (let i = 0; i < 24; i++) {
    const added = await page.request.post("/api/places/manual", {
      headers,
      data: {
        name: `Café ${i}`,
        category: "cafe",
        location: { lat: 50.85 + i * 0.001, lng: 4.35 },
        address: null,
      },
    })
    expect(added.ok()).toBeTruthy()
  }
  await page.goto("/")
  await page.getByRole("navigation", { name: "Main", exact: true }).waitFor({ state: "attached" })
  await page.evaluate(() => {
    history.pushState({}, "", "/m/places.board")
    dispatchEvent(new PopStateEvent("popstate"))
  })
  await page.getByRole("button", { name: "Create board", exact: true }).click()
  await page.getByRole("button", { name: "Auto-fill 22 places" }).click()
  await expect(page.getByLabel("Printed label")).toHaveCount(22)
  await page.getByLabel("Board title").fill("Bruxelles & friends")
  await page.getByRole("button", { name: "Save board", exact: true }).click()
  await expect(page.getByText("Board saved.", { exact: true })).toBeVisible()
  await page.screenshot({ path: "test-results/board-desktop.png", fullPage: false })
  for (const name of ["Print-shop PDF · 50 cm", "Home PDF · 6 × A4"]) {
    const download = page.waitForEvent("download")
    await page.getByRole("button", { name, exact: true }).click()
    const file = await download
    await file.saveAs(`test-results/${file.suggestedFilename()}`)
  }
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Explore in 3D" }).click()
    await expect(page.locator(".three canvas")).toBeVisible()
    await page.getByRole("button", { name: "Reset view" }).click()
    if (i === 0) await page.locator(".preview").screenshot({ path: "test-results/board-3d.png" })
    await page.getByRole("button", { name: "Flat board", exact: true }).click()
    await expect(page.locator(".three canvas")).toHaveCount(0)
  }
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: any[]) {
      if (type.startsWith("webgl")) return null
      return original.call(this, type, ...args)
    } as typeof original
  })
  await page.getByRole("button", { name: "Explore in 3D" }).click()
  await expect(page.getByText(/3D is unavailable/)).toBeVisible()
  await expect(page.locator(".preview svg")).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await page.screenshot({ path: "test-results/board-mobile.png", fullPage: false })
  expect((await upload()).ok()).toBeTruthy()
  await page.getByRole("button", { name: "← Collection", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Bruxelles & friends", exact: true }),
  ).toBeVisible()
  const saved = await (await page.request.get("/api/m/places.board/boards")).json()
  expect(saved).toHaveLength(1)
  await page.getByRole("button", { name: "Open board", exact: true }).click()
  const originalLabel = await page.getByLabel("Printed label").first().inputValue()
  await page
    .getByRole("button", { name: /Move .* down/ })
    .first()
    .click()
  await expect(page.getByLabel("Printed label").nth(1)).toHaveValue(originalLabel)
  await page.getByRole("button", { name: "Replace", exact: true }).first().click()
  await page.getByRole("dialog").locator(".list button").first().click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByLabel("Printed label").first().fill("WWWWWWWWWWWWWW")
  await expect(page.getByRole("button", { name: "Save board", exact: true })).toBeDisabled()
})
