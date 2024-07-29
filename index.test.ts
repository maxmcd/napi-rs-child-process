import { describe, it, expect } from "vitest";
import { spawn } from "./index";
import { exitPromise, stdioPromise } from "./testutil";

describe("implement child_process.spawn", { timeout: 500 }, () => {
  it("can run a command", async () => {
    let cp = spawn("echo", ["hello"]);
    let [{ code, signal }, stdout] = await Promise.all([
      exitPromise(cp),
      stdioPromise(cp.stdout),
    ]);
    expect(code).toBe(0);
    expect(signal).toBe(null);
    expect(stdout).toBe("hello\n");
  });
  it("can env vars", async () => {
    let cp = spawn("bash", ["-c", "echo $HI"], { env: { HI: "ho" } });
    let [{ code, signal }, stdout] = await Promise.all([
      exitPromise(cp),
      stdioPromise(cp.stdout),
    ]);
    expect(code).toBe(0);
    expect(signal).toBe(null);
    expect(stdout).toBe("ho\n");
  });
  it.each([
    ["kill $$", [null, "SIGTERM"]],
    ["kill -9 $$", [null, "SIGKILL"]],
    ["exit 1", [1, null]],
    ["exit 143", [143, null]],
  ])("exit and signal '%s'", async (script, exitInfo) => {
    let cp = spawn("bash", ["-c", script]);
    const [code, signal] = exitInfo;
    expect(await exitPromise(cp)).toMatchObject({ code, signal });
  });
});
