import { GoogleGenerativeAI } from '@google/generative-ai';
import { Groq } from 'groq-sdk';

let model: any = null;
let groqClient: any = null;
let currentProvider: string = 'gemini';
let currentModelName: string = '';
let customAgents: any = {};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function initializeModel(provider: string, modelName: string, apiKey: string, customAgentsConfig?: any[]) {
  currentProvider = provider;
  currentModelName = modelName;
  
  if (provider === 'groq') {
    groqClient = new Groq({ apiKey });
    model = null;
  } else {
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: modelName || 'gemini-2.5-flash' });
    groqClient = null;
  }
  
  // Store custom agents
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
    } else {
      const genAI = new GoogleGenerativeAI(apiKey);
      const m = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      await m.countTokens({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] });
      return true;
    }
  } catch (error) {
    console.error('LLM verification error:', error);
    return false;
  }
}

export function getAgentPrompt(agentName: string) {
  return AGENT_PROMPTS[agentName as keyof typeof AGENT_PROMPTS];
}

export async function runMultiAgentReview(diff: string, selectedAgents?: string[], onProgress?: (msg: string) => void, fileContext?: string, strategy: 'grouped' | 'sequential' = 'grouped') {
  if (!model && !groqClient) throw new Error('Model not initialized. Call initializeModel first.');
  
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
    
    // Construct Combined Prompt
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
      if (currentProvider === 'groq') {
        const response = await groqClient.chat.completions.create({
          messages: [
            { role: 'system', content: combinedInstructions + formatInstruction },
            { role: 'user', content: finalUserContent }
          ],
          model: currentModelName || 'llama-3.3-70b-versatile',
          temperature: 0.1,
          response_format: { type: "json_object" }
        });
        text = response.choices[0]?.message?.content || '{"violations":[]}';
      } else {
        const result = await model.generateContent(`${combinedInstructions}${formatInstruction}\n\n${finalUserContent}`);
        text = result.response.text();
      }

      console.log(`[agents.ts] Grouped response:`, text.substring(0, 200));
      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || '{"violations":[]}';
      const parsed = JSON.parse(jsonStr);
      const violations = Array.isArray(parsed.violations) ? parsed.violations : [];

      // Update UI for all agents
      for (const agentName of agentsToRun) {
        onProgress?.(`${agentName} terminé.`);
      }

      return violations;
    } catch (e) {
      console.error(`[agents.ts] Erreur analyse groupée:`, e);
      throw e;
    }
  }

  // --- MODE SÉQUENTIEL (Original Logic) ---
  const results = [];
  for (const agentName of agentsToRun) {
    const prompt = AGENT_PROMPTS[agentName as keyof typeof AGENT_PROMPTS] || customAgents[agentName];
    if (!prompt) continue;
    
    onProgress?.(`Analyse avec ${agentName}...`);
    try {
      let text = '';
      const formatInstruction = "\n\nCRITIQUE: Analyse le code de manière objective. Ne retourne des violations QUE si elles sont réellement justifiées. Si le code est de bonne qualité, retourne un tableau vide. Pour chaque violation, le chemin complet du fichier est OBLIGATOIRE.\nJSON attendu : {\"violations\": [{ \"file\": string, \"line\": number, \"severity\": \"error\"|\"warning\"|\"info\", \"message\": string, \"suggestion\": string }]}";
      const contextSection = fileContext ? `\n\nCONTEXTE DES FICHIERS COMPLETS MODIFIÉS :\n${fileContext}\n` : '';
      const finalUserContent = `${contextSection}\nCODE DIFF À ANALYSER :\n${diff}`;

      if (currentProvider === 'groq') {
        const response = await groqClient.chat.completions.create({
          messages: [
            { role: 'system', content: prompt + formatInstruction },
            { role: 'user', content: finalUserContent }
          ],
          model: currentModelName || 'llama-3.3-70b-versatile',
          temperature: 0.1,
          response_format: { type: "json_object" }
        });
        text = response.choices[0]?.message?.content || '{"violations":[]}';
      } else {
        const result = await model.generateContent(`${prompt}${formatInstruction}\n\n${finalUserContent}`);
        text = result.response.text();
      }
      
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
