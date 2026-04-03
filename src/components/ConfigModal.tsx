import React, { useState, useEffect } from 'react';
import Modal from './Modal';

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

  // Initialiser la forme uniquement quand le modale s'ouvre, pour avoir les données fraîches
  useEffect(() => {
    if (isOpen && initialConfig) {
      setForm({
        platform: initialConfig.platform || 'github',
        token: initialConfig.token || '',
        ngrokToken: initialConfig.ngrokToken || '',
        llmProvider: initialConfig.llmProvider || 'gemini',
        llmModel: initialConfig.llmModel || 'gemini-2.5-flash',
        llmApiKey: initialConfig.llmApiKey || initialConfig.geminiKey || ''
      });
      setError('');
    }
  }, [isOpen, initialConfig]);

  const handleSave = async () => {
    if (!form.token) {
      setError('Veuillez renseigner un token API Git.');
      return;
    }
    setIsValidating(true);
    setError('');
    try {
      const isValid = await (window as any).api.verifyToken(form.platform, form.token);
      if (!isValid) {
        setError('Token Git invalide ou droits insuffisants.');
        setIsValidating(false);
        return;
      }
      const isLlmValid = await (window as any).api.verifyLlmToken(form.llmProvider, form.llmApiKey);
      if (!isLlmValid) {
        setError(`Clé API ${form.llmProvider === 'groq' ? 'Groq' : 'Gemini'} invalide. Vérifiez votre clé.`);
        setIsValidating(false);
        return;
      }
      const newConfig = { ...(initialConfig || {}), ...form };
      await (window as any).api.saveConfig(newConfig);
      onComplete(newConfig);
    } catch (e) {
      setError('Erreur lors de la validation.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configuration" width="max-w-2xl" blockOutsideClick={true}>
      <div className="space-y-8">
        <p className="text-gray-500 text-sm">Configurez vos accès Git, votre constructeur d'IA et optionnellement les webhooks.</p>

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
              </select>
            </label>

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
          </div>
        </div>

        {/* ─── Section 2 : IA ─── */}
        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
          <h3 className="text-xs font-black uppercase tracking-widest text-blue-800 mb-4 flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-sm shadow-blue-200">2</span>
            Intelligence Artificielle
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <label className="block text-sm font-semibold text-gray-700">
              Fournisseur
              <select
                className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-900 transition-all font-medium"
                value={form.llmProvider}
                onChange={e => {
                  const p = e.target.value;
                  setForm({ ...form, llmProvider: p, llmModel: p === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-2.5-flash' });
                }}
              >
                <option value="gemini">Google Gemini</option>
                <option value="groq">Groq</option>
              </select>
            </label>

            <label className="block text-sm font-semibold text-gray-700">
              Modèle
              <select
                className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-900 transition-all font-medium"
                value={form.llmModel}
                onChange={e => setForm({ ...form, llmModel: e.target.value })}
              >
                {form.llmProvider === 'gemini' ? (
                  <>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  </>
                ) : (
                  <>
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B</option>
                    <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                    <option value="gemma2-9b-it">Gemma 2 9B</option>
                  </>
                )}
              </select>
            </label>
          </div>

          <label className="block text-sm font-semibold text-gray-700">
            Clé API ({form.llmProvider === 'groq' ? 'Groq' : 'Google Gemini'}) <span className="text-red-500">*</span>
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
                : <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-600 hover:text-blue-800 hover:underline">aistudio.google.com</a>
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
  );
}
