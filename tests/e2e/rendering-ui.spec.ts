import { expect, test } from "@playwright/test";

async function waitForScene(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("render-canvas")).toBeVisible();
  await expect(page.getByTestId("fps-counter")).toContainText("FPS:");
}

test("renders demo scene and diagnostics HUD", async ({ page }, testInfo) => {
  await waitForScene(page);

  await expect(page.getByTestId("camera-zoom-value")).toContainText("Zoom:");
  await expect(page.getByTestId("debug-picked-tile")).toContainText("HoverTile:");
  await expect(page.getByTestId("debug-picked-entity")).toContainText("SelectedEntity:");

  await page.screenshot({
    path: `artifacts/playwright_${testInfo.project.name}_scene.png`,
    fullPage: true,
  });
});

test("updates hover/selection states on canvas interaction", async ({ page }, testInfo) => {
  await waitForScene(page);

  const canvas = page.getByTestId("render-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  const probePoints = [
    [0.5, 0.45],
    [0.55, 0.5],
    [0.45, 0.52],
    [0.6, 0.4],
    [0.4, 0.6],
  ];

  let hoverChanged = false;
  for (const [rx, ry] of probePoints) {
    await page.mouse.move(box.x + box.width * rx, box.y + box.height * ry);
    const hoverText = (await page.getByTestId("debug-picked-tile").textContent()) ?? "";
    if (!hoverText.includes("HoverTile: -")) {
      hoverChanged = true;
      break;
    }
  }
  expect(hoverChanged).toBeTruthy();

  let clickChanged = false;
  for (const [rx, ry] of probePoints) {
    await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);
    const pickText = (await page.getByTestId("debug-last-pick").textContent()) ?? "";
    if (!pickText.includes("PickEvent: click:none")) {
      clickChanged = true;
      break;
    }
  }
  expect(clickChanged).toBeTruthy();

  await page.screenshot({
    path: `artifacts/playwright_${testInfo.project.name}_picking.png`,
    fullPage: true,
  });
});

test("supports overlay toggles and keeps app responsive", async ({ page }, testInfo) => {
  await waitForScene(page);

  const pathToggle = page.getByTestId("overlay-toggle-path");
  const losToggle = page.getByTestId("overlay-toggle-los");

  await expect(pathToggle).toContainText("Path: on");
  await expect(losToggle).toContainText("LOS: on");

  await pathToggle.click();
  await losToggle.click();

  await expect(pathToggle).toContainText("Path: off");
  await expect(losToggle).toContainText("LOS: off");
  await expect(page.getByTestId("fps-counter")).toContainText("FPS:");

  await page.screenshot({
    path: `artifacts/playwright_${testInfo.project.name}_toggles.png`,
    fullPage: true,
  });
});
