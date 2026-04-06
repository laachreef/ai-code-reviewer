import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import CustomProviderModal from './CustomProviderModal';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (config: any) => void;
  initialConfig?: any;
}

export default function ConfigModal({ isOpen, onClose, onComplete, initialConfig }: ConfigModalProps) {
  const [form, setForm] = useState({ 
    platform: 'github', 
    token: '', 
    ngrokToken: '', 
    llmProvider: 'gemini',
    llmModel: 'gemini-2.5-flash',
    llmApiKey: '' 
  });

  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [showNgrokInfo, setShowNgrokInfo] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [allProviders, setAllProviders] = useState<any[]>([]);
  const [removedProviders, setRemovedProviders] = useState<string[]>([]);
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProviders();
    }
  }, [isOpen]);

  const loadProviders = async () => {
    try {
      const providers = await (window as any).api.getAllProviders();
      setAllProviders(providers);
      const removed = await (window as any).api.getRemovedProviders();
      setRemovedProviders(removed);
    } catch (e) {
      console.error('Failed to load providers:', e);
    }
  };

  useEffect(() => {
    if (isOpen && initialConfig) {
      let apiKey = initialConfig.llmApiKey || initialConfig.geminiKey || '';
      if (initialConfig.customProviders && initialConfig.customProviders.length > 0) {
        const customProvider = initialConfig.customProviders.find((p: any) => p.id === (initialConfig.llmProvider || 'gemini'));
        if (customProvider && customProvider.apiKey) {
          apiKey = customProvider.apiKey;
        }
      }
      const providerId = initialConfig.llmProvider || 'gemini';
      setForm({
        platform: initialConfig.platform || 'github',
        token: initialConfig.token || '',
        ngrokToken: initialConfig.ngrokToken || '',
        llmProvider: providerId,
        llmModel: initialConfig.llmModel || 'gemini-2.5-flash',
        llmApiKey: apiKey
      });
      setError('');
      // Load models for the initial provider
      loadModelsForProvider(providerId);
    }
  }, [isOpen, initialConfig]);

  const loadModelsForProvider = async (providerId: string) => {
    setLoadingModels(true);
    try {
      const result = await (window as any).api.fetchProviderModelsById(providerId);
      if (result.success && result.models) {
        setProviderModels(result.models);
      } else {
        // Fallback: try to find in allProviders
        const provider = allProviders.find((p: any) => p.id === providerId);
        if (provider?.models?.length > 0) {
          setProviderModels(provider.models);
        } else {
          setProviderModels([]);
        }
      }
    } catch (e) {
      console.error('Error loading models:', e);
      // Fallback to local data
      const provider = allProviders.find((p: any) => p.id === providerId);
      setProviderModels(provider?.models || []);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleProviderChange = async (providerId: string) => {
    let apiKey = form.llmApiKey;
    // Re-read config to get fresh customProviders (may have been added during this session)
    try {
      const freshConfig = await (window as any).api.getConfig();
      if (freshConfig?.customProviders) {
        const customProvider = freshConfig.customProviders.find((p: any) => p.id === providerId);
        if (customProvider && customProvider.apiKey) {
          apiKey = customProvider.apiKey;
        }
      }
    } catch (e) {
      // Fallback to initialConfig
      if (initialConfig?.customProviders) {
        const customProvider = initialConfig.customProviders.find((p: any) => p.id === providerId);
        if (customProvider && customProvider.apiKey) {
          apiKey = customProvider.apiKey;
        }
      }
    }
    setForm({ ...form, llmProvider: providerId, llmModel: '', llmApiKey: apiKey });
    await loadModelsForProvider(providerId);
  };

  // When models are loaded, auto-select the first one only if current model isn't in the list
  useEffect(() => {
    if (providerModels.length > 0) {
      setForm(f => {
        if (!providerModels.includes(f.llmModel)) {
          return { ...f, llmModel: providerModels[0] };
        }
        return f;
      });
    }
  }, [providerModels]);

  const handleProviderSaved = async () => {
    await loadProviders();
  };

  const currentProvider = allProviders.find((p: any) => p.id === form.llmProvider);

  const handleSave = async () => {
    if (form.platform !== 'local' && !form.token) {
      setError('Veuillez renseigner un token API Git.');
      return;
    }
    setIsValidating(true);
    setError('');
    try {
      if (form.platform !== 'local') {
        const isValid = await (window as any).api.verifyToken(form.platform, form.token);
        if (!isValid) {
          setError('Token Git invalide ou droits insuffisants.');
          setIsValidating(false);
          return;
        }
      }
      const isLlmValid = await (window as any).api.verifyLlmToken(form.llmProvider, form.llmApiKey);
      if (!isLlmValid) {
        const providerName = currentProvider?.name || form.llmProvider;
        setError(`Clé API ${providerName} invalide. Vérifiez votre clé.`);
        setIsValidating(false);
        return;
      }
      // Re-read current config to preserve customProviders/agents added during this session
      const freshConfig = await (window as any).api.getConfig() || {};
      const newConfig = { ...freshConfig, ...form };
      await (window as any).api.saveConfig(newConfig);
      onComplete(newConfig);
    } catch (e) {
      setError('Erreur lors de la validation.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Configuration" width="max-w-2xl" blockOutsideClick={true}>
        <div className="space-y-8">
          <p className="text-gray-500 text-sm">Configurez vos accès Git, votre provider d'IA et optionnellement les webhooks.</p>

          {/* ─── Section 1 : Git ─── */}
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2">
              <span className="bg-slate-800 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-sm">1</span>
              Authentification Git
            </h3>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">
                Plateforme
                <select
                  className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-900 transition-all font-medium"
                  value={form.platform}
                  onChange={e => setForm({ ...form, platform: e.target.value })}
                >
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                  <option value="local">📁 Local</option>
                </select>
              </label>

              {form.platform !== 'local' && (
                <label className="block text-sm font-semibold text-gray-700">
                  Token API Git <span className="text-red-500">*</span>
                  <input
                    type="password"
                    placeholder={form.platform === 'github' ? 'ghp_...' : 'glpat-...'}
                    className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-900 transition-all font-mono"
                    value={form.token}
                    onChange={e => setForm({ ...form, token: e.target.value })}
                  />
                  <span className="text-[11px] font-medium text-gray-500 mt-1.5 block">
                    {form.platform === 'github'
                      ? <a href="https://github.com/settings/tokens" target="_blank" className="text-blue-600 hover:text-blue-800 hover:underline">github.com → Settings → Developer settings → Personal access tokens</a>
                      : <a href="https://gitlab.com/-/profile/personal_access_tokens" target="_blank" className="text-blue-600 hover:text-blue-800 hover:underline">GitLab → Preferences → Access Tokens</a>
                    }
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* ─── Section 2 : IA ─── */}
          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-800 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-sm shadow-blue-200">2</span>
                Intelligence Artificielle
              </span>
              <button
                onClick={() => setShowProviderModal(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                title="Gérer les providers IA"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Gérer les providers
              </button>
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <label className="block text-sm font-semibold text-gray-700">
                Provider
                <select
                  className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-900 transition-all font-medium"
                  value={form.llmProvider}
                  onChange={e => handleProviderChange(e.target.value)}
                >
                  {allProviders
                    .filter((p: any) => !removedProviders.includes(p.id))
                    .map((provider: any) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-gray-700">
                Modèle
                {loadingModels ? (
                  <div className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 flex items-center gap-2 text-gray-400">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                    Chargement des modèles...
                  </div>
                ) : (
                  <select
                    className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-900 transition-all font-medium"
                    value={form.llmModel}
                    onChange={e => setForm({ ...form, llmModel: e.target.value })}
                  >
                    {providerModels.map((model: string) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                    {providerModels.length === 0 && (
                      <option value="">Aucun modèle disponible</option>
                    )}
                  </select>
                )}
              </label>
            </div>

            <label className="block text-sm font-semibold text-gray-700">
              Clé API ({currentProvider?.name || form.llmProvider}) <span className="text-red-500">*</span>
              <input
                type="password"
                placeholder="Votre clé API..."
                className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-900 transition-all font-mono"
                value={form.llmApiKey}
                onChange={e => setForm({ ...form, llmApiKey: e.target.value })}
              />
              <span className="text-[11px] font-medium text-gray-500 mt-1.5 block">
                {form.llmProvider === 'groq'
                  ? <a href="https://console.groq.com/keys" target="_blank" className="text-blue-600 hover:text-blue-800 hover:underline">console.groq.com/keys</a>
                  : form.llmProvider === 'gemini'
                    ? <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-600 hover:text-blue-800 hover:underline">aistudio.google.com</a>
                    : currentProvider?.baseUrl
                      ? <span className="text-gray-500">URL: {currentProvider.baseUrl}</span>
                      : ''
                }
              </span>
            </label>
          </div>

          {/* ─── Section 3 : Webhooks / Ngrok ─── */}
          <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 relative group">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-800 mb-2 flex items-center gap-2">
              <span className="bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-sm shadow-emerald-200">3</span>
              Webhooks <span className="text-emerald-600/70 font-bold normal-case text-[10px]">(Optionnel)</span>
              <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ml-2">Version beta</span>
            </h3>
            
            <div className="flex flex-col gap-2 ml-8 mb-4">
              <div className="flex items-center gap-2">
                <p className="text-emerald-700/80 text-xs font-medium">
                  Nécessaire uniquement si vous souhaitez que GitHub/GitLab notifie automatiquement l'app.
                </p>
                <button 
                  onClick={() => setShowNgrokInfo(!showNgrokInfo)}
                  className="cursor-pointer text-emerald-600 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold transition-colors"
                  title="Comment configurer ?"
                >
                  ?
                </button>
              </div>
              
              {showNgrokInfo && (
                <div className="bg-emerald-900 text-emerald-50 text-xs p-4 rounded-xl shadow-inner mt-2 w-full animate-fade-in">
                  <p className="mb-2 text-emerald-100">Pour que GitHub/GitLab détecte automatiquement vos nouvelles PRs et notifie cette app, il faut une URL publique. Ngrok expose votre port local sur Internet via un tunnel sécurisé et gratuit.</p>
                  <p className="font-bold text-white mb-1">📌 Comment obtenir votre authtoken ngrok :</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-emerald-100/90 ml-1">
                    <li>Créez un compte gratuit sur <a href="https://ngrok.com" target="_blank" className="underline hover:text-white">ngrok.com</a></li>
                    <li>Dashboard → Your Authtoken → copiez le token</li>
                    <li>Collez-le dans le champ ci-dessous et sauvegardez</li>
                    <li>L'URL générée s'affichera dans le Dashboard</li>
                    <li>Configurez-la dans GitHub/GitLab (Payload URL)</li>
                  </ol>
                </div>
              )}
            </div>

            <label className="block text-sm font-semibold text-gray-700">
              Token Ngrok
              <input
                type="password"
                placeholder="2abc...xyz (votre authtoken ngrok)"
                className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-gray-900 transition-all font-mono"
                value={form.ngrokToken}
                onChange={e => setForm({ ...form, ngrokToken: e.target.value })}
              />
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 text-sm font-semibold">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isValidating}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-600/30"
            >
              {isValidating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Vérification...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      <CustomProviderModal
        isOpen={showProviderModal}
        onClose={() => setShowProviderModal(false)}
        onProviderSaved={handleProviderSaved}
        existingProviders={allProviders}
        removedProviders={removedProviders}
      />
    </>
  );
}
