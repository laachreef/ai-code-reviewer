import React, { useState, useEffect } from 'react';
import Modal from './Modal';

interface CustomProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProviderSaved: () => void;
  existingProviders: any[];
  removedProviders: string[];
}

export default function CustomProviderModal({ isOpen, onClose, onProviderSaved, existingProviders, removedProviders }: CustomProviderModalProps) {
  const [mode, setMode] = useState<'add' | 'manage'>('manage');
  const [form, setForm] = useState({ name: '', baseUrl: '', apiKey: '' });
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBaseUrlInfo, setShowBaseUrlInfo] = useState(false);
  const [verifiedModels, setVerifiedModels] = useState<string[] | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode('manage');
      setForm({ name: '', baseUrl: '', apiKey: '' });
      setError('');
      setSuccess('');
      setVerifiedModels(null);
      setIsVerified(false);
      setShowBaseUrlInfo(false);
    }
  }, [isOpen]);

  // Reset verification when form changes
  useEffect(() => {
    setIsVerified(false);
    setVerifiedModels(null);
    setSuccess('');
  }, [form.name, form.baseUrl, form.apiKey]);

  const handleVerify = async () => {
    if (!form.baseUrl.trim()) {
      setError('L\'URL de base est requise');
      return;
    }
    if (!form.apiKey.trim()) {
      setError('La clé API est requise');
      return;
    }

    setVerifying(true);
    setError('');
    setSuccess('');
    setVerifiedModels(null);

    try {
      const result = await (window as any).api.fetchModelsFromProvider(form.baseUrl.trim(), form.apiKey.trim());
      if (result.success && result.models && result.models.length > 0) {
        setVerifiedModels(result.models);
        setIsVerified(true);
        setSuccess(`Connexion réussie ! ${result.models.length} modèle(s) trouvé(s).`);
      } else {
        setError(result.error || 'Aucun modèle trouvé. Vérifiez l\'URL et la clé API.');
      }
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la vérification');
    } finally {
      setVerifying(false);
    }
  };

  const handleAdd = async () => {
    if (!form.name.trim()) {
      setError('Le nom du provider est requis');
      return;
    }
    if (!isVerified || !verifiedModels) {
      setError('Veuillez d\'abord vérifier la connexion');
      return;
    }

    try {
      const provider = {
        id: `custom_${Date.now()}`,
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        models: verifiedModels,
        apiKey: form.apiKey.trim()
      };

      await (window as any).api.addCustomProvider(provider);
      setSuccess('Provider ajouté avec succès !');
      setForm({ name: '', baseUrl: '', apiKey: '' });
      setVerifiedModels(null);
      setIsVerified(false);
      onProviderSaved();
    } catch (e: any) {
      setError(e.message || 'Erreur lors de l\'ajout');
    }
  };

  const handleRemoveProvider = async (provider: any, isCustom: boolean) => {
    const confirmMsg = isCustom
      ? `Êtes-vous sûr de vouloir supprimer "${provider.name}"? Cette action est irréversible.`
      : `Êtes-vous sûr de vouloir masquer "${provider.name}"? Vous pourrez le réactiver plus tard.`;

    if (!confirm(confirmMsg)) return;

    try {
      if (isCustom) {
        await (window as any).api.removeCustomProvider(provider.id);
      } else {
        await (window as any).api.removeDefaultProvider(provider.id);
      }
      onProviderSaved();
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la suppression');
    }
  };

  const customProviders = existingProviders.filter((p: any) => p.id.startsWith('custom_'));
  const defaultProviders = existingProviders.filter((p: any) => !p.id.startsWith('custom_') && !removedProviders.includes(p.id));
  const hiddenProviders = existingProviders.filter((p: any) => !p.id.startsWith('custom_') && removedProviders.includes(p.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gérer les providers IA" width="max-w-2xl" blockOutsideClick={true}>
      <div className="space-y-6">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => { setMode('manage'); setError(''); setSuccess(''); }}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${mode === 'manage' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Gérer les providers
          </button>
          <button
            onClick={() => { setMode('add'); setError(''); setSuccess(''); }}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${mode === 'add' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Ajouter un provider
          </button>
        </div>

        {mode === 'add' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Ajoutez un provider compatible OpenAI (Ollama, LM Studio, vLLM, etc.)
            </p>

            <label className="block text-sm font-semibold text-gray-700">
              Nom du provider
              <input
                type="text"
                placeholder="Ex: Ollama Local, Mon Serveur IA..."
                className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-900 transition-all font-medium"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <label className="block text-sm font-semibold text-gray-700">
              <div className="flex items-center gap-2">
                URL de base (Base URL)
                <button 
                  onClick={() => setShowBaseUrlInfo(!showBaseUrlInfo)}
                  className="cursor-pointer text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold transition-colors"
                  title="Qu'est-ce que l'URL de base ?"
                >
                  ?
                </button>
              </div>
              <input
                type="text"
                placeholder="http://localhost:11434/v1 ou https://api.monservice.com/v1"
                className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-900 transition-all font-mono"
                value={form.baseUrl}
                onChange={e => setForm({ ...form, baseUrl: e.target.value })}
              />
              
              {showBaseUrlInfo && (
                <div className="bg-slate-800 text-slate-50 text-xs p-4 rounded-xl shadow-inner mt-2 w-full animate-fade-in">
                  <p className="mb-2 text-slate-200">L'URL de base est le point d'entrée de l'API de votre provider IA. Elle doit être compatible avec le format de l'API OpenAI.</p>
                  <p className="font-bold text-white mb-1">📌 Exemples d'URL de base :</p>
                  <ul className="space-y-1.5 text-slate-200/90 ml-1">
                    <li><code className="bg-slate-700 px-1.5 py-0.5 rounded text-blue-300">http://localhost:11434/v1</code> — Ollama (local)</li>
                    <li><code className="bg-slate-700 px-1.5 py-0.5 rounded text-blue-300">http://localhost:1234/v1</code> — LM Studio (local)</li>
                    <li><code className="bg-slate-700 px-1.5 py-0.5 rounded text-blue-300">https://api.together.xyz/v1</code> — Together AI</li>
                    <li><code className="bg-slate-700 px-1.5 py-0.5 rounded text-blue-300">https://api.openai.com/v1</code> — OpenAI</li>
                  </ul>
                  <p className="mt-2 text-slate-300 italic">L'URL se termine généralement par <code className="bg-slate-700 px-1 rounded">/v1</code></p>
                </div>
              )}
            </label>

            <label className="block text-sm font-semibold text-gray-700">
              Clé API
              <input
                type="password"
                placeholder="Votre clé API (ou 'ollama' si local)"
                className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-gray-900 transition-all font-mono"
                value={form.apiKey}
                onChange={e => setForm({ ...form, apiKey: e.target.value })}
              />
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 text-sm font-semibold">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 p-3 rounded-xl flex items-start gap-2">
                <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-700 text-sm font-semibold">{success}</p>
              </div>
            )}

            {/* Models found after verification */}
            {verifiedModels && verifiedModels.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Modèles disponibles ({verifiedModels.length})
                </h4>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {verifiedModels.map((model: string) => (
                    <span key={model} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-lg font-mono">
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 3 buttons aligned */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
              >
                Fermer
              </button>
              <button
                onClick={handleVerify}
                disabled={verifying || !form.baseUrl.trim() || !form.apiKey.trim()}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-500/20"
              >
                {verifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Vérification...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Vérifier
                  </>
                )}
              </button>
              <button
                onClick={handleAdd}
                disabled={!isVerified || !form.name.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-600/30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter
              </button>
            </div>
          </div>
        )}

        {mode === 'manage' && (
          <div className="space-y-4">
            {defaultProviders.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-2">Providers par défaut</h4>
                <div className="space-y-2">
                  {defaultProviders.map((provider: any) => (
                    <div key={provider.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <span className="font-semibold text-gray-800">{provider.name}</span>
                        <span className="text-xs text-gray-500 ml-2">{provider.models.length} modèle(s)</span>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded-full font-bold uppercase">Par défaut</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customProviders.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-2">Providers personnalisés</h4>
                <div className="space-y-2">
                  {customProviders.map((provider: any) => (
                    <div key={provider.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <div>
                        <span className="font-semibold text-gray-800">{provider.name}</span>
                        <span className="text-xs text-gray-500 ml-2 font-mono">{provider.baseUrl}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveProvider(provider, true)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                        title="Supprimer ce provider"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}



            {defaultProviders.length === 0 && customProviders.length === 0 && (
              <p className="text-center text-gray-500 py-4">Aucun provider disponible</p>
            )}
          </div>
        )}

        {/* Footer close button only for manage mode */}
        {mode === 'manage' && (
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
