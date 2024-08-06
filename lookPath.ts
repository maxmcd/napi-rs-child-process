import { promises as fs } from "node:fs";
import * as nodePath from "node:path";

class ExecError extends Error {
  constructor(public file: string, message: string) {
    if (file) message = `${file}: ${message}`;
    super(message);
    this.name = "ExecError";
  }
}

const ErrNotFound = new ExecError("", "executable file not found in $PATH");
const ErrDot = new ExecError("", "relative path detected");

async function findExecutable(file: string): Promise<void> {
  const stats = await fs.stat(file);
  if (stats.isDirectory()) {
    throw new Error("EISDIR");
  }

  await fs.access(file, fs.constants.X_OK);
}

export async function lookPath(
  file: string,
  path: string | undefined
): Promise<string> {
  if (file.includes("/")) {
    try {
      await findExecutable(file);
      return file;
    } catch (err: any) {
      throw new ExecError(file, err.message);
    }
  }

  const PATH = path || "";
  const pathDirs = PATH.split(nodePath.delimiter);

  for (const dir of pathDirs) {
    const resolvedDir = dir || ".";
    const fullPath = nodePath.join(resolvedDir, file);

    try {
      await findExecutable(fullPath);
      if (!nodePath.isAbsolute(fullPath)) {
        throw ErrDot;
      }
      return fullPath;
    } catch (err) {
      if (err !== ErrDot) {
        continue;
      } else {
        throw new ExecError(file, ErrDot.message);
      }
    }
  }

  throw ErrNotFound;
}
