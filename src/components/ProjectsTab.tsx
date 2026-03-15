import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { Project, Client, Installment } from '../types';
import { Plus, Search, Edit2, Trash2, X, Briefcase, Calendar, DollarSign, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, FileText, Download } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { exportToPDF } from '../utils/export';
import { formatDate, formatDateForInput } from '../utils/date';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ConfirmModal } from './ConfirmModal';
import { AlertModal } from './AlertModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  projects: Project[];
  clients: Client[];
  installments: Record<string, Installment[]>;
  onAdd: (data: Omit<Project, 'id' | 'createdAt'> & { numInstallments: number, customInstallments?: number[], firstInstallmentDate?: string }) => void;
  onUpdate: (id: string, data: Partial<Project>) => void;
  onDelete: (id: string) => void;
  onToggleInstallment: (projectId: string, installmentId: string) => void;
  onUpdateInstallment: (projectId: string, installmentId: string, data: Partial<Installment>) => void;
}

export function ProjectsTab({ projects, clients, installments, onAdd, onUpdate, onDelete, onToggleInstallment, onUpdateInstallment }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [editingInstallmentDateId, setEditingInstallmentDateId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Project['status'] | 'all'>('all');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [customInstallments, setCustomInstallments] = useState<number[]>([]);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    clientId: '',
    name: '',
    description: '',
    totalValue: 0,
    status: 'active' as Project['status'],
    numInstallments: 1,
    firstInstallmentDate: format(new Date(), 'yyyy-MM-dd')
  });

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clients.find(c => c.id === p.clientId)?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    if (formData.numInstallments > 1) {
      const percentage = Number((100 / formData.numInstallments).toFixed(2));
      const arr = Array(formData.numInstallments).fill(percentage);
      // Adjust the last one to ensure it sums exactly to 100
      const sum = arr.slice(0, -1).reduce((a, b) => a + b, 0);
      arr[arr.length - 1] = Number((100 - sum).toFixed(2));
      setCustomInstallments(arr);
    } else {
      setCustomInstallments([]);
    }
  }, [formData.numInstallments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) {
      onUpdate(editingProject.id, {
        clientId: formData.clientId,
        name: formData.name,
        description: formData.description,
        totalValue: formData.totalValue,
        status: formData.status
      });
    } else {
      if (formData.numInstallments > 1) {
        const sum = customInstallments.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 100) > 0.1) {
          setAlertMessage('A soma das porcentagens das parcelas deve ser exatamente 100%.');
          return;
        }
      }
      onAdd({ ...formData, customInstallments: formData.numInstallments > 1 ? customInstallments : undefined, firstInstallmentDate: formData.firstInstallmentDate });
    }
    closeModal();
  };

  const openModal = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        clientId: project.clientId,
        name: project.name,
        description: project.description,
        totalValue: project.totalValue,
        status: project.status,
        numInstallments: 1, // Not used for editing
        firstInstallmentDate: format(new Date(), 'yyyy-MM-dd')
      });
    } else {
      setEditingProject(null);
      setFormData({ clientId: '', name: '', description: '', totalValue: 0, status: 'active', numInstallments: 1, firstInstallmentDate: format(new Date(), 'yyyy-MM-dd') });
    }
    setClientSearchTerm('');
    setIsClientDropdownOpen(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
  };

  const handleDelete = async (id: string) => {
    setProjectToDelete(id);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      onDelete(projectToDelete);
      setProjectToDelete(null);
    }
  };

  const toggleInstallmentStatus = async (projectId: string, installment: Installment) => {
    onToggleInstallment(projectId, installment.id);
  };

  const handlePercentageChange = (project: Project, installment: Installment, newPercentage: number) => {
    const newAmount = (project.totalValue * newPercentage) / 100;
    onUpdateInstallment(project.id, installment.id, { 
      percentage: newPercentage,
      amount: newAmount
    });
  };

  const handleDateChange = (project: Project, installment: Installment, newDateStr: string) => {
    if (!newDateStr) return;
    const [year, month, day] = newDateStr.split('-').map(Number);
    const newDate = new Date(year, month - 1, day);
    onUpdateInstallment(project.id, installment.id, { 
      dueDate: newDate as any
    });
  };

  const getProjectProgress = (projectId: string) => {
    const projectInstallments = installments[projectId] || [];
    if (projectInstallments.length === 0) return 0;
    const paid = projectInstallments.filter(i => i.status === 'paid').length;
    return Math.round((paid / projectInstallments.length) * 100);
  };

  const handleExportPDF = () => {
    const headers = ['Projeto', 'Cliente', 'Valor', 'Status', 'Progresso'];
    const rows = projects.map(p => [
      p.name, 
      clients.find(c => c.id === p.clientId)?.name || 'N/A',
      `R$ ${p.totalValue.toLocaleString('pt-BR')}`,
      p.status,
      `${getProjectProgress(p.id)}%`
    ]);
    exportToPDF('Relatório de Projetos', headers, rows, 'projetos');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Projetos</h2>
          <p className="text-slate-500">Acompanhe o andamento e pagamentos dos seus projetos.</p>
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
            <span>Novo Projeto</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por projeto ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-500 outline-none transition-all shadow-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Project['status'] | 'all')}
          className="px-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-500 outline-none transition-all shadow-sm text-slate-600 font-medium min-w-[180px]"
        >
          <option value="all">Todos os Status</option>
          <option value="active">Em Andamento</option>
          <option value="completed">Concluído</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      <div className="space-y-4">
        {filteredProjects.map((project) => {
          const client = clients.find(c => c.id === project.clientId);
          const progress = getProjectProgress(project.id);
          const isExpanded = expandedProjectId === project.id;
          const projectInstallments = installments[project.id] || [];

          return (
            <div key={project.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300">
              <div className="p-6 flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      project.status === 'active' ? "bg-emerald-50 text-emerald-600" :
                      project.status === 'completed' ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"
                    )}>
                      {project.status === 'active' ? 'Em Andamento' : 
                       project.status === 'completed' ? 'Concluído' : 'Cancelado'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-400 font-medium">Criado em {formatDate(project.createdAt)}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{project.name}</h3>
                  <p className="text-sm text-slate-500 font-medium">{client?.name || 'Cliente não encontrado'}</p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Valor Total</p>
                    <p className="text-lg font-black text-slate-900">R$ {project.totalValue.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="w-full md:w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-600 transition-all duration-500" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{progress}% Pago</p>
                </div>

                <div className="flex items-center gap-2 border-l border-slate-100 pl-6">
                  <button onClick={() => openModal(project)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(project.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                    className={cn("p-2 rounded-lg transition-all", isExpanded ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-50")}
                  >
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-slate-50 border-t border-slate-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Parcelamento</h4>
                      {(() => {
                        const totalPct = projectInstallments.reduce((acc, i) => acc + i.percentage, 0);
                        if (Math.abs(totalPct - 100) > 0.01) {
                          return (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                              <AlertCircle className="h-3 w-3" />
                              <span>Total: {totalPct.toFixed(1)}% (Deveria ser 100%)</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <span className="text-xs text-slate-500">{projectInstallments.length} parcelas</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {projectInstallments.map((inst, idx) => (
                      <div key={inst.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center",
                            inst.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          )}>
                            {inst.status === 'paid' ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-slate-900">{idx + 1}ª Parcela</p>
                              {editingInstallmentId === inst.id ? (
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number"
                                    className="w-12 h-6 text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-slate-500"
                                    value={inst.percentage}
                                    onChange={(e) => handlePercentageChange(project, inst, Number(e.target.value))}
                                    onBlur={() => setEditingInstallmentId(null)}
                                    onKeyDown={(e) => e.key === 'Enter' && setEditingInstallmentId(null)}
                                    autoFocus
                                  />
                                  <span className="text-[10px] text-slate-400">%</span>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setEditingInstallmentId(inst.id)}
                                  className="text-[10px] font-bold text-slate-600 hover:underline"
                                  title="Clique para alterar a porcentagem"
                                >
                                  ({inst.percentage}%)
                                </button>
                              )}
                            </div>
                            {editingInstallmentDateId === inst.id ? (
                              <input 
                                type="date"
                                className="text-[10px] border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-slate-500 mt-1"
                                value={formatDateForInput(inst.dueDate)}
                                onChange={(e) => handleDateChange(project, inst, e.target.value)}
                                onBlur={() => setEditingInstallmentDateId(null)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingInstallmentDateId(null)}
                                autoFocus
                              />
                            ) : (
                              <button 
                                onClick={() => setEditingInstallmentDateId(inst.id)}
                                className="text-[10px] text-slate-500 hover:text-slate-800 hover:underline text-left"
                                title="Clique para alterar a data de vencimento"
                              >
                                Vence em {formatDate(inst.dueDate)}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <p className="text-sm font-bold text-slate-900">R$ {inst.amount.toLocaleString('pt-BR')}</p>
                          <button 
                            onClick={() => toggleInstallmentStatus(project.id, inst)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                              inst.status === 'paid' 
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" 
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                          >
                            {inst.status === 'paid' ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Pago</span>
                              </>
                            ) : (
                              <>
                                <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-400" />
                                <span>Pagar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
                {editingProject ? 'Editar Projeto' : 'Novo Projeto'}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1 relative">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Cliente</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required 
                    value={formData.clientId} 
                    onChange={() => {}} 
                    className="absolute opacity-0 w-0 h-0" 
                    tabIndex={-1} 
                  />
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
                      <div 
                        className="fixed inset-0 z-0" 
                        onClick={() => setIsClientDropdownOpen(false)}
                      />
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
                            .filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()))
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
                          {clients.filter(c => c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())).length === 0 && (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">
                              Nenhum cliente encontrado
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nome do Projeto</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                {!editingProject && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Parcelas</label>
                      <input
                        required
                        type="number"
                        min="1"
                        max="24"
                        value={formData.numInstallments}
                        onChange={(e) => setFormData({ ...formData, numInstallments: Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Data da 1ª Parcela</label>
                      <input
                        required
                        type="date"
                        value={formData.firstInstallmentDate}
                        onChange={(e) => setFormData({ ...formData, firstInstallmentDate: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                      />
                    </div>
                  </>
                )}
              </div>
              
              {!editingProject && formData.numInstallments > 1 && (
                <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Porcentagem por Parcela</label>
                    <span className={cn(
                      "text-xs font-bold",
                      Math.abs(customInstallments.reduce((a, b) => a + b, 0) - 100) > 0.1 ? "text-red-500" : "text-emerald-500"
                    )}>
                      Total: {customInstallments.reduce((a, b) => a + b, 0).toFixed(2)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {customInstallments.map((pct, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-slate-500 w-6">{idx + 1}ª</span>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={pct}
                            onChange={(e) => {
                              const newArr = [...customInstallments];
                              newArr[idx] = Number(e.target.value);
                              setCustomInstallments(newArr);
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 outline-none pr-6"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editingProject && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                  >
                    <option value="active">Em Andamento</option>
                    <option value="completed">Concluído</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Descrição</label>
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
                  {editingProject ? 'Salvar Alterações' : 'Criar Projeto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!projectToDelete}
        title="Excluir Projeto"
        message="Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        onCancel={() => setProjectToDelete(null)}
        confirmText="Excluir"
        isDestructive={true}
      />

      <AlertModal
        isOpen={!!alertMessage}
        title="Atenção"
        message={alertMessage || ''}
        onClose={() => setAlertMessage(null)}
      />
    </div>
  );
}
