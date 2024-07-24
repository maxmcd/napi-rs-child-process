import { describe, it, expect } from "vitest";
import { ChildProcess, spawn } from "./index";
import { Readable } from "node:stream";

const exitPromise = async (cp: ChildProcess) =>
  await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => cp.on("exit", (code, signal) => resolve({ code, signal })));

const stdioPromise = async (stdio: Readable) => {
  return new Promise<string>((resolve) => {
    let out: Buffer[] = [];
    stdio
      .on("data", (data) => out.push(data))
      .on("close", () => resolve(Buffer.concat(out).toString()));
  });
};

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
