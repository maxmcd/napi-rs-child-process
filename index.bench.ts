import { describe, bench, expect } from "vitest";
import { spawn } from "./index.ts";
import { exitPromise, stdioPromise } from "./testutil";
import fs from "fs/promises";

let fi = await fs.stat("node_modules/typescript/lib/typescript.js");
describe("spawn", () => {
  bench(
    "echo hello",
    async () => {
      let cp = spawn("echo", ["hello"]);
      let [{ code, signal }, stdout] = await Promise.all([
        exitPromise(cp),
        stdioPromise(cp.stdout),
      ]);
      expect(code).toBe(0);
      expect(signal).toBe(null);
      expect(stdout).toBe("hello\n");
    },
    { warmupIterations: 10 }
  );
  bench(
    "cat node_modules/typescript/lib/typescript.js",
    async () => {
      let cp = spawn("cat", ["node_modules/typescript/lib/typescript.js"]);
      let [{ code, signal }, stdout] = await Promise.all([
        exitPromise(cp),
        stdioPromise(cp.stdout),
      ]);
      expect(code).toBe(0);
      expect(signal).toBe(null);
      expect(stdout.length).toBe(fi.size);
    },
    { warmupIterations: 10, iterations: 300 }
  );
});
