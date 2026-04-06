import React, { useState, useEffect, createContext, useContext } from 'react';
import Dashboard from './components/Dashboard';
import ReviewReport from './components/ReviewReport';

export const ThemeContext = createContext({ isDark: false, toggleDark: () => {} });

export default function App() {
  const [config, setConfig] = useState<any>(null);
  const [currentReview, setCurrentReview] = useState<any>(null);
  const [reviewProgress, setReviewProgress] = useState<string>('');
  const [hasLoadedConfig, setHasLoadedConfig] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<{[key: string]: 'waiting' | 'in-progress' | 'completed' | 'error'}>({
    cleanArchitecture: 'waiting',
    solid: 'waiting',
    testing: 'waiting',
    security: 'waiting'
  });

  const [lastHistoryId, setLastHistoryId] = useState<string | null>(null);

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const toggleDark = () => setIsDark(!isDark);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    (window as any).api.getConfig().then((cfg: any) => {
      if (cfg && (cfg.llmApiKey || cfg.geminiKey)) {
        setConfig(cfg);
      }
      setHasLoadedConfig(true);
    });
    (window as any).api.onReviewReady((data: any) => {
      setCurrentReview(data);
      setReviewProgress('');
      setAgentStatuses({
        cleanArchitecture: 'waiting',
        solid: 'waiting',
        testing: 'waiting',
        security: 'waiting'
      });
    });
    (window as any).api.onReviewProgress((data: any) => {
      setReviewProgress(data.message);
      const msg = data.message;
      if (msg.includes('Analyse avec')) {
        const agent = msg.split(' ')[2].replace('...', '');
        setAgentStatuses(prev => ({ ...prev, [agent]: 'in-progress' }));
      } else if (msg.includes('terminé.')) {
        const agent = msg.split(' ')[0];
        setAgentStatuses(prev => ({ ...prev, [agent]: 'completed' }));
      } else if (msg.includes('Erreur')) {
        const agent = msg.split(' ')[1].replace(':', '');
        setAgentStatuses(prev => ({ ...prev, [agent]: 'error' }));
      }
    });
  }, []);

  const runReview = async (repoId: string, prId: number, selectedAgents: string[], selectedFilesForContext: string[], minSeverity: string, strategy: 'grouped' | 'sequential') => {
    setReviewProgress('Récupération du diff...');
    setAgentStatuses(Object.fromEntries(selectedAgents.map(agent => [agent, 'waiting' as const])));
    
    const startTime = Date.now();
    const result = await (window as any).api.runReview(repoId, prId, selectedAgents, selectedFilesForContext, minSeverity, strategy);
    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    const platform = typeof prId === 'number' && prId === 0 ? 'local' : 'remote';
    
    const historyItem = {
      id: Date.now().toString(),
      repoId,
      prId: result.prId || prId,
      date: new Date().toISOString(),
      action: platform === 'local' ? 'Analyse locale' : 'Analyse distante PR',
      status: 'success',
      duration,
      platform,
      agents: selectedAgents,
      violationsCount: result.violations?.length || 0,
      violations: result.violations
    };
    await (window as any).api.saveHistory(historyItem);
    
    setCurrentReview(result);
    setReviewProgress('');
  };

  if (!hasLoadedConfig) return null;

  if (currentReview) {
    return (
      <ThemeContext.Provider value={{ isDark, toggleDark }}>
        <ReviewReport
          review={currentReview}
          onDone={(historyId?: string) => {
            setCurrentReview(null);
            if (historyId) setLastHistoryId(historyId);
          }}
        />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleDark }}>
      <Dashboard
        config={config}
        setConfig={setConfig}
        onRunReview={runReview}
        reviewProgress={reviewProgress}
        agentStatuses={agentStatuses}
        lastHistoryId={lastHistoryId}
      />
    </ThemeContext.Provider>
  );
}
