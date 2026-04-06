import { GoogleGenerativeAI } from '@google/generative-ai';
import { Groq } from 'groq-sdk';
import OpenAI from 'openai';

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
}

let model: any = null;
let groqClient: any = null;
let openaiClient: any = null;
let currentProvider: string = 'gemini';
let currentModelName: string = '';
let customProviders: CustomProvider[] = [];
let customAgents: any = {};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function setCustomProviders(providers: CustomProvider[]) {
  customProviders = providers || [];
}

export function getCustomProviders(): CustomProvider[] {
  return customProviders;
}

export function getDefaultProviders() {
  return [
    { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
    { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'] }
  ];
}

export function getAllProviders() {
  return [...getDefaultProviders(), ...customProviders];
}

export async function fetchModelsFromProvider(baseUrl: string, apiKey: string): Promise<{ success: boolean; models?: string[]; error?: string }> {
  try {
    const client = new OpenAI({ apiKey, baseURL: baseUrl });
    const modelsList = await client.models.list();
    const modelIds = modelsList.data.map((m: any) => m.id).sort();
    return { success: true, models: modelIds };
  } catch (error: any) {
    console.error('Fetch models error:', error);
    return { success: false, error: error?.message || 'Erreur de connexion' };
  }
}

export function initializeModel(provider: string, modelName: string, apiKey: string, customAgentsConfig?: any[]) {
  currentProvider = provider;
  currentModelName = modelName;
  
  model = null;
  groqClient = null;
  openaiClient = null;
  
  if (provider === 'groq') {
    groqClient = new Groq({ apiKey });
  } else if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: modelName || 'gemini-2.5-flash' });
  } else {
    const customProvider = customProviders.find(p => p.id === provider);
    if (customProvider) {
      // Use provider's own API key if generic one is missing
      const effectiveKey = apiKey || (customProvider as any).apiKey;
      openaiClient = new OpenAI({
        apiKey: effectiveKey,
        baseURL: customProvider.baseUrl
      });
    } else {
      throw new Error(`Provider inconnu: ${provider}. Assurez-vous que le provider personnalisé est bien configuré.`);
    }
  }
  
  customAgents = {};
  if (customAgentsConfig) {
    customAgentsConfig.forEach(agent => {
      customAgents[agent.id] = agent.prompt;
    });
  }
}

const AGENT_PROMPTS = {
  cleanArchitecture: "Tu es un expert en Clean Architecture. Analyse ce diff. Vérifie la séparation des couches. Ne retourne une remarque QUE si elle est réellement pertinente par rapport à la Clean Architecture. Si le code est correct, retourne un tableau vide. Le format attendu est STRICTEMENT un object JSON : { \"violations\": [{ \"file\": string, \"line\": number, \"severity\": \"error\"|\"warning\"|\"info\", \"message\": string, \"suggestion\": string }] }",
  solid: "Tu es un expert en principes SOLID. Analyse ce diff. Vérifie le respect des principes SRP, OCP, LSP, ISP, DIP. Ne retourne une remarque QUE si elle apporte une réelle valeur ajoutée. Si tout est respecté, retourne un tableau vide. Le format attendu est STRICTEMENT un object JSON : { \"violations\": [{ \"file\": string, \"line\": number, \"severity\": \"error\"|\"warning\"|\"info\", \"message\": string, \"suggestion\": string }] }",
  testing: "Tu es un expert QA. Vérifie les tests unitaires et la couverture des cas limites. Ne mentionne que des manques critiques ou des suggestions d'amélioration concrètes. Si les tests sont suffisants, retourne un tableau vide. Le format attendu est STRICTEMENT un object JSON : { \"violations\": [{ \"file\": string, \"line\": number, \"severity\": \"error\"|\"warning\"|\"info\", \"message\": string, \"suggestion\": string }] }",
  security: "Tu es un expert sécurité (OWASP). Cherche des failles réelles ou des mauvaises pratiques dangereuses. Ne retourne rien s'il n'y a pas de risqueIdentifié. Le format attendu est STRICTEMENT un object JSON : { \"violations\": [{ \"file\": string, \"line\": number, \"severity\": \"error\"|\"warning\"|\"info\", \"message\": string, \"suggestion\": string }] }"
};

export function getDefaultAgents() {
  return Object.keys(AGENT_PROMPTS);
}

export async function verifyLlmToken(provider: string, apiKey: string) {
  try {
    if (provider === 'groq') {
      const groqTest = new Groq({ apiKey });
      await groqTest.models.list();
      return true;
    } else if (provider === 'gemini') {
      const genAI = new GoogleGenerativeAI(apiKey);
      const m = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      await m.countTokens({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] });
      return true;
    } else {
      const customProvider = customProviders.find(p => p.id === provider);
      if (customProvider) {
        const testClient = new OpenAI({ apiKey, baseURL: customProvider.baseUrl });
        await testClient.models.list();
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error('LLM verification error:', error);
    return false;
  }
}

export async function verifyCustomProviderConnection(baseUrl: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!baseUrl) return { success: false, error: 'L\'URL de base est requise' };
    if (!apiKey) return { success: false, error: 'La clé API est requise' };
    
    const testClient = new OpenAI({ apiKey, baseURL: baseUrl });
    await testClient.models.list();
    return { success: true };
  } catch (error: any) {
    console.error('Custom provider verification error:', error);
    const errorMsg = error?.message || error?.toString() || 'Erreur de connexion';
    return { success: false, error: `Échec de la connexion: ${errorMsg}` };
  }
}

export function getAgentPrompt(agentName: string) {
  return AGENT_PROMPTS[agentName as keyof typeof AGENT_PROMPTS];
}

async function callModel(messages: any[], responseFormat?: string) {
  if (currentProvider === 'groq') {
    const response = await groqClient.chat.completions.create({
      messages,
      model: currentModelName || 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: responseFormat ? { type: responseFormat } : undefined
    });
    return response?.choices?.[0]?.message?.content || '{"violations":[]}';
  } else if (currentProvider === 'gemini') {
    const userContent = messages.find((m: any) => m.role === 'user')?.content || '';
    const systemContent = messages.find((m: any) => m.role === 'system')?.content || '';
    const prompt = systemContent ? `${systemContent}\n\n${userContent}` : userContent;
    const result = await model.generateContent(prompt);
    return result?.response?.text() || '{"violations":[]}';
  } else {
    const response = await openaiClient.chat.completions.create({
      messages,
      model: currentModelName,
      temperature: 0.1,
      response_format: responseFormat ? { type: responseFormat } : undefined
    });
    return response?.choices?.[0]?.message?.content || '{"violations":[]}';
  }
}

let isAnalysisCancelled = false;

export function cancelReview() {
  isAnalysisCancelled = true;
}

export async function runMultiAgentReview(diff: string, selectedAgents?: string[], onProgress?: (msg: string) => void, fileContext?: string, strategy: 'grouped' | 'sequential' = 'grouped') {
  isAnalysisCancelled = false;
  if (!model && !groqClient && !openaiClient) throw new Error('Model not initialized. Call initializeModel first.');
  
  console.log('[agents.ts] Starting review with strategy:', strategy, 'diff length:', diff.length, 'and file context length:', fileContext?.length || 0);
  
  let agentsToRun: string[];
  if (selectedAgents && selectedAgents.length > 0) {
    agentsToRun = selectedAgents;
  } else {
    const allDefaultAgents = Object.keys(AGENT_PROMPTS);
    const allCustomAgents = Object.keys(customAgents);
    agentsToRun = [...allDefaultAgents, ...allCustomAgents];
  }
  
  console.log('[agents.ts] Running agents:', agentsToRun);

  if (strategy === 'grouped') {
    onProgress?.(`Analyse optimisée groupée (${agentsToRun.length} agents)...`);
    
    let combinedInstructions = "Tu es un expert multi-disciplinaire en revue de code. Tu dois analyser le code selon les expertises suivantes :\n\n";
    
    agentsToRun.forEach(agentName => {
      const prompt = AGENT_PROMPTS[agentName as keyof typeof AGENT_PROMPTS] || customAgents[agentName];
      if (prompt) {
        combinedInstructions += `--- EXPERTISE : ${agentName} ---\n${prompt}\n\n`;
      }
    });

    const formatInstruction = "\n\nRESTRICTIONS & FORMAT :\n1. Analyse le code de manière objective et concise.\n2. Ne retourne des violations QUE si elles sont réellement justifiées.\n3. Pour chaque violation, tu DOIS obligatoirement indiquer quel expert/agent l'a détectée dans le champ 'agent'.\n4. Le format attendu est STRICTEMENT un object JSON unique : { \"violations\": [{ \"file\": string, \"line\": number, \"severity\": \"error\"|\"warning\"|\"info\", \"message\": string, \"suggestion\": string, \"agent\": string }] }";
    
    const contextSection = fileContext ? `\n\nCONTEXTE DES FICHIERS COMPLETS MODIFIÉS :\n${fileContext}\n` : '';
    const finalUserContent = `${contextSection}\nCODE DIFF À ANALYSER :\n${diff}`;

    let text = '';
    try {
      if (isAnalysisCancelled) throw new Error("Analyse annulée par l'utilisateur");
      
      text = await callModel([
        { role: 'system', content: combinedInstructions + formatInstruction },
        { role: 'user', content: finalUserContent }
      ], "json_object");

      if (isAnalysisCancelled) throw new Error("Analyse annulée par l'utilisateur");

      console.log(`[agents.ts] Grouped response:`, text.substring(0, 200));
      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || '{"violations":[]}';
      const parsed = JSON.parse(jsonStr);
      const violations = Array.isArray(parsed.violations) ? parsed.violations : [];

      for (const agentName of agentsToRun) {
        onProgress?.(`${agentName} terminé.`);
      }

      return violations;
    } catch (e) {
      console.error(`[agents.ts] Erreur analyse groupée:`, e);
      throw e;
    }
  }

  const results = [];
  for (const agentName of agentsToRun) {
    const prompt = AGENT_PROMPTS[agentName as keyof typeof AGENT_PROMPTS] || customAgents[agentName];
    if (!prompt) continue;
    
    onProgress?.(`Analyse avec ${agentName}...`);
    try {
      if (isAnalysisCancelled) throw new Error("Analyse annulée par l'utilisateur");
      let text = '';
      const formatInstruction = "\n\nCRITIQUE: Analyse le code de manière objective. Ne retourne des violations QUE si elles sont réellement justifiées. Si le code est de bonne qualité, retourne un tableau vide. Pour chaque violation, le chemin complet du fichier est OBLIGATOIRE.\nJSON attendu : {\"violations\": [{ \"file\": string, \"line\": number, \"severity\": \"error\"|\"warning\"|\"info\", \"message\": string, \"suggestion\": string }]}";
      const contextSection = fileContext ? `\n\nCONTEXTE DES FICHIERS COMPLETS MODIFIÉS :\n${fileContext}\n` : '';
      const finalUserContent = `${contextSection}\nCODE DIFF À ANALYSER :\n${diff}`;

      text = await callModel([
        { role: 'system', content: prompt + formatInstruction },
        { role: 'user', content: finalUserContent }
      ], "json_object");
      
      if (isAnalysisCancelled) throw new Error("Analyse annulée par l'utilisateur");
      
      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || '{"violations":[]}';
      let parsed = { violations: [] };
      try { parsed = JSON.parse(jsonStr); } catch (err) {}
      const safeViolations = Array.isArray(parsed.violations) ? parsed.violations : [];
      results.push({ violations: safeViolations.map((v: any) => ({ ...v, agent: agentName })), error: null });
      onProgress?.(`${agentName} terminé.`);
    } catch (e) {
      console.error(`[agents.ts] Erreur agent ${agentName}:`, e);
      results.push({ violations: [], error: `${agentName}: ${(e as any).message || e}` });
      onProgress?.(`Erreur ${agentName}: ${(e as any).message || 'Inconnue'}`);
    }
    await delay(5000);
  }

  const allViolations = results.flatMap(r => r.violations);
  const errors = results.filter(r => r.error).map(r => r.error);
  if (allViolations.length === 0 && errors.length > 0) throw new Error(`Erreurs API: ${errors.join('; ')}`);
  return allViolations;
}
