/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, signIn, logOut, db, handleFirestoreError, OperationType, signInAnon } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, doc, getDocFromServer } from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LayoutDashboard, Users, Briefcase, DollarSign, Settings as SettingsIcon, LogOut, LogIn } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Tabs
import { ClientsTab } from './components/ClientsTab';
import { ProjectsTab } from './components/ProjectsTab';
import { FinanceTab } from './components/FinanceTab';
import { DashboardTab } from './components/DashboardTab';

import { Client, Project, Expense, Installment } from './types';
import { addMonths } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [clients, setClients] = useState<Client[]>([
    { id: '1', name: 'João Silva', cpf: '123.456.789-00', address: 'Rua A, 123', contact: '(11) 98888-8888', email: 'joao@email.com', createdAt: new Date() as any },
    { id: '2', name: 'Maria Santos', cpf: '987.654.321-11', address: 'Av. B, 456', contact: '(11) 97777-7777', email: 'maria@email.com', createdAt: new Date() as any },
  ]);
  const [projects, setProjects] = useState<Project[]>([
    { id: 'p1', clientId: '1', name: 'Reforma Cozinha', description: 'Reforma completa da cozinha', totalValue: 15000, status: 'active', createdAt: new Date() as any },
  ]);
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: 'e1', description: 'Material de Construção', amount: 5000, date: new Date() as any, category: 'Material' },
  ]);
  const [installments, setInstallments] = useState<Record<string, Installment[]>>({
    'p1': [
      { id: 'i1', projectId: 'p1', amount: 7500, percentage: 50, dueDate: new Date() as any, status: 'paid', paidAt: new Date() as any },
      { id: 'i2', projectId: 'p1', amount: 7500, percentage: 50, dueDate: addMonths(new Date(), 1) as any, status: 'pending' },
    ]
  });

  // Local CRUD Handlers
  const handleAddClient = (data: Omit<Client, 'id' | 'createdAt'>) => {
    const newClient = { ...data, id: Math.random().toString(36).substr(2, 9), createdAt: new Date() as any };
    setClients(prev => [...prev, newClient]);
  };
  const handleUpdateClient = (id: string, data: Partial<Client>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  };
  const handleDeleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  };

  const handleAddProject = (data: Omit<Project, 'id' | 'createdAt'> & { numInstallments: number }) => {
    const projectId = Math.random().toString(36).substr(2, 9);
    const newProject = { 
      clientId: data.clientId,
      name: data.name,
      description: data.description,
      totalValue: data.totalValue,
      status: data.status,
      id: projectId, 
      createdAt: new Date() as any 
    };
    
    // Generate installments
    const installmentValue = data.totalValue / data.numInstallments;
    const percentage = 100 / data.numInstallments;
    const newInstallments: Installment[] = [];
    
    for (let i = 0; i < data.numInstallments; i++) {
      newInstallments.push({
        id: Math.random().toString(36).substr(2, 9),
        projectId: projectId,
        amount: installmentValue,
        percentage: percentage,
        dueDate: addMonths(new Date(), i) as any,
        status: 'pending'
      });
    }

    setProjects(prev => [...prev, newProject]);
    setInstallments(prev => ({ ...prev, [projectId]: newInstallments }));
  };

  const handleUpdateProject = (id: string, data: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setInstallments(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleToggleInstallment = (projectId: string, installmentId: string) => {
    setInstallments(prev => ({
      ...prev,
      [projectId]: prev[projectId].map(inst => 
        inst.id === installmentId 
          ? { ...inst, status: inst.status === 'paid' ? 'pending' : 'paid', paidAt: inst.status === 'paid' ? undefined : new Date() as any }
          : inst
      )
    }));
  };

  const handleUpdateInstallment = (projectId: string, installmentId: string, data: Partial<Installment>) => {
    setInstallments(prev => ({
      ...prev,
      [projectId]: prev[projectId].map(inst => 
        inst.id === installmentId ? { ...inst, ...data } : inst
      )
    }));
  };

  const handleAddExpense = (data: Omit<Expense, 'id'>) => {
    const newExpense = { ...data, id: Math.random().toString(36).substr(2, 9) };
    setExpenses(prev => [...prev, newExpense]);
  };
  const handleUpdateExpense = (id: string, data: Partial<Expense>) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  };
  const handleDeleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      // For now, we'll just set a mock user if not authenticated to bypass login screen
      if (!u) {
        setUser({
          uid: 'local-user',
          displayName: 'Usuário Local',
          email: 'local@exemplo.com',
          isAnonymous: true,
          photoURL: 'https://picsum.photos/seed/local/200'
        } as User);
        setLoading(false);
      } else {
        setUser(u);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Disable Firebase listeners for now
  useEffect(() => {
    // Firebase is disabled as per user request
    return () => {};
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'projects', label: 'Projetos', icon: Briefcase },
    { id: 'finance', label: 'Financeiro', icon: DollarSign },
  ];

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  const isAnonymous = user.isAnonymous;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F5F5F4] flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-6">
            <div className="flex items-center space-x-4">
              <div className="relative w-10 h-10 shrink-0">
                <span className="absolute left-0 top-0 text-3xl font-light text-slate-900 leading-none select-none">J</span>
                <span className="absolute left-2.5 top-1.5 text-3xl font-extralight text-slate-400 leading-none mix-blend-multiply select-none opacity-80">M</span>
              </div>
              <div className="border-l border-slate-100 pl-4">
                <h1 className="text-xs font-light tracking-[0.15em] uppercase text-slate-800 leading-tight">
                  Magalhães<br />
                  <span className="font-bold tracking-normal">Arquitetura</span>
                </h1>
              </div>
            </div>
            <p className="text-[8px] uppercase tracking-[0.3em] text-slate-400 font-medium mt-4 ml-1">
              {isAnonymous ? 'Modo de Teste' : 'Office Control v1.0'}
            </p>
          </div>
          
          <nav className="flex-1 px-4 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  activeTab === tab.id 
                    ? "bg-slate-100 text-slate-900 shadow-sm" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <tab.icon className={cn("h-5 w-5", activeTab === tab.id ? "text-slate-800" : "text-slate-400")} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center space-x-3 px-4 py-3">
              <img 
                src={user.photoURL || `https://picsum.photos/seed/${user.uid}/200`} 
                alt="" 
                className="h-8 w-8 rounded-full border border-slate-200" 
                referrerPolicy="no-referrer" 
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user.displayName || (isAnonymous ? 'Usuário de Teste' : 'Usuário')}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{user.email || 'Acesso Anônimo'}</p>
              </div>
              <button 
                onClick={isAnonymous ? signIn : logOut} 
                className={cn("transition-colors", isAnonymous ? "text-slate-600 hover:text-slate-800" : "text-slate-400 hover:text-red-600")}
                title={isAnonymous ? "Entrar com Google" : "Sair"}
              >
                {isAnonymous ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <DashboardTab 
                clients={clients} 
                projects={projects} 
                expenses={expenses} 
                allInstallments={Object.values(installments).flat()} 
              />
            )}
            {activeTab === 'clients' && (
              <ClientsTab 
                clients={clients} 
                onAdd={handleAddClient}
                onUpdate={handleUpdateClient}
                onDelete={handleDeleteClient}
              />
            )}
            {activeTab === 'projects' && (
              <ProjectsTab 
                clients={clients} 
                projects={projects} 
                installments={installments}
                onAdd={handleAddProject}
                onUpdate={handleUpdateProject}
                onDelete={handleDeleteProject}
                onToggleInstallment={handleToggleInstallment}
                onUpdateInstallment={handleUpdateInstallment}
              />
            )}
            {activeTab === 'finance' && (
              <FinanceTab 
                projects={projects} 
                expenses={expenses} 
                allInstallments={Object.values(installments).flat()}
                onAddExpense={handleAddExpense}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
              />
            )}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
