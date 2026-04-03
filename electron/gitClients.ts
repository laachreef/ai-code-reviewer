import { Gitlab } from '@gitbeaker/rest';
import { Octokit } from '@octokit/rest';

export class GitManager {
  private client: any;
  private platform: 'gitlab' | 'github';

  constructor(platform: 'gitlab' | 'github', token: string, url?: string) {
    this.platform = platform;
    if (platform === 'gitlab') {
      this.client = new Gitlab({ host: url || 'https://gitlab.com', token });
    } else {
      this.client = new Octokit({ auth: token, baseUrl: url || 'https://api.github.com' });
    }
  }

  async getDiff(projectId: string, prId: number): Promise<string> {
    if (this.platform === 'gitlab') {
      const changes = await this.client.MergeRequests.changes(projectId, prId);
      return changes.changes.map((c: any) => `File: ${c.new_path}\n${c.diff}`).join('\n\n');
    } else {
      const [owner, repo] = projectId.split('/');
      const { data } = await this.client.pulls.get({ owner, repo, pull_number: prId, mediaType: { format: 'diff' } });
      return data as unknown as string;
    }
  }

  async getPRFiles(projectId: string, prId: number): Promise<string[]> {
    if (this.platform === 'gitlab') {
      const { changes } = await this.client.MergeRequests.changes(projectId, prId);
      return changes.map((c: any) => c.new_path);
    } else {
      const [owner, repo] = projectId.split('/');
      const { data } = await this.client.pulls.listFiles({ owner, repo, pull_number: prId });
      return data.map((f: any) => f.filename);
    }
  }

  async getAllRepoFiles(projectId: string, prId: number): Promise<{ path: string, size: number }[]> {
    try {
      if (this.platform === 'gitlab') {
        const mr = await this.client.MergeRequests.show(projectId, prId);
        const ref = mr.source_branch;
        const tree = await this.client.Repositories.allTree(projectId, { recursive: true, ref, per_page: 100 });
        // GitLab trees don't provide size by default. For simplicity, we only return path.
        // We'll handle size 0 in frontend.
        return tree.filter((f: any) => f.type === 'blob').map((f: any) => ({ path: f.path, size: 0 }));
      } else {
        const [owner, repo] = projectId.split('/');
        const { data: pr } = await this.client.pulls.get({ owner, repo, pull_number: prId });
        const tree_sha = pr.head.sha;
        const { data } = await this.client.git.getTree({ owner, repo, tree_sha, recursive: true });
        return data.tree
          .filter((f: any) => f.type === 'blob')
          .map((f: any) => ({ 
            path: f.path || '', 
            size: f.size || 0 
          }));
      }
    } catch (e) {
      console.error('Error fetching repo tree:', e);
      return [];
    }
  }

  async getFileContent(projectId: string, filePath: string, prId: number): Promise<string> {
    try {
      if (this.platform === 'gitlab') {
        // Obtenir le SHA de la branche source (MR)
        const mr = await this.client.MergeRequests.show(projectId, prId);
        const ref = mr.source_branch;
        const file = await this.client.RepositoryFiles.show(projectId, filePath, ref);
        return Buffer.from(file.content, 'base64').toString('utf-8');
      } else {
        const [owner, repo] = projectId.split('/');
        // Obtenir le ref de la branche source (PR)
        const { data: pr } = await this.client.pulls.get({ owner, repo, pull_number: prId });
        const ref = pr.head.sha;
        const { data } = await this.client.repos.getContent({ owner, repo, path: filePath, ref });
        if ('content' in data && typeof data.content === 'string') {
          return Buffer.from(data.content, 'base64').toString('utf-8');
        }
        return '';
      }
    } catch (e) {
      console.error(`Error fetching file content for ${filePath}:`, e);
      return '';
    }
  }

  async postComments(projectId: string, prId: number, comments: any[]) {
    // Implémentation d'envoi de commentaires ligne par ligne selon la plateforme
    // Pour simplifier l'exemple, on poste un commentaire global formaté
    const body = comments.length > 0 
      ? comments.map(c => `**[${c.severity.toUpperCase()}] ${c.agent} - Ligne ${c.line}**\n${c.message}\n*Suggestion: ${c.suggestion}*`).join('\n\n---\n')
      : "✅ PR approuvée par l'IA sans commentaires.";
    
    if (this.platform === 'gitlab') {
      await this.client.MergeRequestNotes.create(projectId, prId, body);
    } else {
      const [owner, repo] = projectId.split('/');
      await this.client.issues.createComment({ owner, repo, issue_number: prId, body });
    }
  }

  async mergePR(projectId: string, prId: number, deleteBranch: boolean = false) {
    if (this.platform === 'gitlab') {
      await this.client.MergeRequests.accept(projectId, prId, { should_remove_source_branch: deleteBranch });
    } else {
      const [owner, repo] = projectId.split('/');
      const pr = await this.client.pulls.get({ owner, repo, pull_number: prId });
      await this.client.pulls.merge({ owner, repo, pull_number: prId });
      if (deleteBranch && pr.data.head.repo) {
        try {
          await this.client.git.deleteRef({
            owner,
            repo: pr.data.head.repo.name,
            ref: `heads/${pr.data.head.ref}`
          });
        } catch (e) {
          console.warn('Erreur lors de la suppression de la branche', e);
        }
      }
    }
  }

  async verifyToken(): Promise<boolean> {
    try {
      if (this.platform === 'gitlab') {
        await this.client.Users.current();
      } else {
        await this.client.users.getAuthenticated();
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async getRepos() {
    try {
      if (this.platform === 'gitlab') {
        const projects = await this.client.Projects.all({ membership: true, simple: true, per_page: 100 });
        return projects.map((p: any) => ({ id: p.id.toString(), name: p.path_with_namespace }));
      } else {
        const { data } = await this.client.repos.listForAuthenticatedUser({ sort: 'updated', per_page: 100 });
        return data.map((r: any) => ({ id: r.full_name, name: r.full_name }));
      }
    } catch(e) {
      console.error(e);
      throw e;
    }
  }

  async getPendingPRs(projectId: string) {
    try {
      if (this.platform === 'gitlab') {
        const prs = await this.client.MergeRequests.all({ projectId, state: 'opened' });
        return prs.map((p: any) => ({
          id: p.iid,
          title: p.title,
          url: p.web_url,
          createdAt: p.created_at,
          author: p.author?.name || p.author?.username || 'Inconnu'
        }));
      } else {
        const [owner, repo] = projectId.split('/');
        const { data } = await this.client.pulls.list({ owner, repo, state: 'open' });
        return data.map((p: any) => ({
          id: p.number,
          title: p.title,
          url: p.html_url,
          createdAt: p.created_at,
          author: p.user?.login || 'Inconnu'
        }));
      }
    } catch(e) {
      console.error(e);
      throw e;
    }
  }

  async getAllPendingPRsCount(): Promise<{ total: number, repos: { repoId: string, prs: { id: number|string, title: string, createdAt: string }[] }[] }> {
    try {
      if (this.platform === 'gitlab') {
        const allPrs = await this.client.MergeRequests.all({ state: 'opened', per_page: 100 });
        const byRepo: any = {};
        for (const pr of allPrs) {
          const repoId = pr.references?.full || String(pr.project_id);
          if (!byRepo[repoId]) byRepo[repoId] = [];
          byRepo[repoId].push({ 
            id: pr.iid, 
            title: pr.title, 
            createdAt: pr.created_at,
            author: pr.author?.name || pr.author?.username || 'Inconnu'
          });
        }
        const repos = Object.entries(byRepo).map(([repoId, prs]) => ({ repoId, prs: prs as any[] }));
        return { total: allPrs.length, repos };
      } else {
        // GitHub: d'abord récupérer la liste des repos, puis les PRs de chacun
        const { data: repoList } = await this.client.repos.listForAuthenticatedUser({ sort: 'updated', per_page: 50 });
        const reposWithPRs: { repoId: string, prs: { id: number, title: string, createdAt: string, author: string }[] }[] = [];
        let total = 0;
        await Promise.all(repoList.map(async (repo: any) => {
          try {
            const [owner, repoName] = repo.full_name.split('/');
            const { data: prs } = await this.client.pulls.list({ owner, repo: repoName, state: 'open', per_page: 20 });
            if (prs.length > 0) {
              reposWithPRs.push({
                repoId: repo.full_name,
                prs: prs.map((p: any) => ({ 
                  id: p.number, 
                  title: p.title, 
                  createdAt: p.created_at,
                  author: p.user?.login || 'Inconnu'
                }))
              });
              total += prs.length;
            }
          } catch (_) { /* ignore repos sans accès */ }
        }));
        return { total, repos: reposWithPRs };
      }
    } catch(e) {
      console.warn('Erreur getAllPendingPRsCount', e);
      return { total: 0, repos: [] };
    }
  }
}

