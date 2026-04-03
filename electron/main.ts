// main.ts
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Contournement pour les proxies d'entreprise limitant Groq/Gemini
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { getConfig, saveConfig, getHistory, saveHistory } = require('./store.js');
const { startWebhookServer } = require('./webhook.js');
const { GitManager } = require('./gitClients.js');

let mainWindow: any = null;

app.whenReady().then(async () => {
  // Supprimer la barre de menu native (FILE EDIT VIEW WINDOW HELP)
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, process.env.NODE_ENV === 'development' ? '../public/icon.png' : '../dist/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });

  if (process.env.NODE_ENV === 'development') {
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:5181';
    mainWindow.loadURL(devUrl);
  } else {
    const prodIndex = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(prodIndex);
  }

  try {
    await startWebhookServer(mainWindow);
  } catch (e) {
    console.error('[main.ts] startWebhookServer error', e);
    // Not fatal: on peut continuer en mode manuel
  }
});

ipcMain.handle('get-config', () => getConfig());
ipcMain.handle('save-config', (_event: any, config: any) => { saveConfig(config); startWebhookServer(mainWindow); });
ipcMain.handle('get-history', () => getHistory());
ipcMain.handle('save-history', (_event: any, historyItem: any) => saveHistory(historyItem));
ipcMain.handle('post-review', async (_event: any, { projectId, prId, comments }: { projectId: any, prId: any, comments: any }) => {
  const config = getConfig();
  const git = new GitManager(config.platform, config.token, config.url);
  await git.postComments(projectId, prId, comments);
  return { success: true };
});

ipcMain.handle('merge-review', async (_event: any, { projectId, prId, deleteBranch }: { projectId: any, prId: any, deleteBranch?: boolean }) => {
  const config = getConfig();
  const git = new GitManager(config.platform, config.token, config.url);
  await git.mergePR(projectId, prId, deleteBranch);
  return { success: true };
});

ipcMain.handle('verify-token', async (_event: any, { platform, token, url }: { platform: any, token: any, url?: any }) => {
  const git = new GitManager(platform, token, url);
  return await git.verifyToken();
});

ipcMain.handle('verify-llm-token', async (_event: any, { provider, apiKey }: { provider: string, apiKey: string }) => {
  const { verifyLlmToken } = require('./agents.js');
  return await verifyLlmToken(provider, apiKey);
});

ipcMain.handle('get-repos', async () => {
  const config = getConfig();
  const git = new GitManager(config.platform, config.token, config.url);
  return await git.getRepos();
});

ipcMain.handle('get-pending-prs', async (_event: any, projectId: string) => {
  const config = getConfig();
  const git = new GitManager(config.platform, config.token, config.url);
  return await git.getPendingPRs(projectId);
});

ipcMain.handle('get-all-pending-prs', async () => {
  const config = getConfig();
  const git = new GitManager(config.platform, config.token, config.url);
  return await git.getAllPendingPRsCount();
});

ipcMain.handle('get-pr-files', async (_event: any, { repoId, prId }: { repoId: string, prId: number }) => {
  const config = getConfig();
  const git = new GitManager(config.platform, config.token, config.url);
  return await git.getPRFiles(repoId, prId);
});

ipcMain.handle('get-repo-tree', async (_event: any, { repoId, prId }: { repoId: string, prId: number }) => {
  const config = getConfig();
  const git = new GitManager(config.platform, config.token, config.url);
  return await git.getAllRepoFiles(repoId, prId);
});

ipcMain.handle('run-review', async (_event: any, { repoId, prId, selectedAgents, selectedFilesForContext, minSeverity, strategy }: { repoId: string, prId: number, selectedAgents: string[], selectedFilesForContext?: string[], minSeverity?: string, strategy?: 'grouped' | 'sequential' }) => {
  try {
    console.log('[main.ts] run-review handler called:', { repoId, prId, selectedAgents, minSeverity });
    
    const config = getConfig();
    if (!config) throw new Error('Configuration manquante');
    const apiKey = config.llmApiKey || config.geminiKey;
    if (!apiKey) throw new Error('Clé API IA manquante');
    const provider = config.llmProvider || 'gemini';
    const model = config.llmModel || 'gemini-2.5-flash';
    
    console.log('[main.ts] config found, platform:', config.platform);

    const { initializeModel, runMultiAgentReview } = require('./agents.js');
    initializeModel(provider, model, apiKey, config.agents);
    console.log('[main.ts] Model initialized');

    const git = new GitManager(config.platform, config.token, config.url);
    console.log('[main.ts] GitManager created');
    
    const diff = await git.getDiff(repoId, prId);
    console.log('[main.ts] Diff received, length:', diff.length);
    
    mainWindow.webContents.send('review-progress', { message: 'Récupération du contexte fichier...' });
    
    let fileContext = '';
    if (selectedFilesForContext && selectedFilesForContext.length > 0) {
      const contexts = await Promise.all(selectedFilesForContext.map(async (filePath) => {
        const content = await git.getFileContent(repoId, filePath, prId);
        return `--- File: ${filePath} ---\n${content}\n`;
      }));
      fileContext = contexts.join('\n');
    }

    mainWindow.webContents.send('review-progress', { message: 'Diff récupéré, lancement de l\'analyse...' });
    
    const allViolations = await runMultiAgentReview(diff, selectedAgents, (progress: string) => {
      mainWindow.webContents.send('review-progress', { message: progress });
    }, fileContext, strategy);

    // Filtrage par sévérité
    let violations = allViolations;
    if (minSeverity && minSeverity !== 'info') {
      const severityOrder = { 'info': 0, 'warning': 1, 'error': 2 };
      const minLevel = severityOrder[minSeverity as keyof typeof severityOrder] || 0;
      violations = allViolations.filter((v: any) => {
        const vLevel = severityOrder[v.severity as keyof typeof severityOrder] ?? 0;
        return vLevel >= minLevel;
      });
    }

    console.log(`[main.ts] Review complete. Total: ${allViolations.length}, Filtered (${minSeverity}): ${violations.length}`);

    mainWindow.webContents.send('review-ready', { repoId, prId, violations, rawDiff: diff });
    return { repoId, prId, violations, rawDiff: diff };
  } catch (error) {
    console.error('[main.ts] run-review error:', error);
    throw error;
  }
});
