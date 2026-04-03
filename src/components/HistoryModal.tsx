import React, { useState, useEffect } from 'react';
import Modal from './Modal';

interface HistoryItem {
  id: string;
  repoId: string;
  prId: string | number;
  action: string;
  date: string;
  violations?: number;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HistoryModal({ isOpen, onClose }: HistoryModalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'date' | 'repo'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      (async () => {
        try {
          const h = await (window as any).api.getHistory();
          setHistory(h || []);
        } catch (e) {
          console.error(e);
        }
        setLoading(false);
      })();
    }
  }, [isOpen]);

  const filtered = history
    .filter(item =>
      item.repoId?.toLowerCase().includes(search.toLowerCase()) ||
      item.action?.toLowerCase().includes(search.toLowerCase()) ||
      String(item.prId).includes(search)
    )
    .sort((a, b) => {
      if (sortKey === 'date') {
        return sortDir === 'desc'
          ? new Date(b.date).getTime() - new Date(a.date).getTime()
          : new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return sortDir === 'desc'
        ? b.repoId.localeCompare(a.repoId)
        : a.repoId.localeCompare(b.repoId);
    });

  const toggleSort = (key: 'date' | 'repo') => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const actionColor = (action: string) => {
    if (action.includes('merg') || action.includes('Merg')) return 'bg-green-100 text-green-800 border-green-200';
    if (action.includes('commentaire') || action.includes('Commentaire')) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Historique" width="max-w-4xl">
      <div className="space-y-6">
        {/* Search & Sort Bar */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher un projet, une PR, une action..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-shadow"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => toggleSort('date')}
              className={`px-4 py-2.5 text-sm rounded-lg border font-semibold transition-colors flex items-center gap-1.5 ${sortKey === 'date' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              Date {sortKey === 'date' && (sortDir === 'desc' ? '▾' : '▴')}
            </button>
            <button
              onClick={() => toggleSort('repo')}
              className={`px-4 py-2.5 text-sm rounded-lg border font-semibold transition-colors flex items-center gap-1.5 ${sortKey === 'repo' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              Projet {sortKey === 'repo' && (sortDir === 'desc' ? '▾' : '▴')}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium">Chargement de l'historique...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600 font-medium text-lg">Aucun résultat {search ? 'pour cette recherche' : ''}</p>
            {search && <button onClick={() => setSearch('')} className="mt-2 text-sm text-blue-600 font-bold hover:underline">Effacer le filtre</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md hover:border-blue-300 transition-all group">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner ${
                  item.action?.includes('merg') || item.action?.includes('Merg') ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {(item.action?.includes('merg') || item.action?.includes('Merg')) ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-lg font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{item.repoId}</span>
                    <span className="text-gray-300 text-sm font-bold">•</span>
                    <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2 rounded">PR #{item.prId}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${actionColor(item.action)} ml-2`}>
                      {item.action}
                    </span>
                  </div>
                  {item.violations !== undefined && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-xs font-semibold text-orange-600">{item.violations} violation(s) détectée(s)</p>
                    </div>
                  )}
                </div>

                {/* Date */}
                <div className="text-right shrink-0 bg-gray-50 border border-gray-100 rounded-lg p-2">
                  <div className="text-sm font-bold text-gray-700">{new Date(item.date).toLocaleDateString('fr-FR')}</div>
                  <div className="text-xs font-semibold text-gray-500 mt-0.5">{new Date(item.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <p className="text-center text-sm font-medium text-gray-500 bg-gray-50 max-w-max mx-auto px-4 py-1.5 rounded-full">{filtered.length} entrée(s) affichée(s)</p>
        )}
      </div>
    </Modal>
  );
}
