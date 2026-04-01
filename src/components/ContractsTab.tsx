import React, { useState } from 'react';
import { Contract, Client } from '../types';
import { Plus, Search, Edit2, Trash2, X, FileText, Calendar, DollarSign, CheckCircle2, Clock, AlertCircle, ChevronDown, Download, Hash, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportToPDF } from '../utils/export';
import { formatDate } from '../utils/date';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ConfirmModal } from './ConfirmModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  contracts: Contract[];
  clients: Client[];
  onAdd: (data: Omit<Contract, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, data: Partial<Contract>) => void;
  onDelete: (id: string) => void;
}

export function ContractsTab({ contracts, clients, onAdd, onUpdate, onDelete }: Props) {
  const [dateFilter, setDateFilter] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [periodType, setPeriodType] = useState<'month' | 'custom'>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Contract['status'] | 'all'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => new Date(currentYear, i, 1));

  const handleMonthClick = (month: Date) => {
    setPeriodType('month');
    setDateFilter({
      start: format(startOfMonth(month), 'yyyy-MM-dd'),
      end: format(endOfMonth(month), 'yyyy-MM-dd')
    });
  };

  const [formData, setFormData] = useState({
    clientId: '',
    contractNumber: '',
    totalValue: 0,
    status: 'draft' as Contract['status'],
    description: ''
  });

  const filteredContracts = contracts.filter(c => {
    const date = c.createdAt instanceof Date ? c.createdAt : (c.createdAt as any).toDate();
    const isWithinDate = isWithinInterval(date, { 
      start: parseISO(dateFilter.start), 
      end: parseISO(dateFilter.end) 
    });
    const client = clients.find(cl => cl.id === c.clientId);
    const matchesSearch = (c.contractNumber || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (client?.name || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesClient = clientFilter === 'all' || c.clientId === clientFilter;
    return isWithinDate && matchesSearch && matchesStatus && matchesClient;
  });

  const stats = {
    total: filteredContracts.length,
    active: filteredContracts.filter(c => c.status === 'active').length,
    completed: filteredContracts.filter(c => c.status === 'completed').length,
    totalValue: filteredContracts.reduce((acc, c) => acc + c.totalValue, 0)
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContract) {
      onUpdate(editingContract.id, formData);
    } else {
      onAdd(formData);
    }
    closeModal();
  };

  const openModal = (contract?: Contract) => {
    if (contract) {
      setEditingContract(contract);
      setFormData({
        clientId: contract.clientId,
        contractNumber: contract.contractNumber,
        totalValue: contract.totalValue,
        status: contract.status,
        description: contract.description || ''
      });
    } else {
      setEditingContract(null);
      setFormData({
        clientId: '',
        contractNumber: '',
        totalValue: 0,
        status: 'draft',
        description: ''
      });
    }
    setClientSearchTerm('');
    setIsClientDropdownOpen(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingContract(null);
  };

  const handleExportPDF = () => {
    const headers = ['Nº Contrato', 'Cliente', 'Valor', 'Status', 'Data'];
    const rows = filteredContracts.map(c => [
      c.contractNumber,
      clients.find(cl => cl.id === c.clientId)?.name || 'N/A',
      `R$ ${(c.totalValue || 0).toLocaleString('pt-BR')}`,
      c.status === 'active' ? 'Ativo' : c.status === 'completed' ? 'Concluído' : c.status === 'cancelled' ? 'Cancelado' : 'Rascunho',
      formatDate(c.createdAt)
    ]);
    exportToPDF('Relatório de Contratos', headers, rows, 'contratos', 'l');
  };

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total de Contratos</p>
              <p className="text-2xl font-black text-slate-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ativos</p>
              <p className="text-2xl font-black text-slate-900">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Concluídos</p>
              <p className="text-2xl font-black text-slate-900">{stats.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Valor Total</p>
              <p className="text-2xl font-black text-slate-900">R$ {(stats.totalValue || 0).toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Contratos</h2>
          <p className="text-slate-500">Gerencie e acompanhe os contratos da Magalhães Arquitetura.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} className="p-2 text-slate-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all">
            <Download className="h-5 w-5" />
          </button>
          <button 
            onClick={() => openModal()}
            className="flex items-center space-x-2 bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200"
          >
            <Plus className="h-5 w-5" />
            <span>Novo Contrato</span>
          </button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {months.map((month) => {
            const isActive = periodType === 'month' && isSameMonth(month, parseISO(dateFilter.start));
            return (
              <button
                key={month.toISOString()}
                onClick={() => handleMonthClick(month)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all border capitalize",
                  isActive 
                    ? "bg-slate-800 text-white border-slate-800 shadow-md" 
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {format(month, 'MMM', { locale: ptBR })}
              </button>
            );
          })}
          <button
            onClick={() => setPeriodType('custom')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all border flex items-center gap-2",
              periodType === 'custom'
                ? "bg-slate-800 text-white border-slate-800 shadow-md"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <Filter className="h-4 w-4" />
            Personalizado
          </button>
        </div>

        {periodType === 'custom' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Início</label>
                <input 
                  type="date" 
                  value={dateFilter.start} 
                  onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Fim</label>
                <input 
                  type="date" 
                  value={dateFilter.end} 
                  onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-500 outline-none transition-all shadow-sm"
          />
        </div>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="px-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-500 outline-none transition-all shadow-sm text-slate-600 font-medium"
        >
          <option value="all">Todos os Clientes</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-500 outline-none transition-all shadow-sm text-slate-600 font-medium"
        >
          <option value="all">Todos os Status</option>
          <option value="draft">Rascunho</option>
          <option value="active">Ativo</option>
          <option value="completed">Concluído</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {/* Contracts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContracts.map((contract) => {
          const client = clients.find(c => c.id === contract.clientId);
          return (
            <div key={contract.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                  contract.status === 'active' ? "bg-emerald-50 text-emerald-600" :
                  contract.status === 'completed' ? "bg-blue-50 text-blue-600" :
                  contract.status === 'draft' ? "bg-slate-50 text-slate-600" : "bg-red-50 text-red-600"
                )}>
                  {contract.status === 'active' ? 'Ativo' : 
                   contract.status === 'completed' ? 'Concluído' :
                   contract.status === 'draft' ? 'Rascunho' : 'Cancelado'}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openModal(contract)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-lg">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setContractToDelete(contract.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-slate-400 mb-1">
                    <Hash className="h-3 w-3" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Nº {contract.contractNumber}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">{client?.name || 'Cliente não encontrado'}</h3>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Valor</p>
                    <p className="text-sm font-black text-slate-900">R$ {(contract.totalValue || 0).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Criado em</p>
                    <p className="text-sm font-medium text-slate-600">{formatDate(contract.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filteredContracts.length === 0 && (
          <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Nenhum contrato encontrado.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={closeModal}>
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">
                {editingContract ? 'Editar Contrato' : 'Novo Contrato'}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1 relative">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Cliente</label>
                <div className="relative">
                  <div 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-slate-500 transition-all flex items-center justify-between cursor-pointer"
                    onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                  >
                    <span className={formData.clientId ? "text-slate-900" : "text-slate-400"}>
                      {formData.clientId 
                        ? clients.find(c => c.id === formData.clientId)?.name || 'Cliente não encontrado'
                        : 'Selecione um cliente'}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", isClientDropdownOpen && "rotate-180")} />
                  </div>
                  
                  {isClientDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-0" onClick={() => setIsClientDropdownOpen(false)} />
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 flex flex-col overflow-hidden">
                        <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Buscar cliente..."
                              value={clientSearchTerm}
                              onChange={(e) => setClientSearchTerm(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto flex-1">
                          {clients
                            .filter(c => (c.name || '').toLowerCase().includes((clientSearchTerm || '').toLowerCase()))
                            .map(c => (
                              <div
                                key={c.id}
                                className={cn(
                                  "px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors text-sm",
                                  formData.clientId === c.id && "bg-slate-50 font-medium text-slate-900"
                                )}
                                onClick={() => {
                                  setFormData({ ...formData, clientId: c.id });
                                  setIsClientDropdownOpen(false);
                                  setClientSearchTerm('');
                                }}
                              >
                                {c.name}
                              </div>
                            ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nº do Contrato</label>
                  <input
                    required
                    type="text"
                    value={formData.contractNumber}
                    onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                    placeholder="Ex: 2024-001"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Valor Total</label>
                  <input
                    required
                    type="number"
                    value={formData.totalValue}
                    onChange={(e) => setFormData({ ...formData, totalValue: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                >
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativo</option>
                  <option value="completed">Concluído</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Descrição / Observações</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all h-24 resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={closeModal} className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200">
                  {editingContract ? 'Salvar Alterações' : 'Criar Contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!contractToDelete}
        title="Excluir Contrato"
        message="Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita."
        onConfirm={() => {
          if (contractToDelete) {
            onDelete(contractToDelete);
            setContractToDelete(null);
          }
        }}
        onCancel={() => setContractToDelete(null)}
        confirmText="Excluir"
        isDestructive={true}
      />
    </div>
  );
}
