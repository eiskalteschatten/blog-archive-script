import path from 'node:path';
import { exec } from 'node:child_process';
import fs from 'node:fs';

export class Git {
  repoName;
  repoRootDirectory;
  dataDirectory;

  constructor(repoName) {
    if (!repoName) {
      throw new Error('Missing required parameters.');
    }

    this.repoName = repoName;
    this.repoRootDirectory = path.join(process.cwd(), '..', repoName);
    this.dataDirectory = path.join(this.repoRootDirectory, 'blog');
  }

  async pull() {
    try {
      console.log(`Pulling ${this.repoName}...`);
      await this.executeGitCommand('git pull');
      console.log(`Successfully pulled ${this.repoName}!`);
    }
    catch (error) {
      console.error(error);
    }
  }

  async commitPush() {
    console.log(`Committing and pushing ${this.repoName}...`);

    const commitMessage = 'Nightly archive update';
    const files = this.readFilesRecursively(this.dataDirectory);
    const batchSize = 50;
    const totalBatches = Math.ceil(files.length / batchSize);

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      for (const file of batch) {
        try {
          await this.executeGitCommand(`git add ${file}`);
        }
        catch (error) {
          console.error(error);
        }
      }

      try {
        await this.executeGitCommand(`git commit -m "${commitMessage} - batch ${batchNumber} of ${totalBatches}"`);
        await this.executeGitCommand('git push');

        console.log(`Batch ${batchNumber} of ${totalBatches} for ${this.blogName} successfully pushed to GitHub!`);
      }
      catch (error) {
        console.error(error);
      }
    }

    console.log('Archive successfully pushed!');
  }

  async executeGitCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: this.repoRootDirectory }, (error, stdout, stderr) => {
        if (error) {
          reject(`Error: ${stderr}`);
        }
        else {
          resolve(stdout);
        }
      });
    });
  }

  readFilesRecursively = dir => {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat && stat.isDirectory()) {
        results = results.concat(this.readFilesRecursively(filePath));
      }
      else {
        results.push(filePath);
      }
    });

    return results;
  }
}
