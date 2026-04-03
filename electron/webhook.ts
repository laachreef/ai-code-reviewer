import express from 'express';
import ngrok from 'ngrok';
import { BrowserWindow, Notification } from 'electron';
import { runMultiAgentReview } from './agents.js';
import { GitManager } from './gitClients.js';
import { getConfig } from './store.js';

const appExp = express();
appExp.use(express.json());
let webhookServerStarted = false;

export async function startWebhookServer(mainWindow: BrowserWindow) {
  if (webhookServerStarted) {
    console.log('[webhook] already started, skipping startWebhookServer');
    return;
  }
  const config = getConfig();
  if (!config) return;
  webhookServerStarted = true;

  appExp.post('/webhook', async (req, res) => {
    res.status(200).send('OK');
    const event = req.body;
    
    const isPR = event.pull_request || event.object_attributes; 
    if (!isPR) return;

    const prId = event.pull_request?.number || event.object_attributes?.iid;
    const repoId = event.repository?.full_name || event.project?.id;
    const title = event.pull_request?.title || event.object_attributes?.title;

    new Notification({ title: 'Nouvelle MR / PR', body: `${repoId}#${prId}` }).show();

    // Envoi de la notification au frontend pour la file d'attente
    mainWindow.webContents.send('webhook-pr-received', { prId, repoId, title });
  });

  appExp.listen(4567, async () => {
    console.log('[webhook] server listening on http://localhost:4567/webhook');
    if (!config.ngrokToken) {
      console.warn('[webhook] ngrok token absent, mode local only');
      mainWindow.webContents.send('webhook-status', {
        status: 'Webhook local prêt', url: 'http://localhost:4567/webhook'
      });
      return;
    }

    try {
      const url = await ngrok.connect({ addr: 4567, authtoken: config.ngrokToken });
      console.log(`[webhook] ngrok URL: ${url}/webhook`);
      mainWindow.webContents.send('webhook-status', {
        status: `Webhook via ngrok`, url: `${url}/webhook`
      });
    } catch (ngrokError) {
      console.error('[webhook] ngrok connect failed', ngrokError);
      mainWindow.webContents.send('webhook-status', {
        status: 'Erreur ngrok', url: null
      });
    }
  });
}
