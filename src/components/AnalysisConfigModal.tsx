import React, { useState, useEffect, useMemo } from 'react';

interface AnalysisConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedFiles: string[], minSeverity: string, strategy: 'grouped' | 'sequential') => void;
  repoId: string;
  prId: number;
}

interface RepoFile {
  path: string;
  size: number;
}

interface TreeItem {
  id: string; // full path
  name: string;
  type: 'file' | 'folder';
  children: TreeItem[];
  size: number;
  isModified: boolean;
}

const buildFileTree = (files: RepoFile[], prFiles: string[]): TreeItem => {
  const root: TreeItem = { id: '', name: 'root', type: 'folder', children: [], size: 0, isModified: false };

  files.forEach(file => {
    const parts = file.path.split('/');
    let current = root;
    
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join('/');
      
      let child = current.children.find(c => c.name === part);
      if (!child) {
        child = {
          id: path,
          name: part,
          type: isLast ? 'file' : 'folder',
          children: [],
          size: isLast ? file.size : 0,
          isModified: prFiles.includes(path)
        };
        current.children.push(child);
        current.children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      }
      current = child;
    });
  });

  return root;
};

const getAllFilesUnder = (node: TreeItem): string[] => {
  if (node.type === 'file') return [node.id];
  return node.children.flatMap(child => getAllFilesUnder(child));
};

const FileTreeNode = ({ 
  node, 
  level, 
  selectedFiles, 
  onToggle, 
  expandedFolders, 
  onToggleExpand,
  searchTerm 
}: { 
  node: TreeItem, 
  level: number, 
  selectedFiles: string[], 
  onToggle: (ids: string[], forceState?: boolean) => void,
  expandedFolders: Set<string>,
  onToggleExpand: (id: string) => void,
  searchTerm: string
}) => {
  const isExpanded = expandedFolders.has(node.id) || searchTerm.length > 0;
  const filesUnder = useMemo(() => getAllFilesUnder(node), [node]);
  const allSelected = filesUnder.every(f => selectedFiles.includes(f));
  const someSelected = filesUnder.some(f => selectedFiles.includes(f)) && !allSelected;

  if (node.id === '') {
    return (
      <div className="space-y-0.5">
        {node.children.map(child => (
          <FileTreeNode 
            key={child.id} 
            node={child} 
            level={0} 
            selectedFiles={selectedFiles} 
            onToggle={onToggle}
            expandedFolders={expandedFolders}
            onToggleExpand={onToggleExpand}
            searchTerm={searchTerm}
          />
        ))}
      </div>
    );
  }

  const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase());
  const hasMatchingChildren = node.children.some(c => {
    const check = (n: TreeItem): boolean => n.name.toLowerCase().includes(searchTerm.toLowerCase()) || n.children.some(check);
    return check(c);
  });

  if (searchTerm && !matchesSearch && !hasMatchingChildren) return null;

  return (
    <div>
      <div 
        className={`flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors group cursor-pointer`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => node.type === 'folder' && onToggleExpand(node.id)}
      >
        {node.type === 'folder' ? (
          <svg 
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <div className="w-3.5" />
        )}

        <div className="relative flex items-center h-4" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={allSelected}
            ref={el => { if (el) el.indeterminate = someSelected; }}
            onChange={() => onToggle(filesUnder, !allSelected)}
            className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {node.type === 'folder' ? (
            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          )}
          <span className={`text-xs truncate ${node.isModified ? 'text-orange-600 font-bold' : 'text-slate-700'}`}>
            {node.name}
          </span>
        </div>
      </div>

      {node.type === 'folder' && isExpanded && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {node.children.map(child => (
            <FileTreeNode 
              key={child.id} 
              node={child} 
              level={level + 1} 
              selectedFiles={selectedFiles} 
              onToggle={onToggle}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function AnalysisConfigModal({ isOpen, onClose, onConfirm, repoId, prId }: AnalysisConfigModalProps) {
  const [prFiles, setPrFiles] = useState<string[]>([]);
  const [allFiles, setAllFiles] = useState<RepoFile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'fast' | 'deep'>('fast');
  const [minSeverity, setMinSeverity] = useState('info');
  const [strategy, setStrategy] = useState<'grouped' | 'sequential'>('grouped');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, repoId, prId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modified, total] = await Promise.all([
        (window as any).api.getPRFiles(repoId, prId),
        (window as any).api.getRepoFiles(repoId, prId)
      ]);
      setPrFiles(modified);
      setAllFiles(total);
      setSelectedFiles([]);
      setExpandedFolders(new Set()); 
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const fileTree = useMemo(() => buildFileTree(allFiles, prFiles), [allFiles, prFiles]);

  const totalTokens = useMemo(() => {
    if (mode === 'fast') return 0;
    const selectedSizes = allFiles.filter(f => selectedFiles.includes(f.path)).map(f => f.size);
    const totalBytes = selectedSizes.reduce((sum, s) => sum + s, 0);
    return Math.ceil(totalBytes / 4);
  }, [selectedFiles, allFiles, mode]);

  const fastModeTokens = useMemo(() => {
    const modifiedSizes = allFiles.filter(f => prFiles.includes(f.path)).map(f => f.size);
    const totalBytes = modifiedSizes.reduce((sum, s) => sum + s, 0);
    return Math.ceil(totalBytes / 4).toLocaleString();
  }, [allFiles, prFiles]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(mode === 'fast' ? [] : selectedFiles, minSeverity, strategy);
  };

  const handleToggleFiles = (ids: string[], forceState?: boolean) => {
    setSelectedFiles(prev => {
      const state = forceState === undefined ? !ids.every(id => prev.includes(id)) : forceState;
      if (state) {
        const newOnes = ids.filter(id => !prev.includes(id));
        return [...prev, ...newOnes];
      } else {
        return prev.filter(id => !ids.includes(id));
      }
    });
  };

  const handleToggleExpand = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        
        <div className="bg-gradient-to-r from-indigo-600 to-violet-700 px-8 py-6 text-white relative shrink-0">
          <h3 className="text-2xl font-bold">Configuration de l'Analyse</h3>
          <p className="text-indigo-100 mt-1 opacity-90 text-sm">PR #{prId} - {repoId}</p>
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200">
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => setMode('fast')}
              className={`relative flex flex-col items-center p-6 rounded-2xl border-2 transition-all ${
                mode === 'fast' 
                ? 'border-indigo-500 bg-indigo-50/50 shadow-inner' 
                : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${mode === 'fast' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 text-slate-500'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-bold text-slate-900">Analyse Rapide</span>
              <span className="text-[10px] text-slate-500 mt-2 text-center font-medium uppercase tracking-wider">Seulement les modifications</span>
            </button>

            <button
              onClick={() => setMode('deep')}
              className={`relative flex flex-col items-center p-6 rounded-2xl border-2 transition-all ${
                mode === 'deep' 
                ? 'border-indigo-500 bg-indigo-50/50 shadow-inner' 
                : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${mode === 'deep' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 text-slate-500'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="font-bold text-slate-900">Analyse Deep</span>
              <span className="text-[10px] text-slate-500 mt-2 text-center font-medium uppercase tracking-wider">Contexte Multi-fichiers</span>
            </button>
          </div>

          {mode === 'fast' ? (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Détails de l'analyse rapide</label>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 gap-3 flex flex-col">
                <div className="flex items-center gap-2 text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-semibold">{prFiles.length} fichiers modifiés détectés</span>
                </div>
                <div className="max-h-32 overflow-y-auto pr-2 scrollbar-thin">
                  {prFiles.map(path => (
                    <div key={path} className="text-[11px] text-slate-500 font-mono py-0.5 border-b border-slate-100 last:border-0 truncate">
                      {path}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Estimation du Diff</span>
                  <span className="text-[10px] text-amber-600 font-medium">Basé sur la taille totale des fichiers modifiés</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-amber-700">~{fastModeTokens}</span>
                  <span className="text-xs font-bold text-amber-400 ml-1">tokens</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Sélection des fichiers pour l'analyse Deep</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="Chercher un fichier..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                  />
                  <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl max-h-60 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-200">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-100 border-t-indigo-600"></div>
                  </div>
                ) : (
                  <FileTreeNode 
                    node={fileTree} 
                    level={0} 
                    selectedFiles={selectedFiles} 
                    onToggle={handleToggleFiles}
                    expandedFolders={expandedFolders}
                    onToggleExpand={handleToggleExpand}
                    searchTerm={searchTerm}
                  />
                )}
              </div>

              {selectedFiles.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Estimation du Contexte</span>
                    <span className="text-[10px] text-indigo-600 font-medium">{selectedFiles.length} fichiers sélectionnés</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-indigo-700">~{totalTokens.toLocaleString()}</span>
                    <span className="text-xs font-bold text-indigo-400 ml-1">tokens</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Configuration Avancée */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <button 
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex items-center justify-between w-full group"
            >
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest cursor-pointer group-hover:text-indigo-600 transition-colors">Configuration Avancée</label>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isAdvancedOpen && (
              <div className="mt-6 space-y-8 animate-in slide-in-from-top-2 duration-300">
                
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Stratégie d'Analyse</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setStrategy('grouped')}
                      className={`p-3.5 rounded-xl border-2 font-bold transition-all text-sm flex items-center gap-3 ${
                        strategy === 'grouped' 
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' 
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${strategy === 'grouped' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}>
                        🚀
                      </div>
                      <div className="text-left">
                        <div className="leading-tight">Appel Groupé</div>
                        <div className="text-[10px] opacity-70 font-medium uppercase tracking-tight mt-0.5">Optimisé & Rapide</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setStrategy('sequential')}
                      className={`p-3.5 rounded-xl border-2 font-bold transition-all text-sm flex items-center gap-3 ${
                        strategy === 'sequential' 
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' 
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${strategy === 'sequential' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}>
                        ⛓️
                      </div>
                      <div className="text-left">
                        <div className="leading-tight">Séquentiel</div>
                        <div className="text-[10px] opacity-70 font-medium uppercase tracking-tight mt-0.5">Détaillé par Agent</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Niveau de sévérité minimum</label>
                  <div className="flex gap-2">
                    {['info', 'warning', 'error'].map(level => (
                      <button
                        key={level}
                        onClick={() => setMinSeverity(level)}
                        className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all capitalize ${
                          minSeverity === level 
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' 
                          : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        {level === 'info' ? 'ℹ️ Info' : level === 'warning' ? '⚠️ Warning' : '🔴 Critique'}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          <div className="mt-10 flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all transform active:scale-95"
            >
              Retour
            </button>
            <button
              onClick={handleConfirm}
              disabled={mode === 'deep' && selectedFiles.length === 0}
              className={`flex-2 px-10 py-3.5 rounded-xl font-bold text-white shadow-xl transform active:scale-95 ${
                mode === 'fast' 
                ? 'bg-indigo-600 hover:bg-indigo-700' 
                : (selectedFiles.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300 cursor-not-allowed')
              }`}
            >
              🚀 Lancer l'analyse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
