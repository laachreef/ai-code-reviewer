import React, { useState, useEffect, useRef, useContext } from 'react';
import { ThemeContext } from '../App';
import AgentManager from './AgentManager';
import AnalysisConfigModal from './AnalysisConfigModal';
import HistoryModal from './HistoryModal';
import AboutModal from './AboutModal';
import ConfigModal from './ConfigModal';

interface DashboardProps {
  config: any;
  setConfig: (c: any) => void;
  onRunReview: (repoId: string, prId: number, selectedAgents: string[], selectedFilesForContext: string[], minSeverity: string, strategy: 'grouped' | 'sequential') => void;
  reviewProgress: string;
  agentStatuses: {[key: string]: 'waiting' | 'in-progress' | 'completed' | 'error'};
  lastHistoryId?: string | null;
}

export default function Dashboard({ config, setConfig, onRunReview, reviewProgress, agentStatuses, lastHistoryId }: DashboardProps) {
  const { isDark, toggleDark } = useContext(ThemeContext);
  const [repoId, setRepoId] = useState('');
  const [prId, setPrId] = useState<string | number>('');
  const [prTitle, setPrTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Modals state
  const [showAgentManager, setShowAgentManager] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(!config);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showAnalysisConfigModal, setShowAnalysisConfigModal] = useState(false);
  
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);

  const progressRef = useRef<HTMLDivElement>(null);
  const analysisCardRef = useRef<HTMLDivElement>(null);

  const [webhookStatus, setWebhookStatus] = useState<{status: string, url: string|null}|null>(null);

  const [globalPendingData, setGlobalPendingData] = useState<{ total: number, repos: { repoId: string, prs: { id: number|string, title: string, createdAt: string, author: string }[] }[] } | null>(null);
  const [loadingGlobalCount, setLoadingGlobalCount] = useState(false);

  useEffect(() => {
    loadAgents();
  }, [config]);

  useEffect(() => {
    if ((window as any).api?.onWebhookStatus) {
      (window as any).api.onWebhookStatus((data: any) => {
        setWebhookStatus(data);
      });
    }
    if ((window as any).api?.onWebhookPrReceived) {
      (window as any).api.onWebhookPrReceived((data: {prId: string, repoId: string, title: string}) => {
        loadGlobalPendingPRs();
        alert(`Nouvelle PR Webhook reçue :\nProjet: ${data.repoId}\nPR #${data.prId}`);
      });
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  const loadGlobalPendingPRs = async () => {
    setLoadingGlobalCount(true);
    try {
      const data = await (window as any).api.getAllPendingPRsCount();
      setGlobalPendingData(data);
    } catch (e) { console.error(e); }
    setLoadingGlobalCount(false);
  };

  useEffect(() => { loadGlobalPendingPRs(); }, [config]);

  const loadAgents = async () => {
    const defaultAgents = [
      { id: 'cleanArchitecture', name: 'Clean Architecture', description: 'Vérifie la séparation des couches et le Dependency Inversion' },
      { id: 'solid', name: 'SOLID Principles', description: 'Analyse les principes SOLID (SRP, OCP, LSP, ISP, DIP)' },
      { id: 'testing', name: 'Testing & QA', description: 'Vérifie les tests unitaires et les edge cases' },
      { id: 'security', name: 'Security (OWASP)', description: 'Cherche des failles de sécurité (SQLi, XSS, secrets)' }
    ];
    try {
      const currentConfig = await (window as any).api.getConfig();
      const customAgents = currentConfig.agents || [];
      const allAgents = [...defaultAgents, ...customAgents.map((a: any) => ({ id: a.id, name: a.name, description: a.description }))];
      setAvailableAgents(allAgents);
      setSelectedAgents(allAgents.map(a => a.id));
    } catch {
      setAvailableAgents(defaultAgents);
      setSelectedAgents(defaultAgents.map(a => a.id));
    }
  };

  const selectPR = (repo: string, pr: any) => {
    setRepoId(repo);
    setPrId(pr.id.toString());
    setPrTitle(pr.title);
    
    // Scroll vers la carte d'analyse pour montrer qu'elle est sélectionnée
    setTimeout(() => {
      analysisCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const startReview = async () => {
    if (!repoId || (config?.platform !== 'local' && !prId)) {
      alert(config?.platform === 'local' ? 'Veuillez sélectionner un dossier local.' : 'Veuillez sélectionner une PR dans la liste ci-dessus.');
      return;
    }
    if (selectedAgents.length === 0) {
      alert('Veuillez sélectionner au moins un agent.');
      return;
    }
    setShowAnalysisConfigModal(true);
  };

  const handleConfirmReview = async (selectedFilesForContext: string[], minSeverity: string, strategy: 'grouped' | 'sequential') => {
    setShowAnalysisConfigModal(false);
    setLoading(true);
    setElapsedTime(0);
    setTimeout(() => {
      progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    try {
      await onRunReview(repoId, Number(prId), selectedAgents, selectedFilesForContext, minSeverity, strategy);
    } catch (error) {
      alert('Erreur: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReview = async () => {
    if (!loading) return;
    try {
      await (window as any).api.cancelReview();
      setLoading(false);
    } catch (e) {
      console.error("Cancel failed", e);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header - Modernisé et organisé */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
          <div className="flex items-center gap-4">
            <img src="./icon.png" alt="Logo" className="w-12 h-12 rounded-full shadow-md border border-gray-50 dark:border-slate-600" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">AI Code Reviewer</h1>
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Dashboard</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mt-0.5">Analysez automatiquement vos pull requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAgentManager(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all font-semibold text-sm shadow-sm"
            >
              🤖 Agents
            </button>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all font-semibold text-sm shadow-sm"
            >
              📜 Historique
            </button>
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all font-semibold text-sm shadow-sm"
            >
              ⚙️ Config
            </button>
            <button
              onClick={() => setShowAboutModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all font-semibold text-sm shadow-sm"
            >
              ℹ️ À propos
            </button>
            <button
              onClick={toggleDark}
              className="flex items-center justify-center w-10 h-10 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-amber-300 border border-slate-200 dark:border-slate-600 rounded-xl transition-all shadow-sm ml-2"
              title={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Local Folder Selector or Global PRs Stats */}
        {config?.platform === 'local' ? (
          <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden p-8 animate-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col items-center justify-center text-center gap-4">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">Analyse de Dépôt Local</h2>
                <p className="text-gray-500 mt-2 max-w-lg mx-auto">
                  Analysez toutes vos modifications locales (qu'elles soient stagées ou non) d'un seul clic. Idéal avant de créer votre commit ! Aucune clé d'API requise.
                </p>
              </div>
              
              <div className="mt-4 flex flex-col items-center gap-3 w-full max-w-md">
                <button
                  onClick={async () => {
                    const dir = await (window as any).api.selectLocalDirectory();
                    if (dir) {
                      setRepoId(dir);
                      setPrId(0);
                      setPrTitle('Modifications Locales');
                    }
                  }}
                  className="px-8 py-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-3 text-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Choisir un dossier Git local
                </button>
                
                {repoId && (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-mono text-slate-700 truncate" title={repoId}>{repoId}</span>
                    </div>
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold uppercase shrink-0">Prêt</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-orange-100 overflow-hidden">
            {/* Header de la tuile */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-3xl font-black text-gray-900">
                  {loadingGlobalCount ? (
                    <div className="h-9 w-12 bg-gray-200 rounded-lg animate-pulse"></div>
                  ) : (
                    globalPendingData?.total ?? '--'
                  )}
                </div>
                <div className="text-sm text-gray-500 font-medium uppercase tracking-wider">PRs / MRs en attente — cliquez pour analyser</div>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-200 flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Connecté
              </span>
            </div>
          </div>

          {/* Corps : liste des repos avec PRs */}
          <div className="p-6">
            {loadingGlobalCount ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : !globalPendingData || globalPendingData.repos.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium">Aucune PR en attente 🎉</p>
              </div>
            ) : (
              <div className="space-y-4">
                {globalPendingData.repos.map((repo: any) => (
                  <div key={repo.repoId} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b border-gray-100">
                      <svg className="w-4 h-4 text-gray-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      <span className="text-sm font-bold text-gray-700 truncate">{repo.repoId}</span>
                      <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold ml-auto">{repo.prs.length}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {repo.prs.map((pr: any) => (
                        <div 
                          key={pr.id} 
                          onClick={() => selectPR(repo.repoId, pr)}
                          className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-all ${
                            (repoId === repo.repoId && prId === pr.id.toString()) 
                            ? 'bg-blue-50 border-l-4 border-blue-500 pl-3' 
                            : 'hover:bg-orange-50 pl-4'
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-orange-600 shrink-0">#{pr.id}</span>
                              <span className="text-sm font-medium text-gray-800 truncate">{pr.title}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-blue-600 font-medium">👤 {pr.author}</span>
                              <span className="text-[10px] text-gray-400">
                                📅 {new Date(pr.createdAt).toLocaleDateString('fr-FR')} {new Date(pr.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 ml-4">
                            <button className={`text-xs font-bold px-3 py-1 rounded-lg transition-all ${
                              (repoId === repo.repoId && prId === pr.id.toString())
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600'
                            }`}>
                              Sélectionner
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Main Action Card — Simplifiée */}
        <div ref={analysisCardRef} className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 scroll-mt-6 transition-all duration-500">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{config?.platform === 'local' ? 'Dépôt local sélectionné' : 'PR/MR sélectionnée'}</h3>
          </div>

          {!repoId ? (
            <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <p className="text-gray-500 italic">
                {config?.platform === 'local' 
                  ? 'Sélectionnez un dossier local via le bouton ci-dessus pour commencer l\'analyse.' 
                  : 'Sélectionnez une Pull Request dans la liste ci-dessus pour commencer l\'analyse.'}
              </p>
            </div>
          ) : (
            <div className="bg-blue-50 rounded-2xl p-6 mb-8 border border-blue-100 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider">Sélectionné</span>
                  <span className="text-sm font-bold text-blue-900 truncate">{repoId}</span>
                </div>
                <h4 className="text-lg font-black text-blue-800 truncate">PR #{prId} : {prTitle}</h4>
              </div>
              <button 
                onClick={() => {setRepoId(''); setPrId('');}}
                className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors ml-4"
              >
                Annuler
              </button>
            </div>
          )}

          {/* Agent Management — Toujours visible si une PR est sélectionnée */}
          {repoId && (
            <>
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Agents d'analyse</h4>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedAgents(availableAgents.map((a: any) => a.id))}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium border border-gray-200"
                    >
                      Tout sélectionner
                    </button>
                    <button
                      onClick={() => setSelectedAgents([])}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium border border-gray-200"
                    >
                      Tout désélectionner
                    </button>
                    <button
                      onClick={() => setShowAgentManager(true)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Configuration des agents
                    </button>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {availableAgents.map((agent: any) => (
                    <label key={agent.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={selectedAgents.includes(agent.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedAgents([...selectedAgents, agent.id]);
                          else setSelectedAgents(selectedAgents.filter(id => id !== agent.id));
                        }}
                        className="w-5 h-5 text-blue-600 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{agent.name}</div>
                        <div className="text-sm text-gray-600 mt-1">{agent.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-center">
                <button
                  onClick={startReview}
                  disabled={loading || selectedAgents.length === 0}
                  className="px-12 py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Analyse en cours... {reviewProgress}
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Configurer l'analyse
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Webhook Status */}
          {webhookStatus && (
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div className="text-sm">
                <p className="font-semibold text-blue-800">{webhookStatus.status}</p>
                {webhookStatus.url && (
                  <p className="text-blue-700 mt-1">
                    Payload URL : <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900 font-mono select-all">{webhookStatus.url}</code>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Progress Section — scrollTarget */}
        {loading && (
          <div ref={progressRef} className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 scroll-mt-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900">Progression de l'analyse</h4>
                  <p className="text-sm font-medium text-blue-600 font-mono mt-0.5">⏱ Temps écoulé : {formatTime(elapsedTime)}</p>
                </div>
              </div>
              <button 
                onClick={handleCancelReview}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl font-bold flex items-center gap-2 transition-colors"
                title="Annuler l'analyse en cours"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Annuler
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {selectedAgents.map(agentId => {
                const agent = availableAgents.find((a: any) => a.id === agentId);
                const status = agentStatuses[agentId] || 'waiting';
                return (
                  <div key={agentId} className={`p-5 rounded-2xl border-2 transition-all duration-500 relative overflow-hidden ${
                    status === 'waiting' ? 'border-slate-100 bg-slate-50 opacity-60' :
                    status === 'in-progress' ? 'border-indigo-300 bg-indigo-50 shadow-md' :
                    status === 'completed' ? 'border-emerald-300 bg-emerald-50' :
                    'border-red-300 bg-red-50'
                  }`}>
                    {/* Background Animation for In-Progress */}
                    {status === 'in-progress' && (
                      <div className="absolute inset-0 opacity-10 bg-indigo-400 animate-pulse" />
                    )}

                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          status === 'waiting' ? 'bg-slate-200 text-slate-400' :
                          status === 'in-progress' ? 'bg-indigo-600 text-white shadow-lg animate-pulse' :
                          status === 'completed' ? 'bg-emerald-500 text-white' :
                          'bg-red-500 text-white'
                        }`}>
                          {status === 'completed' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : status === 'error' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <span className={`font-bold uppercase tracking-tight ${status === 'waiting' ? 'text-slate-400' : 'text-slate-900'}`}>{agent?.name || agentId}</span>
                      </div>

                      <div className="flex items-center">
                        {status === 'waiting' && <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">En attente...</span>}
                        {status === 'in-progress' && (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-ping"></div>
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">Analyse...</span>
                          </div>
                        )}
                        {status === 'completed' && (
                           <div className="flex items-center gap-1 text-emerald-600 animate-in zoom-in duration-300">
                             <span className="text-[10px] font-black uppercase tracking-widest">Terminé ✓</span>
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <AgentManager isOpen={showAgentManager} onClose={() => { setShowAgentManager(false); loadAgents(); }} />
        <HistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} />
        <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />
        <ConfigModal 
          isOpen={showConfigModal} 
          onClose={() => {
            if (!config) alert('Configuration initiale requise pour utiliser l\'app.');
            else setShowConfigModal(false);
          }} 
          onComplete={cfg => {
            setConfig(cfg);
            setShowConfigModal(false);
          }}
          initialConfig={config}
        />
        
        <AnalysisConfigModal 
          isOpen={showAnalysisConfigModal} 
          onClose={() => setShowAnalysisConfigModal(false)}
          onConfirm={handleConfirmReview}
          repoId={repoId}
          prId={Number(prId)}
        />
      </div>
    </div>
  );
}
