import React, { useState, useEffect } from 'react';
import Modal from './Modal';

interface Agent {
  id: string;
  name: string;
  description: string;
  prompt: string;
  isDefault?: boolean;
}

interface AgentManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'cleanArchitecture',
    name: 'Clean Architecture',
    description: 'Vérifie la séparation des couches et le Dependency Inversion',
    prompt: "Tu es un expert en Clean Architecture. Analyse ce diff. Vérifie la séparation des couches et le Dependency Inversion. Retourne un JSON: { violations: [{ line: number, severity: 'error'|'warning'|'info', message: string, suggestion: string }] }",
    isDefault: true
  },
  {
    id: 'solid',
    name: 'SOLID Principles',
    description: 'Analyse les principes SOLID (SRP, OCP, LSP, ISP, DIP)',
    prompt: "Tu es un expert en principes SOLID. Analyse ce diff. Vérifie SRP, OCP, LSP, ISP, DIP. Retourne un JSON: { violations: [{ line, severity, message, suggestion }] }",
    isDefault: true
  },
  {
    id: 'testing',
    name: 'Testing & QA',
    description: 'Vérifie les tests unitaires et les edge cases',
    prompt: "Tu es un expert QA. Vérifie les tests unitaires manquants et les edge cases dans ce diff. Retourne un JSON: { violations: [{ line, severity, message, suggestion }] }",
    isDefault: true
  },
  {
    id: 'security',
    name: 'Security (OWASP)',
    description: 'Cherche des failles de sécurité (SQLi, XSS, secrets)',
    prompt: "Tu es un expert sécurité (OWASP). Cherche des failles (SQLi, XSS, secrets) dans ce diff. Retourne un JSON: { violations: [{ line, severity, message, suggestion }] }",
    isDefault: true
  }
];

export default function AgentManager({ isOpen, onClose }: AgentManagerProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [mode, setMode] = useState<'manage' | 'add'>('manage');
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [newAgent, setNewAgent] = useState<Agent>({ id: '', name: '', description: '', prompt: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAgents();
      setMode('manage');
      setEditingAgent(null);
      setNewAgent({ id: '', name: '', description: '', prompt: '' });
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  const loadAgents = async () => {
    try {
      const config = await (window as any).api.getConfig();
      const customAgents = (config.agents || []).map((agent: Agent) => ({ ...agent, isDefault: false }));
      setAgents([...DEFAULT_AGENTS, ...customAgents]);
    } catch (error) {
      console.error('Error loading agents:', error);
      setAgents(DEFAULT_AGENTS);
    }
  };

  const saveAgents = async (newAgents: Agent[]) => {
    try {
      const config = await (window as any).api.getConfig();
      const customAgents = newAgents.filter(agent => !agent.isDefault);
      const updatedConfig = { ...config, agents: customAgents };
      await (window as any).api.saveConfig(updatedConfig);
      loadAgents();
    } catch (error) {
      console.error('Error saving agents:', error);
      setError('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent({ ...agent });
    setError('');
    setSuccess('');
  };

  const handleCancelEdit = () => {
    setEditingAgent(null);
    setError('');
  };

  const handleSaveEdit = async () => {
    if (!editingAgent) return;
    if (!editingAgent.name || !editingAgent.prompt) {
      setError('Le nom et le prompt sont obligatoires');
      return;
    }
    const newAgents = agents.map(a => a.id === editingAgent.id ? editingAgent : a);
    await saveAgents(newAgents);
    setEditingAgent(null);
    setSuccess('Agent modifié avec succès');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDelete = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent?.isDefault) {
      setError('Impossible de supprimer un agent par défaut');
      return;
    }
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet agent ?')) return;
    const newAgents = agents.filter(a => a.id !== agentId);
    await saveAgents(newAgents);
    setSuccess('Agent supprimé');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleAddAgent = async () => {
    setError('');
    if (!newAgent.id.trim() || !newAgent.name.trim() || !newAgent.prompt.trim()) {
      setError('Veuillez remplir tous les champs obligatoires (ID, Nom, Prompt)');
      return;
    }
    if (agents.some(a => a.id === newAgent.id.trim())) {
      setError('Un agent avec cet ID existe déjà');
      return;
    }
    const agentToAdd = { ...newAgent, id: newAgent.id.trim(), name: newAgent.name.trim(), description: newAgent.description.trim(), prompt: newAgent.prompt.trim() };
    const updatedAgents = [...agents, agentToAdd];
    await saveAgents(updatedAgents);
    setNewAgent({ id: '', name: '', description: '', prompt: '' });
    setSuccess('Agent ajouté avec succès !');
    setTimeout(() => setSuccess(''), 3000);
  };

  if (!isOpen) return null;

  const customAgents = agents.filter(a => !a.isDefault);
  const defaultAgents = agents.filter(a => a.isDefault);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestion des Agents" width="max-w-4xl" blockOutsideClick={true}>
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => { setMode('manage'); setError(''); setSuccess(''); setEditingAgent(null); }}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${mode === 'manage' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Gérer les agents
          </button>
          <button
            onClick={() => { setMode('add'); setError(''); setSuccess(''); setEditingAgent(null); }}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${mode === 'add' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Ajouter un agent
          </button>
        </div>

        {/* Success / Error messages */}
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

        {/* ─── Tab: Manage agents ─── */}
        {mode === 'manage' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Configurez les agents d'analyse pour vos code reviews.</p>

            {/* Editing inline */}
            {editingAgent && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-purple-800">Modifier l'agent : {editingAgent.name}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">ID</label>
                    <input
                      type="text"
                      value={editingAgent.id}
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nom *</label>
                    <input
                      type="text"
                      value={editingAgent.name}
                      onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    value={editingAgent.description}
                    onChange={e => setEditingAgent({ ...editingAgent, description: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Prompt *</label>
                  <textarea
                    value={editingAgent.prompt}
                    onChange={e => setEditingAgent({ ...editingAgent, prompt: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-xl h-28 resize-vertical focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={handleCancelEdit} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-bold transition-colors">
                    Annuler
                  </button>
                  <button onClick={handleSaveEdit} className="px-5 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors">
                    Sauvegarder
                  </button>
                </div>
              </div>
            )}

            {/* Default agents */}
            {defaultAgents.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-2">Agents par défaut</h4>
                <div className="space-y-2">
                  {defaultAgents.map(agent => (
                    <div key={agent.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{agent.name}</span>
                          <span className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded-full font-bold uppercase">Par défaut</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{agent.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom agents */}
            {customAgents.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-2">Agents personnalisés</h4>
                <div className="space-y-2">
                  {customAgents.map(agent => (
                    <div key={agent.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-200">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{agent.name}</span>
                          <span className="text-xs text-gray-500 font-mono">({agent.id})</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{agent.description}</p>
                      </div>
                      <div className="flex gap-1 ml-3 shrink-0">
                        <button
                          onClick={() => handleEdit(agent)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(agent.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customAgents.length === 0 && (
              <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-sm font-medium">Aucun agent personnalisé.</p>
                <p className="text-xs mt-1">Passez à l'onglet "Ajouter un agent" pour en créer un.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Add agent ─── */}
        {mode === 'add' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Créez un nouvel agent d'analyse personnalisé avec votre propre prompt.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-semibold text-gray-700">
                ID * <span className="text-gray-400 font-normal">(unique, sans espaces)</span>
                <input
                  type="text"
                  value={newAgent.id}
                  onChange={e => setNewAgent({ ...newAgent, id: e.target.value.replace(/\s/g, '') })}
                  className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-gray-900 transition-all font-mono"
                  placeholder="ex: customSecurity"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Nom *
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                  className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-gray-900 transition-all font-medium"
                  placeholder="ex: Sécurité Personnalisée"
                />
              </label>
            </div>

            <label className="block text-sm font-semibold text-gray-700">
              Description
              <input
                type="text"
                value={newAgent.description}
                onChange={e => setNewAgent({ ...newAgent, description: e.target.value })}
                className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-gray-900 transition-all font-medium"
                placeholder="Décrivez brièvement le rôle de cet agent"
              />
            </label>

            <label className="block text-sm font-semibold text-gray-700">
              Prompt * <span className="text-gray-400 font-normal">(instructions pour l'IA)</span>
              <textarea
                value={newAgent.prompt}
                onChange={e => setNewAgent({ ...newAgent, prompt: e.target.value })}
                className="w-full mt-1.5 p-3 bg-white rounded-xl border border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-gray-900 transition-all h-32 resize-vertical"
                placeholder="Tu es un expert en [domaine]. Analyse ce diff. [Instructions spécifiques]. Retourne un JSON: { violations: [{ line, severity, message, suggestion }] }"
              />
            </label>

            {/* Buttons */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
              >
                Fermer
              </button>
              <button
                onClick={handleAddAgent}
                disabled={!newAgent.id.trim() || !newAgent.name.trim() || !newAgent.prompt.trim()}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-600/30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter l'agent
              </button>
            </div>
          </div>
        )}

        {/* Footer close button for manage mode */}
        {mode === 'manage' && !editingAgent && (
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