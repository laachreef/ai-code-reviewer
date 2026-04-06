import React from 'react';
import Modal from './Modal';

const APP_VERSION = '0.2.0-beta';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="À propos" width="max-w-lg">
      <div className="text-center mb-6">
        <img src="./icon.png" alt="Logo" className="w-20 h-20 outline-none border-none drop-shadow-md mx-auto mb-4" />
        <h1 className="text-2xl font-black text-gray-900 mb-1">AI Code Reviewer</h1>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-mono font-bold">
          v{APP_VERSION} <span className="opacity-70">(bêta)</span>
        </span>
      </div>

      <div className="space-y-6 text-sm">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-2">Description</h2>
          <p className="text-gray-600 leading-relaxed">
            Application de bureau qui automatise la revue de code pour des répertoires locaux ou sur GitHub et GitLab grâce à l'intelligence artificielle multi-agents. 
            Chaque agent est spécialisé dans un domaine précis (Architecture, SOLID, Sécurité, Tests) et analyse automatiquement 
            le code pour produire des suggestions actionnables ou les publier en ligne.
          </p>
        </div>

        <div className="border-t border-gray-100"></div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-3">Développeur</h2>
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-xl">👨‍💻</span>
            </div>
            <div>
              <p className="font-bold text-gray-900">Achref TLILI</p>
              <p className="text-xs text-gray-500 font-medium tracking-wide">ONEPOINT</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100"></div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-3">Contact & Support</h2>
          <a
            href="mailto:ac.tlili@groupeonepoint.com?subject=AI Code Reviewer"
            className="flex items-center gap-3 group p-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-100"
          >
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 text-white shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-blue-900 group-hover:text-blue-700 transition-colors">ac.tlili@groupeonepoint.com</p>
              <p className="text-xs text-blue-600/70">Signaler un bug · Proposer une idée</p>
            </div>
          </a>
        </div>

        <div className="border-t border-gray-100"></div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-3">Stack technique</h2>
          <div className="flex flex-wrap gap-2">
            {['Electron', 'React 19', 'TypeScript', 'Vite', 'Tailwind', 'AI API'].map(tech => (
              <span key={tech} className="bg-gray-100 border border-gray-200 text-gray-600 font-medium text-xs px-2.5 py-1 rounded-full shadow-sm">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <p className="text-center text-gray-400 text-xs mt-8">
        © 2026 Achref TLILI — ONEPOINT · All rights reserved
      </p>
    </Modal>
  );
}
