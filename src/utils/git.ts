import simpleGit from 'simple-git';

export async function cloneRepo(url: string, dest: string): Promise<void> {
  const git = simpleGit();
  await git.clone(url, dest);
}

export async function pullRepo(path: string): Promise<void> {
  const git = simpleGit(path);
  await git.pull();
}
