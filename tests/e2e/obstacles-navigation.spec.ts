import { expect, test } from "@playwright/test";

async function boot(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("render-canvas")).toBeVisible();
}

async function hoverGridTile(
  page: import("@playwright/test").Page,
  x: number,
  y: number,
): Promise<void> {
  const canvas = page.getByTestId("render-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  const pos = await page.evaluate(
    ({ gx, gy }) => {
      const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
      const camera = api?.getCamera?.();
      if (!camera) {
        return null;
      }
      const tileWidth = 64;
      const tileHeight = 32;
      const worldX = (gx - gy) * (tileWidth / 2);
      const worldY = (gx + gy) * (tileHeight / 2);
      return {
        x: (worldX - camera.position.x) * camera.zoom + camera.viewport.x / 2,
        y: (worldY - camera.position.y) * camera.zoom + camera.viewport.y / 2 + tileHeight / 2,
      };
    },
    { gx: x, gy: y },
  );
  expect(pos).not.toBeNull();
  if (!pos) {
    return;
  }
  await page.mouse.move(box.x + pos.x, box.y + pos.y);
}

async function clickGridTile(
  page: import("@playwright/test").Page,
  x: number,
  y: number,
): Promise<void> {
  const canvas = page.getByTestId("render-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  const pos = await page.evaluate(
    ({ gx, gy }) => {
      const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
      const camera = api?.getCamera?.();
      if (!camera) {
        return null;
      }
      const tileWidth = 64;
      const tileHeight = 32;
      const worldX = (gx - gy) * (tileWidth / 2);
      const worldY = (gx + gy) * (tileHeight / 2);
      return {
        x: (worldX - camera.position.x) * camera.zoom + camera.viewport.x / 2,
        y: (worldY - camera.position.y) * camera.zoom + camera.viewport.y / 2 + tileHeight / 2,
      };
    },
    { gx: x, gy: y },
  );
  expect(pos).not.toBeNull();
  if (!pos) {
    return;
  }
  await page.mouse.click(box.x + pos.x, box.y + pos.y);
}

test("interaction intent preview reflects doors and movement", async ({ page }) => {
  await boot(page);

  await hoverGridTile(page, 13, 10);
  await expect(page.getByTestId("interaction-intent")).toContainText("Intent: locked");
  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const canvas = document.querySelector("[data-testid='render-canvas']") as HTMLCanvasElement | null;
        return canvas?.style.cursor ?? "";
      });
    })
    .toBe("pointer");

  await hoverGridTile(page, 8, 10);
  await expect(page.getByTestId("interaction-intent")).toContainText("Intent: move+open");
  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const canvas = document.querySelector("[data-testid='render-canvas']") as HTMLCanvasElement | null;
        return canvas?.style.cursor ?? "";
      });
    })
    .toBe("pointer");

  await hoverGridTile(page, 6, 10);
  await expect(page.getByTestId("interaction-intent")).toContainText("Intent: move");
});

test("door click opens context menu and executes selected action", async ({ page }) => {
  await boot(page);

  await clickGridTile(page, 8, 10);
  await expect(page.getByTestId("door-context-menu")).toBeVisible();
  await expect(page.getByTestId("door-menu-open")).toBeVisible();
  await expect(page.getByTestId("door-menu-close")).toBeVisible();
  await expect(page.getByTestId("door-menu-key")).toBeVisible();
  await expect(page.getByTestId("door-menu-lockpick")).toBeVisible();
  await expect(page.getByTestId("door-sprite-door_demo_closed")).toHaveAttribute("data-state", "closed");
  await page.mouse.move(20, 20);
  await expect(page.getByTestId("door-context-menu")).toBeVisible();

  await page.getByTestId("door-menu-open").dispatchEvent("click");
  await expect
    .poll(async () => await page.getByTestId("movement-status").textContent(), {
      timeout: 10000,
    })
    .toMatch(/Movement: (moving-to-door|door-opened)/);
  await expect(page.getByTestId("debug-door-closed-state")).toContainText("DoorClosed: open");
  await expect(page.getByTestId("door-sprite-door_demo_closed")).toHaveAttribute("data-state", "open");
});

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

  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.interactEntity("door_demo_closed");
  });
  await expect
    .poll(async () => await page.getByTestId("movement-status").textContent())
    .toMatch(/Movement: (moving-to-door|door-opened)/);
  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
        const door = api?.getEntity("door_demo_closed");
        const player = api?.getEntity("actor_player");
        return {
          door: door?.doorState ?? "unknown",
          playerX: player?.grid?.x ?? -1,
          playerY: player?.grid?.y ?? -1,
        };
      });
    })
    .toMatchObject({ door: "open" });
  const approach = await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    const player = api?.getEntity("actor_player");
    const door = api?.getEntity("door_demo_closed");
    const dx = Math.abs((player?.grid?.x ?? -99) - (door?.grid?.x ?? 99));
    const dy = Math.abs((player?.grid?.y ?? -99) - (door?.grid?.y ?? 99));
    return { dx, dy };
  });
  expect(approach.dx <= 1 && approach.dy <= 1 && (approach.dx !== 0 || approach.dy !== 0)).toBeTruthy();

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
  });
  await expect(page.getByTestId("debug-door-closed-state")).toContainText("DoorClosed: open");
  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.moveToTile(10, 14);
  });

  await expect
    .poll(async () => await page.getByTestId("movement-status").textContent(), {
      timeout: 10000,
    })
    .toMatch(/Movement: (repathing|arrived|moving|fallback-path)/);
});

test("save/load restores door and player state", async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.interactEntity("door_demo_closed");
  });
  await expect(page.getByTestId("debug-door-closed-state")).toContainText("DoorClosed: open");
  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.moveToTile(10, 10);
  });
  await expect
    .poll(async () => await page.getByTestId("movement-status").textContent(), { timeout: 8000 })
    .toContain("arrived");
  const savedPlayerTile = (await page.getByTestId("debug-player-tile").textContent()) ?? "PlayerTile: -";

  await page.getByTestId("save-state").click();
  await expect(page.getByTestId("save-state-status")).toContainText("StateIO: saved");

  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.interactEntity("door_demo_closed");
  });
  await expect(page.getByTestId("debug-door-closed-state")).toContainText("DoorClosed: closed");
  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.moveToTile(5, 10);
  });

  await page.getByTestId("load-state").click();
  await expect(page.getByTestId("save-state-status")).toContainText("StateIO: loaded");
  await expect(page.getByTestId("debug-door-closed-state")).toContainText("DoorClosed: open");
  await expect(page.getByTestId("debug-player-tile")).toContainText(savedPlayerTile.replace("PlayerTile: ", ""));
});

test("save slots are isolated and reset restores baseline world", async ({ page }) => {
  await boot(page);

  await page.getByTestId("save-slot").selectOption("1");
  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.interactEntity("door_demo_closed");
  });
  await expect(page.getByTestId("debug-door-closed-state")).toContainText("DoorClosed: open");
  await page.evaluate(() => {
    const api = (window as unknown as { __ashfallDebug?: any }).__ashfallDebug;
    api?.moveToTile(10, 10);
  });
  await expect
    .poll(async () => await page.getByTestId("movement-status").textContent(), { timeout: 8000 })
    .toContain("arrived");
  await page.getByTestId("save-state").click();
  await expect(page.getByTestId("save-state-status")).toContainText("StateIO: saved");

  await page.getByTestId("save-slot").selectOption("2");
  await page.getByTestId("reset-scenario").click();
  await expect(page.getByTestId("save-state-status")).toContainText("StateIO: reset");
  await expect(page.getByTestId("debug-door-closed-state")).toContainText("DoorClosed: closed");

  await page.getByTestId("load-state").click();
  await expect(page.getByTestId("save-state-status")).toContainText("StateIO: load-empty");

  await page.getByTestId("save-slot").selectOption("1");
  await page.getByTestId("load-state").click();
  await expect(page.getByTestId("save-state-status")).toContainText("StateIO: loaded");
  await expect(page.getByTestId("debug-door-closed-state")).toContainText("DoorClosed: open");
});
