import { Octokit } from '@octokit/rest';
import { Logger } from 'winston';

export class GitHubIntegration {
  private octokit: Octokit;

  constructor(
    private token: string,
    private owner: string,
    private repo: string,
    private logger: Logger
  ) {
    this.octokit = new Octokit({ auth: token });
  }

  async getFileContent(path: string, ref: string = 'main'): Promise<string> {
    try {
      const response = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref
      });

      if ('content' in response.data) {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }

      throw new Error('File content not found');
    } catch (error: any) {
      this.logger.error('Failed to get file content', {
        path,
        error: error.message
      });
      throw error;
    }
  }

  async createBranch(branchName: string, fromBranch: string = 'main'): Promise<void> {
    try {
      // Get the SHA of the base branch
      const { data: refData } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${fromBranch}`
      });

      // Create new branch
      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: refData.object.sha
      });

      this.logger.info('Branch created', { branchName, fromBranch });
    } catch (error: any) {
      this.logger.error('Failed to create branch', {
        branchName,
        error: error.message
      });
      throw error;
    }
  }

  async commitFile(
    path: string,
    content: string,
    message: string,
    branch: string
  ): Promise<void> {
    try {
      // Get current file SHA if it exists
      let sha: string | undefined;
      try {
        const { data } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path,
          ref: branch
        });
        if ('sha' in data) {
          sha = data.sha;
        }
      } catch (error) {
        // File doesn't exist, that's okay
      }

      // Create or update file
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
        sha
      });

      this.logger.info('File committed', { path, branch });
    } catch (error: any) {
      this.logger.error('Failed to commit file', {
        path,
        branch,
        error: error.message
      });
      throw error;
    }
  }

  async createPullRequest(
    head: string,
    base: string,
    title: string,
    body: string
  ): Promise<any> {
    try {
      const { data } = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title,
        head,
        base,
        body
      });

      this.logger.info('Pull request created', {
        number: data.number,
        url: data.html_url
      });

      return data;
    } catch (error: any) {
      this.logger.error('Failed to create pull request', {
        head,
        base,
        error: error.message
      });
      throw error;
    }
  }
}

// Made with Bob
