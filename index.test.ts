import { describe, it, expect } from "vitest";
import { execFile } from "./testutil.test.js";

describe("implement child_process.spawn", { timeout: 500 }, () => {
  it("can run a command", async () => {
    expect(await execFile("echo", ["hello"])).toMatchObject({
      err: null,
      stderr: "",
      stdout: "hello\n",
    });
  });
  it("can pass env vars", async () => {
    expect(
      await execFile("bash", ["-c", "echo $HI"], { env: { HI: "ho" } })
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
