import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Client } from '../types';
import { Plus, Search, Edit2, Trash2, X, UserPlus, FileText, Download } from 'lucide-react';
import { exportToPDF } from '../utils/export';
import { formatCpfCnpj, formatPhone } from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  clients: Client[];
  onAdd: (data: Omit<Client, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, data: Partial<Client>) => void;
  onDelete: (id: string) => void;
}

export function ClientsTab({ clients, onAdd, onUpdate, onDelete }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    address: '',
    contact: ''
  });

  const filteredClients = clients.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cpf || '').includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      onUpdate(editingClient.id, formData);
    } else {
      onAdd(formData);
    }
    closeModal();
  };

  const openModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        cpf: formatCpfCnpj(client.cpf),
        address: client.address,
        contact: formatPhone(client.contact)
      });
    } else {
      setEditingClient(null);
      setFormData({ name: '', cpf: '', address: '', contact: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const handleDelete = async (id: string) => {
    setClientToDelete(id);
  };

  const confirmDelete = () => {
    if (clientToDelete) {
      onDelete(clientToDelete);
      setClientToDelete(null);
    }
  };

  const handleExportPDF = () => {
    const headers = ['Nome', 'CPF', 'Contato', 'Endereço'];
    const rows = clients.map(c => [c.name, c.cpf, c.contact, c.address]);
    exportToPDF('Relatório de Clientes', headers, rows, 'clientes', 'l');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Clientes</h2>
          <p className="text-slate-500">Gerencie sua base de contatos e clientes.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportPDF}
            className="p-2 text-slate-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
            title="Exportar PDF"
          >
            <Download className="h-5 w-5" />
          </button>
          <button 
            onClick={() => openModal()}
            className="flex items-center space-x-2 bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200"
          >
            <UserPlus className="h-5 w-5" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition-all shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <div key={client.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-800 font-bold text-xl">
                {(client.name || '?').charAt(0)}
              </div>
              <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openModal(client)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(client.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{client.name || 'Sem Nome'}</h3>
            <p className="text-xs font-mono text-slate-500 mb-4">Doc: {formatCpfCnpj(client.cpf)}</p>
            
            <div className="space-y-2">
              <div className="flex items-center text-sm text-slate-600">
                <span className="w-20 font-medium text-slate-400 text-[10px] uppercase tracking-wider">Contato</span>
                <span>{formatPhone(client.contact)}</span>
              </div>
              <div className="flex items-start text-sm text-slate-600">
                <span className="w-20 font-medium text-slate-400 text-[10px] uppercase tracking-wider">Endereço</span>
                <span className="flex-1 line-clamp-2">{client.address || 'Não informado'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={closeModal}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nome Completo</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">CPF / CNPJ</label>
                  <input
                    required
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: formatCpfCnpj(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Contato</label>
                  <input
                    required
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: formatPhone(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Endereço</label>
                  <textarea
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all h-24 resize-none"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200"
                >
                  {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!clientToDelete}
        title="Excluir Cliente"
        message="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        onCancel={() => setClientToDelete(null)}
        confirmText="Excluir"
        isDestructive={true}
      />
    </div>
  );
}
