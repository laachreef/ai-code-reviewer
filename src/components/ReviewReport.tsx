import React, { useState } from 'react';

const getDiffContext = (rawDiff: string, lineTarget: number | string) => {
  if (!rawDiff || !lineTarget) return null;
  const target = typeof lineTarget === 'string' ? parseInt(lineTarget, 10) : lineTarget;
  if (isNaN(target)) return null;

  const lines = rawDiff.split('\n');
  let currentLine = 0;
  let contextLines: any[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('+++ b/')) {
      currentLine = 0;
    } else if (line.startsWith('@@ ')) {
      const match = line.match(/\+([0-9]+)/);
      if (match) currentLine = parseInt(match[1], 10) - 1;
    } else if (line.startsWith(' ') || line.startsWith('+') || line.startsWith('-')) {
      let lineNum = null;
      if (!line.startsWith('-')) {
        currentLine++;
        lineNum = currentLine;
      }
      contextLines.push({ num: lineNum, text: line });
    }
  }
  
  const targetIndex = contextLines.findIndex(c => c.num === target);
  if (targetIndex !== -1) {
    const start = Math.max(0, targetIndex - 2);
    const end = Math.min(contextLines.length - 1, targetIndex + 2);
    return contextLines.slice(start, end + 1);
  }
  
  return null;
};

export default function ReviewReport({ review, onDone }: { review: any, onDone: Function }) {
  const [selected, setSelected] = useState<Set<number>>(new Set(review.violations.map((_:any, i:number) => i)));
  const [editedViolations, setEditedViolations] = useState<any[]>(review.violations);

  const handleViolationEdit = (index: number, field: string, value: string) => {
    const newViolations = [...editedViolations];
    newViolations[index] = { ...newViolations[index], [field]: value };
    setEditedViolations(newViolations);
  };

  const toggleSelect = (i: number) => {
    const newSet = new Set(selected);
    newSet.has(i) ? newSet.delete(i) : newSet.add(i);
    setSelected(newSet);
  };

  const [deleteBranch, setDeleteBranch] = useState(false);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

  const submitReview = async () => {
    const commentsToPost = editedViolations.filter((_:any, i:number) => selected.has(i));
    await (window as any).api.postReview({ 
      projectId: review.repoId, prId: review.prId, comments: commentsToPost 
    });
    
    const historyItem = {
      id: Date.now().toString(),
      repoId: review.repoId,
      prId: review.prId,
      date: new Date().toISOString(),
      action: `Envoyé avec commentaires (${commentsToPost.length})`,
      status: 'success'
    };
    await (window as any).api.saveHistory(historyItem);
    onDone(historyItem.id);
  };

  const approveWithoutComments = async () => {
    // Merge PR automatically
    await (window as any).api.mergeReview({ 
      projectId: review.repoId, prId: review.prId, deleteBranch 
    });
    
    const actionDesc = deleteBranch ? `PR mergée automatiquement & branche supprimée` : `PR mergée automatiquement`;
    const historyItem = {
      id: Date.now().toString(),
      repoId: review.repoId,
      prId: review.prId,
      date: new Date().toISOString(),
      action: actionDesc,
      status: 'success'
    };
    await (window as any).api.saveHistory(historyItem);
    onDone(historyItem.id);
  };

  const goBack = () => {
    onDone(null);
  };

  return (
    <div className="flex flex-col bg-slate-50 min-h-screen text-slate-900 font-sans">
      {/* Header compact clair */}
      <div className="flex items-center gap-4 px-8 py-6 border-b border-slate-200 bg-white sticky top-0 z-20 shadow-sm">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Rapport d'Analyse</h1>
          <p className="text-sm font-medium text-slate-500">
            {review.repoId} <span className="mx-2 opacity-30">/</span> PR #{review.prId}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4">
           <div className="px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100 text-xs font-bold text-indigo-600 uppercase tracking-widest">
             {selected.size} / {review.violations.length} SELECTIONNES
           </div>
        </div>
      </div>

      {/* Liste des violations clair */}
      <div className="flex-1 p-10 space-y-8 pb-40 max-w-6xl mx-auto w-full">
        {review.violations.map((v: any, i: number) => (
          <div key={i} className={`p-8 rounded-3xl border bg-white shadow-xl shadow-slate-200/40 flex items-start gap-8 transition-all hover:shadow-2xl hover:shadow-indigo-100/50
            ${v.severity === 'error' ? 'border-red-100' : v.severity === 'warning' ? 'border-amber-100' : 'border-indigo-100'}`}>

            <div className="flex flex-col items-center gap-6 py-2 shrink-0">
               <input type="checkbox" className="w-6 h-6 rounded-lg border-2 border-slate-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                      checked={selected.has(i)} onChange={() => toggleSelect(i)} />
               <div className={`w-1.5 h-full rounded-full opacity-60 ${v.severity === 'error' ? 'bg-red-500' : v.severity === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'}`} />
            </div>

            <div className="flex-1 min-w-0">
              {/* Path Header */}
              <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-black text-slate-700 tracking-tight font-mono bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-200/60 truncate block w-full">
                    {v.file || 'Fichier'}
                  </span>
              </div>

              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-sm border ${
                  v.severity === 'error' ? 'bg-red-50 text-red-600 border-red-200' :
                  v.severity === 'warning' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                  'bg-indigo-50 text-indigo-600 border-indigo-200'
                }`}>{v.severity}</span>
                <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full text-slate-500 font-bold uppercase tracking-wider">Agent: {v.agent}</span>
                <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full text-slate-900 font-black tracking-widest">LIGNE: {v.line}</span>
              </div>
              
              <div className="mb-4">
                <textarea
                  value={editedViolations[i].message}
                  onChange={(e) => handleViolationEdit(i, 'message', e.target.value)}
                  className="w-full bg-transparent border-none p-0 font-extrabold text-slate-900 focus:ring-0 mb-2 cursor-text leading-tight resize-none h-auto overflow-hidden text-xl"
                  rows={1}
                  onInput={(e: any) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  placeholder="Titre de l'observation..."
                />
              </div>
              
              <div className="p-5 bg-indigo-50/30 rounded-2xl border border-indigo-100 flex items-start gap-3 mb-6 group transition-all hover:bg-white hover:shadow-lg hover:shadow-indigo-50">
                  <span className="shrink-0 mt-1.5 p-1 bg-white rounded-lg shadow-sm">💡</span>
                  <textarea
                    value={editedViolations[i].suggestion}
                    onChange={(e) => handleViolationEdit(i, 'suggestion', e.target.value)}
                    className="w-full bg-transparent border-none p-0 text-sm text-slate-600 focus:ring-0 resize-none h-auto overflow-hidden cursor-text leading-relaxed font-medium"
                    rows={1}
                    onInput={(e: any) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    placeholder="Suggestion de correction..."
                  />
              </div>

              {review.rawDiff && getDiffContext(review.rawDiff, v.line) && (
                <div className="bg-slate-900 rounded-2xl font-mono text-[11px] border border-slate-800 overflow-x-auto shadow-2xl p-2 mt-4">
                  {(getDiffContext(review.rawDiff, v.line) || []).map((cLine: any, j: number) => (
                    <div key={j} className={`px-4 py-1.5 flex transition-colors ${
                      cLine.text.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400 font-bold' :
                      cLine.text.startsWith('-') ? 'bg-red-500/10 text-red-400 font-bold' :
                      'text-slate-400 opacity-60'
                    }`}>
                      <span className="inline-block w-10 text-right mr-5 text-slate-700 border-r border-white/5 pr-4 select-none shrink-0 font-black">
                        {cLine.num || ' '}
                      </span>
                      <span className="whitespace-pre">{cLine.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {review.violations.length === 0 && (
           <div className="flex flex-col items-center justify-center py-40 text-slate-300 gap-6">
             <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 border-4 border-white shadow-xl shadow-emerald-100">
               <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
               </svg>
             </div>
             <span className="font-black uppercase tracking-[0.2em] text-sm text-slate-400">Aucun problème détecté !</span>
           </div>
        )}
      </div>

      {/* Barre d'action fixe en bas clair */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 px-10 py-6 flex items-center justify-end gap-5 z-30 shadow-[0_-15px_40px_rgba(0,0,0,0.05)]">
        <button
          onClick={goBack}
          className="bg-white text-slate-500 hover:text-slate-900 px-8 py-3.5 rounded-2xl font-black transition-all text-xs border border-slate-200 tracking-widest active:scale-95"
        >
          ← RETOUR
        </button>

        <button
          onClick={() => setShowMergeConfirm(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-2xl font-black transition-all text-xs tracking-widest active:scale-95 shadow-xl shadow-slate-900/20"
        >
          APPROUVER & MERGER
        </button>

        <button
          onClick={submitReview}
          disabled={selected.size === 0}
          className="bg-indigo-600 px-10 py-3.5 rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-200 text-xs text-white tracking-widest disabled:opacity-20 disabled:cursor-not-allowed active:scale-95"
        >
          ENVOYER {selected.size} CMTS
        </button>
      </div>

      {/* Modal de Confirmation Clair */}
      {showMergeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowMergeConfirm(false)}></div>
          <div className="relative bg-white border border-slate-100 rounded-[40px] shadow-2xl shadow-slate-900/20 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-10">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-8 mx-auto text-indigo-600 border border-indigo-100 shadow-inner">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-3xl font-black text-center mb-3 tracking-tight text-slate-900 uppercase">Fusionner la PR</h3>
              <p className="text-slate-500 text-sm text-center mb-10 leading-relaxed font-medium">
                Voulez-vous fusionner laPull Request <span className="text-indigo-600 font-bold">#{review.prId}</span> dans le dépôt ?
              </p>

              <label className="flex items-center gap-5 p-6 bg-slate-50 rounded-3xl border border-slate-100 cursor-pointer hover:bg-white hover:border-indigo-200 transition-all mb-10 group shadow-inner">
                <input
                  type="checkbox"
                  checked={deleteBranch}
                  onChange={(e) => setDeleteBranch(e.target.checked)}
                  className="w-7 h-7 text-indigo-600 bg-white border-slate-300 rounded-xl focus:ring-indigo-500 cursor-pointer transition-all"
                />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-black text-slate-800 uppercase tracking-widest">Supprimer la branche</span>
                  <span className="text-xs text-slate-400 font-bold opacity-80 uppercase tracking-tighter">Nettoyage automatique du dépôt</span>
                </div>
              </label>

              <div className="flex gap-5">
                <button
                  onClick={() => setShowMergeConfirm(false)}
                  className="flex-1 px-4 py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black transition-all text-xs uppercase tracking-widest"
                >
                  Annuler
                </button>
                <button
                  onClick={approveWithoutComments}
                  className="flex-1 px-4 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all shadow-2xl shadow-indigo-200 text-xs uppercase tracking-widest"
                >
                  Confirmer le Merge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
