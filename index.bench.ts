import { describe, bench, expect } from "vitest";
import fs from "fs/promises";
import { execFile } from "./testutil.test.js";

let fi = await fs.stat("node_modules/typescript/lib/typescript.js");
describe("spawn", () => {
  bench(
    "echo hello",
    async () => {
      expect(await execFile("echo", ["hello"])).toMatchObject({
        err: null,
        stderr: "",
        stdout: "hello\n",
      });
    },
    { warmupIterations: 10 }
  );
  bench(
    "cat node_modules/typescript/lib/typescript.js",
    async () => {
      let { err, stdout } = await execFile("cat", [
        "node_modules/typescript/lib/typescript.js",
      ]);
      expect(err).toBe(null);
      expect(stdout.length).toBe(fi.size);
    },
    { warmupIterations: 10, iterations: 300 }
  );
});
