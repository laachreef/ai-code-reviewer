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
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAgents();
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
      // Only save custom agents (not default ones)
      const customAgents = newAgents.filter(agent => !agent.isDefault);
      const updatedConfig = { ...config, agents: customAgents };
      await (window as any).api.saveConfig(updatedConfig);
      // Reload to get updated list
      loadAgents();
    } catch (error) {
      console.error('Error saving agents:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleCreate = () => {
    setEditingAgent({
      id: '',
      name: '',
      description: '',
      prompt: ''
    });
    setIsCreating(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent({ ...agent });
    setIsCreating(false);
  };

  const handleDelete = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent?.isDefault) {
      alert('Impossible de supprimer un agent par défaut');
      return;
    }
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet agent ?')) return;
    const newAgents = agents.filter(a => a.id !== agentId);
    await saveAgents(newAgents);
  };

  const handleSave = async () => {
    if (!editingAgent) return;

    if (!editingAgent.id || !editingAgent.name || !editingAgent.prompt) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    let newAgents;
    if (isCreating) {
      // Check if ID already exists
      if (agents.some(a => a.id === editingAgent.id)) {
        alert('Un agent avec cet ID existe déjà');
        return;
      }
      newAgents = [...agents, editingAgent];
    } else {
      newAgents = agents.map(a => a.id === editingAgent.id ? editingAgent : a);
    }

    await saveAgents(newAgents);
    setEditingAgent(null);
  };

  const handleCancel = () => {
    setEditingAgent(null);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestion des Agents" width="max-w-4xl" blockOutsideClick={true}>
      <div className="space-y-6">

        <div className="flex-1">
          {!editingAgent ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <p className="text-gray-600">Configurez les agents d'analyse pour vos code reviews.</p>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  + Nouveau Agent
                </button>
              </div>

              <div className="grid gap-4">
                {agents.map(agent => (
                  <div key={agent.id} className={`border rounded-lg p-4 ${agent.isDefault ? 'bg-gray-50 border-gray-200' : 'hover:shadow-md'} transition-shadow`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold text-lg ${agent.isDefault ? 'text-gray-600' : ''}`}>{agent.name}</h3>
                          {agent.isDefault && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Par défaut</span>
                          )}
                        </div>
                        <p className={`text-gray-600 mb-2 ${agent.isDefault ? 'text-gray-500' : ''}`}>{agent.description}</p>
                        <div className="text-sm text-gray-500">
                          <strong>ID:</strong> {agent.id}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!agent.isDefault && (
                          <>
                            <button
                              onClick={() => handleEdit(agent)}
                              className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(agent.id)}
                              className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {agents.filter(a => !a.isDefault).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Aucun agent personnalisé. Créez votre premier agent !
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">
                {isCreating ? 'Créer un nouvel agent' : 'Modifier l\'agent'}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    ID * <span className="text-gray-500">(unique)</span>
                  </label>
                  <input
                    type="text"
                    value={editingAgent.id}
                    onChange={e => setEditingAgent({ ...editingAgent, id: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="ex: customSecurity"
                    disabled={!isCreating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Nom *</label>
                  <input
                    type="text"
                    value={editingAgent.name}
                    onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="ex: Sécurité Personnalisée"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={editingAgent.description}
                  onChange={e => setEditingAgent({ ...editingAgent, description: e.target.value })}
                  className="w-full p-2 border rounded"
                  placeholder="Décrivez brièvement le rôle de cet agent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Prompt * <span className="text-gray-500">(instructions pour l'IA)</span>
                </label>
                <textarea
                  value={editingAgent.prompt}
                  onChange={e => setEditingAgent({ ...editingAgent, prompt: e.target.value })}
                  className="w-full p-2 border rounded h-32 resize-vertical"
                  placeholder="Tu es un expert en [domaine]. Analyse ce diff. [Instructions spécifiques]. Retourne un JSON: { violations: [{ line, severity, message, suggestion }] }"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Sauvegarder
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}