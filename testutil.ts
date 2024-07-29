import { ChildProcess } from "./index";
import { Readable } from "node:stream";

export const exitPromise = async (cp: ChildProcess) =>
  await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => cp.on("exit", (code, signal) => resolve({ code, signal })));

export const stdioPromise = async (stdio: Readable) => {
  return new Promise<string>((resolve) => {
    let out: Buffer[] = [];
    stdio
      .on("data", (data) => out.push(data))
      .on("close", () => resolve(Buffer.concat(out).toString()));
  });
};
