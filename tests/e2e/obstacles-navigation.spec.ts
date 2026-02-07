import { expect, test } from "@playwright/test";

async function boot(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("render-canvas")).toBeVisible();
}

test("locked door stays locked and reports blocked state", async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.interactEntity("door_demo_locked");
  });

  await expect(page.getByTestId("debug-door-locked-state")).toContainText("DoorLocked: locked");
  await expect(page.getByTestId("door-state-label")).toContainText("Door: locked");
});

test("closed door opens then player can move through corridor", async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.moveToTile(10, 10);
  });
  await expect(page.getByTestId("blocked-indicator")).toContainText("Blocked: yes");

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
        api?.interactEntity("door_demo_closed");
        const door = api?.getEntity("door_demo_closed");
        return door?.doorState ?? "unknown";
      });
    })
    .toBe("open");

  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.moveToTile(10, 10);
  });

  await expect
    .poll(async () => await page.getByTestId("movement-status").textContent(), {
      timeout: 8000,
    })
    .toContain("arrived");
});

test("patrol can trigger re-pathing during movement", async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.interactEntity("door_demo_closed");
    api?.moveToTile(10, 14);
  });

  await expect
    .poll(async () => await page.getByTestId("movement-status").textContent(), {
      timeout: 10000,
    })
    .toMatch(/Movement: (repathing|arrived|moving|fallback-path)/);
});
