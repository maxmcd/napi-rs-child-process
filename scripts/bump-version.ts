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

const updatePackageJson = async (filePath: string, newVersion: string): Promise<void> => {
  const content = await fs.readFile(filePath, 'utf-8');
  const packageJson = JSON.parse(content);
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;
  await fs.writeFile(filePath, JSON.stringify(packageJson, null, 2));
  console.log(`Updated ${filePath}: ${oldVersion} -> ${newVersion}`);
};

const updateExamplePackageJson = async (filePath: string, newVersion: string): Promise<void> => {
  const content = await fs.readFile(filePath, 'utf-8');
  const packageJson = JSON.parse(content);
  if (packageJson.dependencies && packageJson.dependencies['napi-rs-child-process']) {
    const oldVersion = packageJson.dependencies['napi-rs-child-process'];
    packageJson.dependencies['napi-rs-child-process'] = newVersion;
    await fs.writeFile(filePath, JSON.stringify(packageJson, null, 2));
    console.log(`Updated ${filePath}: napi-rs-child-process ${oldVersion} -> ${newVersion}`);
  }
};

const findAndUpdatePackageJsonFiles = async (dir: string, newVersion: string): Promise<void> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      await findAndUpdatePackageJsonFiles(fullPath, newVersion);
    } else if (entry.name === 'package.json') {
      if (fullPath.includes('examples')) {
        await updateExamplePackageJson(fullPath, newVersion);
      } else {
        await updatePackageJson(fullPath, newVersion);
      }
    }
  }
};

const main = async (): Promise<void> => {
  const bumpType = (process.argv[2] as BumpType) || 'patch';
  const rootDir = process.cwd();
  const mainPackageJsonPath = path.join(rootDir, 'package.json');

  // Update the main package.json and get the new version
  const content = await fs.readFile(mainPackageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);
  const oldVersion = packageJson.version;
  const newVersion = bumpVersion(oldVersion, bumpType);

  // Update all package.json files
  await findAndUpdatePackageJsonFiles(rootDir, newVersion);

  console.log('Version bump completed.');
};

main().catch(console.error);