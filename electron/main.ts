// main.ts
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { getConfig, saveConfig, getHistory, saveHistory } = require('./store.js');
const { startWebhookServer } = require('./webhook.js');
const { GitManager } = require('./gitClients.js');
const { LocalGitManager } = require('./localGit.js');

let mainWindow: any = null;

app.whenReady().then(async () => {
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

ipcMain.handle('verify-token', async (_event: any, { platform, token, url }: any) => {
  if (platform === 'local') return { valid: true };
  const git = new GitManager(platform, token, url);
  const valid = await git.verifyToken();
  return { valid };
});

ipcMain.handle('select-local-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('verify-llm-token', async (_event: any, { provider, apiKey }: { provider: string, apiKey: string }) => {
  const { verifyLlmToken, setCustomProviders } = require('./agents.js');
  const config = getConfig();
  setCustomProviders(config?.customProviders || []);
  return await verifyLlmToken(provider, apiKey);
});

ipcMain.handle('verify-custom-provider', async (_event: any, { baseUrl, apiKey }: { baseUrl: string, apiKey: string }) => {
  const { verifyCustomProviderConnection } = require('./agents.js');
  return await verifyCustomProviderConnection(baseUrl, apiKey);
});

ipcMain.handle('fetch-models-from-provider', async (_event: any, { baseUrl, apiKey }: { baseUrl: string, apiKey: string }) => {
  const { fetchModelsFromProvider } = require('./agents.js');
  return await fetchModelsFromProvider(baseUrl, apiKey);
});

ipcMain.handle('fetch-provider-models-by-id', async (_event: any, { providerId }: { providerId: string }) => {
  try {
    const config = getConfig();
    if (!config) return { success: false, error: 'Aucune configuration' };
    
    // Check custom providers
    const customProvider = (config.customProviders || []).find((p: any) => p.id === providerId);
    if (customProvider && customProvider.baseUrl && customProvider.apiKey) {
      const { fetchModelsFromProvider } = require('./agents.js');
      return await fetchModelsFromProvider(customProvider.baseUrl, customProvider.apiKey);
    }
    
    // For default providers, return their static models
    const { getDefaultProviders } = require('./agents.js');
    const defaultProvider = getDefaultProviders().find((p: any) => p.id === providerId);
    if (defaultProvider) {
      return { success: true, models: defaultProvider.models };
    }
    
    return { success: false, error: 'Provider non trouvé' };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erreur' };
  }
});

ipcMain.handle('get-all-providers', () => {
  const { getAllProviders, setCustomProviders } = require('./agents.js');
  const config = getConfig();
  setCustomProviders(config?.customProviders || []);
  return getAllProviders();
});

ipcMain.handle('add-custom-provider', (_event: any, provider: any) => {
  const config = getConfig() || {};
  if (!config.customProviders) config.customProviders = [];
  config.customProviders.push(provider);
  saveConfig(config);
  return { success: true };
});

ipcMain.handle('remove-custom-provider', (_event: any, providerId: string) => {
  const config = getConfig();
  if (config?.customProviders) {
    config.customProviders = config.customProviders.filter((p: any) => p.id !== providerId);
    saveConfig(config);
  }
  return { success: true };
});

ipcMain.handle('remove-default-provider', (_event: any, providerId: string) => {
  const config = getConfig() || {};
  if (!config.removedProviders) config.removedProviders = [];
  if (!config.removedProviders.includes(providerId)) {
    config.removedProviders.push(providerId);
    saveConfig(config);
  }
  return { success: true };
});

ipcMain.handle('get-removed-providers', () => {
  const config = getConfig();
  return config?.removedProviders || [];
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
  if (config.platform === 'local') {
    const localGit = new LocalGitManager(repoId);
    return await localGit.getModifiedFiles();
  }
  const git = new GitManager(config.platform, config.token, config.url);
  return await git.getPRFiles(repoId, prId);
});

ipcMain.handle('get-repo-tree', async (_event: any, { repoId, prId }: { repoId: string, prId: number }) => {
  const config = getConfig();
  if (config.platform === 'local') {
    const localGit = new LocalGitManager(repoId);
    return await localGit.getTree();
  }
  const git = new GitManager(config.platform, config.token, config.url);
  return await git.getAllRepoFiles(repoId, prId);
});

ipcMain.handle('get-diff-length', async (_event: any, { repoId, prId }: { repoId: string, prId: number }) => {
  const config = getConfig();
  try {
    if (config.platform === 'local') {
      const localGit = new LocalGitManager(repoId);
      const diff = await localGit.getDiff();
      return diff.length;
    }
    const git = new GitManager(config.platform, config.token, config.url);
    const diff = await git.getDiff(repoId, prId);
    return diff.length;
  } catch (e) {
    return 0;
  }
});

ipcMain.handle('run-review', async (_event: any, { repoId, prId, selectedAgents, selectedFilesForContext, minSeverity, strategy }: { repoId: string, prId: number, selectedAgents: string[], selectedFilesForContext?: string[], minSeverity?: string, strategy?: 'grouped' | 'sequential' }) => {
  try {
    console.log('[main.ts] run-review handler called:', { repoId, prId, selectedAgents, minSeverity });
    
    const config = getConfig();
    if (!config) throw new Error('Configuration manquante');
    
    let apiKey = config.llmApiKey || config.geminiKey;
    const provider = config.llmProvider || 'gemini';
    const model = config.llmModel || 'gemini-2.5-flash';

    // For custom providers, always try to get the API key from the provider config
    if (config.customProviders) {
      const customProvider = config.customProviders.find((p: any) => p.id === provider);
      if (customProvider && customProvider.apiKey) {
        apiKey = customProvider.apiKey;
      }
    }
    
    if (!apiKey) throw new Error('Clé API IA manquante');
    
    console.log('[main.ts] config found, platform:', config.platform, 'provider:', provider);

    const { initializeModel, runMultiAgentReview, setCustomProviders } = require('./agents.js');
    setCustomProviders(config.customProviders || []);
    console.log('[main.ts] Custom providers loaded:', (config.customProviders || []).length);
    initializeModel(provider, model, apiKey, config.agents);
    console.log('[main.ts] Model initialized');

    let diff = '';
    if (config.platform === 'local') {
      const localGit = new LocalGitManager(repoId);
      diff = await localGit.getDiff();
      console.log('[main.ts] Local diff received, length:', diff.length);
    } else {
      const git = new GitManager(config.platform, config.token, config.url);
      console.log('[main.ts] GitManager created');
      diff = await git.getDiff(repoId, prId);
      console.log('[main.ts] Remote diff received, length:', diff.length);
    }
    
    mainWindow.webContents.send('review-progress', { message: 'Récupération du contexte fichier...' });
    
    let fileContext = '';
    if (selectedFilesForContext && selectedFilesForContext.length > 0) {
      const contexts = await Promise.all(selectedFilesForContext.map(async (filePath) => {
        let content = '';
        if (config.platform === 'local') {
          const localGit = new LocalGitManager(repoId);
          content = await localGit.getFileContent(filePath);
        } else {
          const git = new GitManager(config.platform, config.token, config.url);
          content = await git.getFileContent(repoId, filePath, prId);
        }
        return `--- File: ${filePath} ---\n${content}\n`;
      }));
      fileContext = contexts.join('\n');
    }

    mainWindow.webContents.send('review-progress', { message: 'Diff récupéré, lancement de l\'analyse...' });
    
    const allViolations = await runMultiAgentReview(diff, selectedAgents, (progress: string) => {
      mainWindow.webContents.send('review-progress', { message: progress });
    }, fileContext, strategy);

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

ipcMain.handle('cancel-review', () => {
  const { cancelReview } = require('./agents.js');
  cancelReview();
  return { success: true };
});
