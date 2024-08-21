import { describe, it, expect } from "vitest";
import { execFile } from "./exec.js";
import { ChildProcess, spawn } from "./index.js";

describe("implement child_process.spawn", { timeout: 5000 }, () => {
  it("can run a command", async () => {
    expect(await execFile("echo", ["hello"])).toMatchObject({
      err: null,
      stderr: "",
      stdout: "hello\n",
    });
  });
  it("can pass env vars", async () => {
    expect(
      await execFile("bash", ["-c", "echo $HI"], {
        env: { HI: "ho", PATH: process.env.PATH },
      })
    ).toMatchObject({
      err: null,
      stderr: "",
      stdout: "ho\n",
    });
  });

  it("on spawn", async () => {
    const cp = await new Promise<ChildProcess>((resolve) => {
      const cp = spawn("echo", ["hello"]);
      cp.on("spawn", () => {
        resolve(cp);
      });
    });
    expect(cp.pid).toBeTypeOf("number");
    cp.kill();
    await new Promise((resolve) => cp.on("close", resolve));
    expect(cp.exitCode).toBe(null);
    expect(cp.signalCode).toBe("SIGTERM");
  });

  it.each([
    ["kill $$", [null, "SIGTERM"]],
    ["kill -9 $$", [null, "SIGKILL"]],
    ["exit 1", [1, null]],
    ["exit 143", [143, null]],
  ])("exit and signal '%s'", async (script, exitInfo) => {
    try {
      await execFile("bash", ["-c", script]);
    } catch (err: any) {
      expect([err?.code, err?.signal]).toEqual(exitInfo);
    }
  });
});
