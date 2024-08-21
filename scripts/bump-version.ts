import { promises as fs } from 'fs';
import path from 'path';

type BumpType = 'patch' | 'minor' | 'major';

const bumpVersion = (currentVersion: string, bumpType: BumpType = 'patch'): string => {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
};

const updatePackageJson = async (filePath: string, bumpType: BumpType): Promise<void> => {
  const content = await fs.readFile(filePath, 'utf-8');
  const packageJson = JSON.parse(content);
  const oldVersion = packageJson.version;
  packageJson.version = bumpVersion(oldVersion, bumpType);
  await fs.writeFile(filePath, JSON.stringify(packageJson, null, 2));
  console.log(`Updated ${filePath}: ${oldVersion} -> ${packageJson.version}`);
};

const findAndUpdatePackageJsonFiles = async (dir: string, bumpType: BumpType): Promise<void> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') {
        await findAndUpdatePackageJsonFiles(fullPath, bumpType);
      }
    } else if (entry.name === 'package.json') {
      await updatePackageJson(fullPath, bumpType);
    }
  }
};

const main = async (): Promise<void> => {
  const bumpType = (process.argv[2] as BumpType) || 'patch';
  const rootDir = process.cwd();
  await findAndUpdatePackageJsonFiles(rootDir, bumpType);
  console.log('Version bump completed.');
};

main().catch(console.error);