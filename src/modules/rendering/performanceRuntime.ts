import type { PerformanceBudgets, RenderDiagnostics, RenderQualityTier } from "./types";

type FrameSample = {
  fps: number;
  frameMs: number;
  drawCalls: number;
  activeVfx: number;
};

const DEFAULT_BUDGETS: PerformanceBudgets = {
  minFps: 45,
  maxFrameMs: 22,
  maxDrawCalls: 1800,
  maxActiveVfx: 48,
};

export class PerformanceRuntime {
  private samples: FrameSample[] = [];
  private qualityTier: RenderQualityTier = "high";
  private degradeStreak = 0;
  private recoverStreak = 0;

  constructor(private readonly budgets: PerformanceBudgets = DEFAULT_BUDGETS) {}

  public recordFrame(sample: FrameSample): void {
    this.samples.push(sample);
    if (this.samples.length > 60) {
      this.samples.shift();
    }

    const isOverBudget = this.isOverBudget(sample);
    if (isOverBudget) {
      this.degradeStreak += 1;
      this.recoverStreak = 0;
      if (this.degradeStreak >= 10) {
        this.degradeTier();
        this.degradeStreak = 0;
      }
      return;
    }

    this.recoverStreak += 1;
    this.degradeStreak = 0;
    if (this.recoverStreak >= 120) {
      this.upgradeTier();
      this.recoverStreak = 0;
    }
  }

  public createDiagnostics(base: Omit<RenderDiagnostics, "avgFps" | "avgFrameMs" | "qualityTier" | "budgetState">): RenderDiagnostics {
    const avgFps =
      this.samples.length === 0
        ? base.fps
        : this.samples.reduce((acc, s) => acc + s.fps, 0) / this.samples.length;
    const avgFrameMs =
      this.samples.length === 0
        ? base.frameMs
        : this.samples.reduce((acc, s) => acc + s.frameMs, 0) / this.samples.length;

    const budgetState =
      avgFps < this.budgets.minFps ||
      avgFrameMs > this.budgets.maxFrameMs ||
      base.drawCalls > this.budgets.maxDrawCalls ||
      base.activeVfx > this.budgets.maxActiveVfx
        ? "degraded"
        : "within_budget";

    return {
      ...base,
      avgFps,
      avgFrameMs,
      qualityTier: this.qualityTier,
      budgetState,
    };
  }

  public getQualityTier(): RenderQualityTier {
    return this.qualityTier;
  }

  public reset(): void {
    this.samples = [];
    this.qualityTier = "high";
    this.degradeStreak = 0;
    this.recoverStreak = 0;
  }

  private isOverBudget(sample: FrameSample): boolean {
    return (
      sample.fps < this.budgets.minFps ||
      sample.frameMs > this.budgets.maxFrameMs ||
      sample.drawCalls > this.budgets.maxDrawCalls ||
      sample.activeVfx > this.budgets.maxActiveVfx
    );
  }

  private degradeTier(): void {
    if (this.qualityTier === "high") {
      this.qualityTier = "medium";
      return;
    }
    if (this.qualityTier === "medium") {
      this.qualityTier = "low";
    }
  }

  private upgradeTier(): void {
    if (this.qualityTier === "low") {
      this.qualityTier = "medium";
      return;
    }
    if (this.qualityTier === "medium") {
      this.qualityTier = "high";
    }
  }
}

