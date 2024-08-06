import os from "node:os";
import { SpawnOptions } from "child_process";
import { spawn as op_spawn } from "./lib.js";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { lookPath } from "./lookPath.js";

const signalNumbersToNames: { [key: number]: NodeJS.Signals } = Object.entries(
  os.constants.signals
).reduce((acc: { [key: number]: NodeJS.Signals }, [name, number]) => {
  acc[number] = name as NodeJS.Signals;
  return acc;
}, {});

export function spawn(command: string, options?: SpawnOptions): ChildProcess;
export function spawn(command: string, args?: string[]): ChildProcess;
export function spawn(
  command: string,
  args: string[],
  options: SpawnOptions
): ChildProcess;
export function spawn(
  command: string,
  args?: string[] | SpawnOptions,
  options?: SpawnOptions
) {
  return Array.isArray(args)
    ? new ChildProcess(command, args, options)
    : new ChildProcess(command, [], args);
}

class StdioReadable extends Readable {
  _read() {}
}

export class ChildProcess extends EventEmitter {
  #pid: number | undefined;
  #killed: boolean = false;
  #exitCode: number | null;
  #signalCode: NodeJS.Signals | null;
  #spawnargs: string[];
  stdin: null;
  stdout: Readable;
  stderr: Readable;
  constructor(command: string, args?: string[], options: SpawnOptions = {}) {
    super();
    if (options.detached !== undefined)
      throw new Error("detached not supported");
    this.#spawnargs = args || [];
    this.stdout = new StdioReadable();
    this.stderr = new StdioReadable();
    this.#exitCode = null;
    this.#signalCode = null;
    this.stdin = null;
    if (options.cwd instanceof URL) {
      throw new Error("passing a URL for cwd is not supported");
    }

    let env = options.env || process.env;
    lookPath(command, env.PATH)
      .then((cmd) => {
        op_spawn(
          cmd,
          this.#spawnargs,
          {
            cwd: options.cwd as string,
            env: options.env || process.env,
            argv0: options.argv0,
          },
          this.#exitCallback,
          this.#stdoutCallback,
          this.#stderrCallback
        )
          .then((pid: number) => (this.#pid = pid))
          .catch((err: any) => this.emit("error", err));
      })
      .catch((err) => this.emit("error", err));
  }
  #exitCallback = (_err: Error | null, code: number, signal: number) => {
    this.#exitCode = signal === 0 ? code : null;
    this.#signalCode =
      signal === 0 ? null : signalNumbersToNames[signal] || null;
    this.emit("exit", this.#exitCode, this.#signalCode);
    this.#maybeEmitClose();
  };
  kill(signal?: NodeJS.Signals | number): boolean {
    if (!this.#pid) return false;
    if (this.#killed) {
      return false;
    }
    this.#killed = true;
    return process.kill(this.#pid, signal);
  }
  #stderrCallback = (err: Error | null, chunk: Buffer | undefined | null) => {
    if (err) this.emit("error", err);
    if (chunk) {
      this.stderr.push(chunk);
    } else {
      this.stderr.destroy();
      this.#maybeEmitClose();
    }
  };
  #stdoutCallback = (err: Error | null, chunk: Buffer | undefined | null) => {
    if (err) this.emit("error", err);
    if (chunk) {
      this.stdout.push(chunk);
    } else {
      this.stdout.destroy();
      this.#maybeEmitClose();
    }
  };
  #maybeEmitClose = () => {
    if (
      (this.stdout.closed && this.stderr.closed && this.#exitCode !== null) ||
      this.#signalCode !== null
    ) {
      this.emit("close", this.#exitCode, this.#signalCode);
    }
  };
  addListener(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this;
  addListener(event: "error", listener: (err: Error) => void): this;
  addListener(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this;
  addListener(event: "spawn", listener: () => void): this;
  addListener(event: string, listener: (...args: any[]) => void): this {
    super.addListener(event, listener);
    return this;
  }
  emit(
    event: "close",
    code: number | null,
    signal: NodeJS.Signals | null
  ): boolean;
  emit(event: "error", err: Error): boolean;
  emit(
    event: "exit",
    code: number | null,
    signal: NodeJS.Signals | null
  ): boolean;
  emit(event: "spawn", listener: () => void): boolean;
  emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }
  on(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this;
  on(event: "disconnect", listener: () => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this;
  on(event: "spawn", listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
  once(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this;
  once(event: "error", listener: (err: Error) => void): this;
  once(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this;
  once(event: "spawn", listener: () => void): this;
  once(event: string, listener: (...args: any[]) => void): this {
    super.once(event, listener);
    return this;
  }
  prependListener(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this;
  prependListener(event: "disconnect", listener: () => void): this;
  prependListener(event: "error", listener: (err: Error) => void): this;
  prependListener(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this;
  prependListener(event: "spawn", listener: () => void): this;
  prependListener(event: string, listener: (...args: any[]) => void): this {
    super.prependListener(event, listener);
    return this;
  }
  prependOnceListener(
    event: "close",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this;
  prependOnceListener(event: "error", listener: (err: Error) => void): this;
  prependOnceListener(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this;
  prependOnceListener(event: "spawn", listener: () => void): this;
  prependOnceListener(event: string, listener: (...args: any[]) => void): this {
    super.prependOnceListener(event, listener);
    return this;
  }
}
