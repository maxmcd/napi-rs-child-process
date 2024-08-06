import { SpawnOptions } from "node:child_process";
import { spawn } from "./index.js";

class ExecError extends Error {
  constructor(
    msg: string,
    public code: number | null,
    public signal: string | null,
    public cmd: string
  ) {
    super(msg);
  }
}

type execFileResult = Promise<{
  err: ExecError | null;
  stdout: string;
  stderr: string;
}>;
export async function execFile(
  command: string,
  options?: SpawnOptions
): execFileResult;
export async function execFile(
  command: string,
  args?: string[]
): execFileResult;
export async function execFile(
  command: string,
  args: string[],
  options: SpawnOptions
): execFileResult;
export async function execFile(
  command: string,
  args?: string[] | SpawnOptions,
  options?: SpawnOptions
): execFileResult {
  if (!Array.isArray(args)) {
    options = args;
    args = [];
  }

  let cp = spawn(command, args, options as SpawnOptions);
  let cmd = `${command} ${args.join(" ")}`;
  return await new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    cp.stdout.on("data", (data) => (stdout += data));
    cp.stderr.on("data", (data) => (stderr += data));
    cp.on("error", (err) =>
      resolve({
        err: new ExecError(err.message, null, null, cmd),
        stdout,
        stderr,
      })
    );
    cp.on("close", (code, signal) => {
      if (code === 0) return resolve({ err: null, stdout, stderr });
      resolve({
        err: new ExecError(`Command failed: ${command}`, code, signal, cmd),
        stdout,
        stderr,
      });
    });
  });
}
