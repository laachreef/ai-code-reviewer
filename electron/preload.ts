// preload.ts
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  getHistory: () => ipcRenderer.invoke('get-history'),
  saveHistory: (historyItem: any) => ipcRenderer.invoke('save-history', historyItem),
  verifyToken: (platform: string, token: string, url?: string) => ipcRenderer.invoke('verify-token', { platform, token, url }),
  verifyLlmToken: (provider: string, apiKey: string) => ipcRenderer.invoke('verify-llm-token', { provider, apiKey }),
  postReview: (data: any) => ipcRenderer.invoke('post-review', data),
  mergeReview: (data: any) => ipcRenderer.invoke('merge-review', data),
  getRepos: () => ipcRenderer.invoke('get-repos'),
  getPendingPRs: (projectId: string) => ipcRenderer.invoke('get-pending-prs', projectId),
  getAllPendingPRsCount: () => ipcRenderer.invoke('get-all-pending-prs'),
  getPRFiles: (repoId: string, prId: number) => ipcRenderer.invoke('get-pr-files', { repoId, prId }),
  getRepoFiles: (repoId: string, prId: number) => ipcRenderer.invoke('get-repo-tree', { repoId, prId }),
  runReview: (repoId: string, prId: number, selectedAgents: string[], selectedFilesForContext?: string[], minSeverity?: string, strategy?: 'grouped' | 'sequential') => ipcRenderer.invoke('run-review', {repoId, prId, selectedAgents, selectedFilesForContext, minSeverity, strategy}),
  onReviewReady: (callback: Function) => ipcRenderer.on('review-ready', (_event: any, data: any) => callback(data)),
  onReviewProgress: (callback: Function) => ipcRenderer.on('review-progress', (_event: any, data: any) => callback(data)),
  onWebhookStatus: (callback: Function) => ipcRenderer.on('webhook-status', (_event: any, data: any) => callback(data)),
  onWebhookPrReceived: (callback: Function) => ipcRenderer.on('webhook-pr-received', (_event: any, data: any) => callback(data))
});
