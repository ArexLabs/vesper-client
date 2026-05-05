import { describe, expect, it } from "vitest";
import { diffLauncherConfig, mergeLauncherConfig } from "@/lib/config";
import { defaultGlobalConfig } from "@/lib/dummy";

describe("config helpers", () => {
  it("merges and creates diff-only overrides", () => {
    const next = mergeLauncherConfig(defaultGlobalConfig, {
      memoryMbMax: 6144,
      window: { fullscreen: true },
      rendererFlags: ["--shader-cache-prewarm"],
    });
    const diff = diffLauncherConfig(defaultGlobalConfig, next);
    expect(diff.memoryMbMax).toBe(6144);
    expect(diff.window?.fullscreen).toBe(true);
    expect(diff.rendererFlags).toEqual(["--shader-cache-prewarm"]);
    expect(diff.memoryMbMin).toBeUndefined();
  });
});
