import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, onSnapshot, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Project, Expense, Installment, Client } from '../types';
import { Plus, Search, Edit2, Trash2, X, DollarSign, TrendingUp, TrendingDown, PieChart as PieChartIcon, Filter, Download, FileText, ChevronDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, isSameMonth, startOfYear, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { exportToPDF } from '../utils/export';
import { formatDate } from '../utils/date';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ConfirmModal } from './ConfirmModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  label 
}: { 
  options: { id: string, name: string }[], 
  value: string, 
  onChange: (id: string) => void, 
  placeholder: string,
  label: string
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const selectedOption = options.find(o => o.id === value);
  const filteredOptions = options.filter(o => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-1 relative">
      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500 flex items-center justify-between text-left transition-all"
      >
        <span className={cn("truncate mr-2", selectedOption ? "text-slate-900 font-medium" : "text-slate-400")}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform flex-shrink-0", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  onChange('all');
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors",
                  value === 'all' ? "bg-slate-50 text-slate-900 font-bold border-l-4 border-slate-800" : "text-slate-600 pl-5"
                )}
              >
                {placeholder}
              </button>
              {filteredOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={cn(
                    "w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors",
                    value === option.id ? "bg-slate-50 text-slate-900 font-bold border-l-4 border-slate-800" : "text-slate-600 pl-5"
                  )}
                >
                  {option.name}
                </button>
              ))}
              {filteredOptions.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-400 text-sm italic">
                  Nenhum resultado encontrado
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  projects: Project[];
  clients: Client[];
  expenses: Expense[];
  allInstallments: Installment[];
  onAddExpense: (data: Omit<Expense, 'id'>) => void;
  onUpdateExpense: (id: string, data: Partial<Expense>) => void;
  onDeleteExpense: (id: string) => void;
}

export function FinanceTab({ projects, clients, expenses, allInstallments, onAddExpense, onUpdateExpense, onDeleteExpense }: Props) {
  const [dateFilter, setDateFilter] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [periodType, setPeriodType] = useState<'month' | 'custom'>('month');
  const [clientFilter, setClientFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  const currentYear = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => new Date(currentYear, i, 1));

  const handleMonthClick = (month: Date) => {
    setPeriodType('month');
    setDateFilter({
      start: format(startOfMonth(month), 'yyyy-MM-dd'),
      end: format(endOfMonth(month), 'yyyy-MM-dd')
    });
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    projectId: '',
    description: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'Geral'
  });

  const filteredExpenses = expenses.filter(e => {
    const date = e.date instanceof Date ? e.date : (e.date as any).toDate();
    const isWithinDate = isWithinInterval(date, { 
      start: parseISO(dateFilter.start), 
      end: parseISO(dateFilter.end) 
    });
    const isProjectMatch = projectFilter === 'all' || e.projectId === projectFilter;
    const project = projects.find(p => p.id === e.projectId);
    const isClientMatch = clientFilter === 'all' || (project && project.clientId === clientFilter);
    return isWithinDate && isProjectMatch && isClientMatch;
  });

  const filteredInstallments = allInstallments.filter(i => {
    const date = i.dueDate instanceof Date ? i.dueDate : (i.dueDate as any).toDate();
    const isWithinDate = isWithinInterval(date, { 
      start: parseISO(dateFilter.start), 
      end: parseISO(dateFilter.end) 
    });
    const isProjectMatch = projectFilter === 'all' || i.projectId === projectFilter;
    const project = projects.find(p => p.id === i.projectId);
    const isClientMatch = clientFilter === 'all' || (project && project.clientId === clientFilter);
    return isWithinDate && isProjectMatch && isClientMatch;
  });

  const totalRevenue = filteredInstallments.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0);
  const pendingRevenue = filteredInstallments.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.amount, 0);
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const balance = totalRevenue - totalExpenses;

  // Chart Data
  const revenueByProject = projects.map(p => ({
    name: p.name,
    receita: allInstallments.filter(i => i.projectId === p.id && i.status === 'paid').reduce((acc, i) => acc + i.amount, 0),
    despesa: expenses.filter(e => e.projectId === p.id).reduce((acc, e) => acc + e.amount, 0)
  })).filter(d => d.receita > 0 || d.despesa > 0);

  const statusData = [
    { name: 'Pago', value: totalRevenue, color: '#10B981' },
    { name: 'Pendente', value: pendingRevenue, color: '#F59E0B' },
    { name: 'Despesas', value: totalExpenses, color: '#EF4444' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onAddExpense({
      ...formData,
      date: new Date(formData.date) as any
    });
    setIsModalOpen(false);
    setFormData({ projectId: '', description: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd'), category: 'Geral' });
  };

  const handleDeleteExpenseClick = async (id: string) => {
    setExpenseToDelete(id);
  };

  const confirmDeleteExpense = () => {
    if (expenseToDelete) {
      onDeleteExpense(expenseToDelete);
      setExpenseToDelete(null);
    }
  };

  const handleExportPDF = () => {
    const headers = ['Descrição', 'Valor', 'Data', 'Categoria', 'Projeto'];
    const rows = filteredExpenses.map(e => [
      e.description,
      `R$ ${e.amount.toLocaleString('pt-BR')}`,
      formatDate(e.date),
      e.category,
      projects.find(p => p.id === e.projectId)?.name || 'Geral'
    ]);
    exportToPDF('Relatório Financeiro', headers, rows, 'financeiro');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Financeiro</h2>
          <p className="text-slate-500">Análise de receitas, despesas e saúde do escritório.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} className="p-2 text-slate-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all">
            <Download className="h-5 w-5" />
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
          >
            <Plus className="h-5 w-5" />
            <span>Nova Despesa</span>
          </button>
        </div>
      </div>

      {/* Filters */}
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

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {periodType === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-100">
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
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Cliente"
              placeholder="Todos os Clientes"
              options={clients.map(c => ({ id: c.id, name: c.name }))}
              value={clientFilter}
              onChange={(id) => {
                setClientFilter(id);
                setProjectFilter('all');
              }}
            />
            <SearchableSelect
              label="Projeto"
              placeholder="Todos os Projetos"
              options={projects
                .filter(p => clientFilter === 'all' || p.clientId === clientFilter)
                .map(p => ({ id: p.id, name: p.name }))}
              value={projectFilter}
              onChange={(id) => setProjectFilter(id)}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Receita Recebida</p>
          </div>
          <p className="text-2xl font-black text-slate-900">R$ {totalRevenue.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-5 w-5 opacity-50" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Receita Pendente</p>
          </div>
          <p className="text-2xl font-black text-slate-900">R$ {pendingRevenue.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <TrendingDown className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Despesas</p>
          </div>
          <p className="text-2xl font-black text-slate-900">R$ {totalExpenses.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Saldo Líquido</p>
          </div>
          <p className={cn("text-2xl font-black", balance >= 0 ? "text-emerald-600" : "text-red-600")}>
            R$ {balance.toLocaleString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Receita vs Despesa por Projeto</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByProject}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#F8FAFC' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 20 }} />
                <Bar dataKey="receita" fill="#475569" radius={[4, 4, 0, 0]} name="Receita" />
                <Bar dataKey="despesa" fill="#EF4444" radius={[4, 4, 0, 0]} name="Despesa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Distribuição Financeira</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Histórico de Despesas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Data</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Descrição</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Categoria</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Projeto</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Valor</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-sm text-slate-600">{formatDate(e.date)}</td>
                  <td className="p-4 text-sm font-medium text-slate-900">{e.description}</td>
                  <td className="p-4 text-sm text-slate-600">
                    <span className="px-2 py-1 bg-slate-100 rounded-md text-[10px] font-bold uppercase">{e.category}</span>
                  </td>
                  <td className="p-4 text-sm text-slate-600">{projects.find(p => p.id === e.projectId)?.name || '-'}</td>
                  <td className="p-4 text-sm font-bold text-red-600">R$ {e.amount.toLocaleString('pt-BR')}</td>
                  <td className="p-4">
                    <button onClick={() => handleDeleteExpenseClick(e.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">Nova Despesa</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Descrição</label>
                <input
                  required
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Valor</label>
                  <input
                    required
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Data</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Categoria</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                >
                  <option value="Geral">Geral</option>
                  <option value="Aluguel">Aluguel</option>
                  <option value="Salários">Salários</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Software">Software</option>
                  <option value="Impostos">Impostos</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Projeto Vinculado (Opcional)</label>
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                >
                  <option value="">Nenhum</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-200">
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!expenseToDelete}
        title="Excluir Despesa"
        message="Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita."
        onConfirm={confirmDeleteExpense}
        onCancel={() => setExpenseToDelete(null)}
        confirmText="Excluir"
        isDestructive={true}
      />
    </div>
  );
}
