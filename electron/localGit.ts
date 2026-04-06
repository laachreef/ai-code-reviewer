import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export class LocalGitManager {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private async runCommand(cmd: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git ${cmd}`, { cwd: this.baseDir, maxBuffer: 1024 * 1024 * 10 });
      return stdout;
    } catch (e) {
      console.error(`Error running git cmd: git ${cmd}`, e);
      throw e;
    }
  }

  async getDiff(): Promise<string> {
    return this.runCommand('diff HEAD');
  }

  async getModifiedFiles(): Promise<string[]> {
    const output = await this.runCommand('diff --name-only HEAD');
    return output.split('\n').filter(line => line.trim().length > 0);
  }

  async getTree(): Promise<{ path: string, size: number }[]> {
    const output = await this.runCommand('ls-tree -r HEAD');
    const lines = output.split('\n').filter(line => line.trim().length > 0);
    const files = [];
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        files.push({ path: parts[1], size: 0 });
      }
    }
    
    // Add dynamically modified files not in tree yet (e.g., fully new but staged)
    const modifiedFiles = await this.getModifiedFiles();
    for (const mod of modifiedFiles) {
        if (!files.find(f => f.path === mod)) {
            files.push({ path: mod, size: 0 });
        }
    }
    
    // Determine sizes from disk
    const result = [];
    for (const file of files) {
      try {
        const fullPath = path.join(this.baseDir, file.path);
        const stats = await fs.promises.stat(fullPath);
        result.push({ path: file.path, size: stats.size });
      } catch (e) {
        // File may be deleted or we don't have access
        result.push({ path: file.path, size: 0 });
      }
    }
    return result;
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      const fullPath = path.join(this.baseDir, filePath);
      const content = await fs.promises.readFile(fullPath, 'utf8');
      return content;
    } catch (e) {
      console.error(`Error reading local file content for ${filePath}:`, e);
      return '';
    }
  }
}
