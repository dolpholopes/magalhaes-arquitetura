import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { formatDate } from '../utils/date';
import { Client, Project, Expense, Installment, Contract } from '../types';
import { Users, Briefcase, AlertCircle, CheckCircle2, Clock, TrendingUp, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { format, isAfter, isBefore, addDays, startOfDay, endOfDay } from 'date-fns';

interface Props {
  clients: Client[];
  projects: Project[];
  contracts: Contract[];
  expenses: Expense[];
  allInstallments: Installment[];
}

export function DashboardTab({ clients, projects, contracts, expenses, allInstallments }: Props) {
  const [financeSlide, setFinanceSlide] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);

  const activeProjects = projects.filter(p => p.status === 'active');
  const recentContracts = [...contracts].sort((a, b) => {
    const dateA = a.createdAt?.toMillis?.() || (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
    const dateB = b.createdAt?.toMillis?.() || (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
    return dateB - dateA;
  }).slice(0, 5);
  const recentClients = [...clients].sort((a, b) => {
    const dateA = a.createdAt?.toMillis?.() || (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
    const dateB = b.createdAt?.toMillis?.() || (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
    return dateB - dateA;
  }).slice(0, 5);

  const totalRevenue = allInstallments.filter(i => i.status === 'paid').reduce((acc, i) => acc + (i.amount || 0), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  
  const upcomingPayments = allInstallments
    .filter(i => {
      if (!i.dueDate) return false;
      const date = i.dueDate instanceof Date ? i.dueDate : (i.dueDate as any).toDate();
      return i.status === 'pending' && isAfter(date, startOfDay(new Date()));
    })
    .sort((a, b) => {
      const dateA = a.dueDate?.toMillis?.() || (a.dueDate instanceof Date ? a.dueDate.getTime() : 0);
      const dateB = b.dueDate?.toMillis?.() || (b.dueDate instanceof Date ? b.dueDate.getTime() : 0);
      return dateA - dateB;
    })
    .slice(0, 5);

  const overduePayments = allInstallments
    .filter(i => {
      if (!i.dueDate) return false;
      const date = i.dueDate instanceof Date ? i.dueDate : (i.dueDate as any).toDate();
      return i.status === 'pending' && isBefore(date, startOfDay(new Date()));
    });

  const financeSlides = [
    {
      id: 'upcoming',
      title: 'Próximos Vencimentos',
      icon: <Clock className="h-4 w-4 text-slate-400" />,
      content: (
        <div className="divide-y divide-slate-100">
          {upcomingPayments.length > 0 ? upcomingPayments.map(inst => {
            const project = projects.find(p => p.id === inst.projectId);
            const client = clients.find(c => c.id === project?.clientId);
            return (
              <div key={inst.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold">
                    {inst.dueDate ? format(inst.dueDate instanceof Date ? inst.dueDate : inst.dueDate.toDate(), 'dd') : '--'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{project?.name}</p>
                    <p className="text-[10px] text-slate-500">{client?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">R$ {(inst.amount || 0).toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] text-slate-600 font-bold uppercase">{formatDate(inst.dueDate)}</p>
                </div>
              </div>
            );
          }) : (
            <div className="p-8 text-center text-slate-400 text-sm">Nenhum pagamento próximo.</div>
          )}
        </div>
      )
    },
    {
      id: 'overdue',
      title: 'Atenção Necessária',
      icon: <AlertCircle className="h-4 w-4 text-red-400" />,
      content: (
        <div className="divide-y divide-slate-100">
          {overduePayments.length > 0 ? overduePayments.map(inst => {
            const project = projects.find(p => p.id === inst.projectId);
            const client = clients.find(c => c.id === project?.clientId);
            return (
              <div key={inst.id} className="p-4 flex items-center justify-between bg-red-50/30">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center font-bold">
                    !
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{project?.name}</p>
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Atrasado</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-red-600">R$ {(inst.amount || 0).toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] text-slate-500">{client?.name}</p>
                </div>
              </div>
            );
          }) : (
            <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <span>Tudo em dia! Nenhuma parcela atrasada.</span>
            </div>
          )}
        </div>
      )
    }
  ];

  const activeSlides = [
    {
      id: 'projects',
      title: 'Projetos Ativos',
      icon: <Briefcase className="h-4 w-4 text-blue-400" />,
      content: (
        <div className="divide-y divide-slate-100">
          {activeProjects.length > 0 ? activeProjects.slice(0, 5).map(project => {
            const client = clients.find(c => c.id === project.clientId);
            return (
              <div key={project.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{project.name}</p>
                    <p className="text-[10px] text-slate-500">{client?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">R$ {(project.totalValue || 0).toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] text-blue-600 font-bold uppercase">Ativo</p>
                </div>
              </div>
            );
          }) : (
            <div className="p-8 text-center text-slate-400 text-sm">Nenhum projeto ativo.</div>
          )}
        </div>
      )
    },
    {
      id: 'contracts',
      title: 'Contratos',
      icon: <FileText className="h-4 w-4 text-amber-400" />,
      content: (
        <div className="divide-y divide-slate-100">
          {recentContracts.length > 0 ? recentContracts.map(contract => {
            const client = clients.find(c => c.id === contract.clientId);
            const statusColors = {
              active: 'text-amber-600 bg-amber-50',
              completed: 'text-emerald-600 bg-emerald-50',
              cancelled: 'text-red-600 bg-red-50',
              draft: 'text-slate-600 bg-slate-50'
            };
            const statusLabels = {
              active: 'Ativo',
              completed: 'Concluído',
              cancelled: 'Cancelado',
              draft: 'Rascunho'
            };
            const currentStatus = contract.status || 'draft';
            const colorClass = statusColors[currentStatus as keyof typeof statusColors] || statusColors.draft;
            const label = statusLabels[currentStatus as keyof typeof statusLabels] || 'Rascunho';

            return (
              <div key={contract.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 ${colorClass} rounded-xl flex items-center justify-center font-bold`}>
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">#{contract.contractNumber}</p>
                    <p className="text-[10px] text-slate-500">{client?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">R$ {(contract.totalValue || 0).toLocaleString('pt-BR')}</p>
                  <p className={`text-[10px] font-bold uppercase ${(colorClass || '').split(' ')[0]}`}>
                    {label}
                  </p>
                </div>
              </div>
            );
          }) : (
            <div className="p-8 text-center text-slate-400 text-sm">Nenhum contrato cadastrado.</div>
          )}
        </div>
      )
    },
    {
      id: 'clients',
      title: 'Últimos Clientes',
      icon: <Users className="h-4 w-4 text-emerald-400" />,
      content: (
        <div className="divide-y divide-slate-100">
          {recentClients.length > 0 ? recentClients.map(client => (
            <div key={client.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
                  {client.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{client.name}</p>
                  <p className="text-[10px] text-slate-500">{client.contact}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Cadastrado em</p>
                <p className="text-xs text-slate-600">{formatDate(client.createdAt)}</p>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-slate-400 text-sm">Nenhum cliente cadastrado.</div>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Olá, Bem-vindo!</h2>
        <p className="text-slate-500">Aqui está o resumo do seu escritório hoje.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="h-12 w-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center mb-4">
            <Users className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total de Clientes</p>
          <p className="text-3xl font-black text-slate-900">{clients.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Briefcase className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Projetos Ativos</p>
          <p className="text-3xl font-black text-slate-900">{activeProjects.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="h-12 w-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Parcelas Atrasadas</p>
          <p className="text-3xl font-black text-red-600">{overduePayments.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Lucro Total</p>
          <p className="text-3xl font-black text-emerald-600">R$ {((totalRevenue || 0) - (totalExpenses || 0)).toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Finance Carousel */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{financeSlides[financeSlide].title}</h3>
              {financeSlides[financeSlide].icon}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setFinanceSlide(prev => (prev - 1 + financeSlides.length) % financeSlides.length)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-slate-400" />
              </button>
              <div className="flex gap-1">
                {financeSlides.map((_, i) => (
                  <div key={i} className={`h-1 w-4 rounded-full transition-colors ${i === financeSlide ? 'bg-slate-900' : 'bg-slate-200'}`} />
                ))}
              </div>
              <button 
                onClick={() => setFinanceSlide(prev => (prev + 1) % financeSlides.length)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            {financeSlides[financeSlide].content}
          </div>
        </div>

        {/* Active Items Carousel */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{activeSlides[activeSlide].title}</h3>
              {activeSlides[activeSlide].icon}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveSlide(prev => (prev - 1 + activeSlides.length) % activeSlides.length)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-slate-400" />
              </button>
              <div className="flex gap-1">
                {activeSlides.map((_, i) => (
                  <div key={i} className={`h-1 w-4 rounded-full transition-colors ${i === activeSlide ? 'bg-slate-900' : 'bg-slate-200'}`} />
                ))}
              </div>
              <button 
                onClick={() => setActiveSlide(prev => (prev + 1) % activeSlides.length)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            {activeSlides[activeSlide].content}
          </div>
        </div>
      </div>
    </div>
  );
}
