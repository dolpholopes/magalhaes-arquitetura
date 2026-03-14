import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { formatDate } from '../utils/date';
import { Client, Project, Expense, Installment } from '../types';
import { Users, Briefcase, AlertCircle, CheckCircle2, Clock, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format, isAfter, isBefore, addDays, startOfDay, endOfDay } from 'date-fns';

interface Props {
  clients: Client[];
  projects: Project[];
  expenses: Expense[];
  allInstallments: Installment[];
}

export function DashboardTab({ clients, projects, expenses, allInstallments }: Props) {
  const activeProjects = projects.filter(p => p.status === 'active');
  const totalRevenue = allInstallments.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  
  const upcomingPayments = allInstallments
    .filter(i => {
      const date = i.dueDate instanceof Date ? i.dueDate : (i.dueDate as any).toDate();
      return i.status === 'pending' && isAfter(date, startOfDay(new Date()));
    })
    .sort((a, b) => {
      const dateA = a.dueDate instanceof Date ? a.dueDate.getTime() : (a.dueDate as any).toMillis();
      const dateB = b.dueDate instanceof Date ? b.dueDate.getTime() : (b.dueDate as any).toMillis();
      return dateA - dateB;
    })
    .slice(0, 5);

  const overduePayments = allInstallments
    .filter(i => {
      const date = i.dueDate instanceof Date ? i.dueDate : (i.dueDate as any).toDate();
      return i.status === 'pending' && isBefore(date, startOfDay(new Date()));
    });

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
          <p className="text-3xl font-black text-emerald-600">R$ {(totalRevenue - totalExpenses).toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Payments */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Próximos Vencimentos</h3>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingPayments.length > 0 ? upcomingPayments.map(inst => {
              const project = projects.find(p => p.id === inst.projectId);
              const client = clients.find(c => c.id === project?.clientId);
              return (
                <div key={inst.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold">
                      {format(inst.dueDate instanceof Date ? inst.dueDate : inst.dueDate.toDate(), 'dd')}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{project?.name}</p>
                      <p className="text-[10px] text-slate-500">{client?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">R$ {inst.amount.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] text-slate-600 font-bold uppercase">{formatDate(inst.dueDate)}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="p-8 text-center text-slate-400 text-sm">Nenhum pagamento próximo.</div>
            )}
          </div>
        </div>

        {/* Recent Activity / Overdue */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Atenção Necessária</h3>
            <AlertCircle className="h-4 w-4 text-red-400" />
          </div>
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
                    <p className="text-sm font-black text-red-600">R$ {inst.amount.toLocaleString('pt-BR')}</p>
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
        </div>
      </div>
    </div>
  );
}
