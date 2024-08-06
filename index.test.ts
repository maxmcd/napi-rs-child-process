import { describe, it, expect } from "vitest";
import { execFile } from "./exec.js";

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

  it.each([
    ["kill $$", [null, "SIGTERM"]],
    ["kill -9 $$", [null, "SIGKILL"]],
    ["exit 1", [1, null]],
    ["exit 143", [143, null]],
  ])("exit and signal '%s'", async (script, exitInfo) => {
    let { err } = await execFile("bash", ["-c", script]);
    expect([err?.code, err?.signal]).toEqual(exitInfo);
  });
});
