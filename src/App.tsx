/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, signIn, logOut, db, handleFirestoreError, OperationType, signInAnon } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, doc, getDocFromServer, addDoc, updateDoc, deleteDoc, Timestamp, where, getDocs, writeBatch } from 'firebase/firestore';
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
  
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [installments, setInstallments] = useState<Record<string, Installment[]>>({});

  // Firestore CRUD Handlers
  const handleAddClient = async (data: Omit<Client, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/clients`), {
        ...data,
        createdAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/clients`);
    }
  };

  const handleUpdateClient = async (id: string, data: Partial<Client>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/clients/${id}`), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/clients/${id}`);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/clients/${id}`));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/clients/${id}`);
    }
  };

  const handleAddProject = async (data: Omit<Project, 'id' | 'createdAt'> & { numInstallments: number, customInstallments?: number[], firstInstallmentDate?: string }) => {
    if (!user) return;

    const startDate = data.firstInstallmentDate ? new Date(data.firstInstallmentDate + 'T12:00:00') : new Date();

    try {
      const projectRef = await addDoc(collection(db, `users/${user.uid}/projects`), {
        clientId: data.clientId,
        name: data.name,
        description: data.description,
        totalValue: data.totalValue,
        status: data.status,
        createdAt: Timestamp.now()
      });
      
      for (let i = 0; i < data.numInstallments; i++) {
        const percentage = data.customInstallments?.[i] ?? (100 / data.numInstallments);
        const installmentValue = (data.totalValue * percentage) / 100;
        
        await addDoc(collection(db, `users/${user.uid}/installments`), {
          projectId: projectRef.id,
          amount: installmentValue,
          percentage: percentage,
          dueDate: Timestamp.fromDate(addMonths(startDate, i)),
          status: 'pending'
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/projects`);
    }
  };

  const handleUpdateProject = async (id: string, data: Partial<Project>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/projects/${id}`), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/projects/${id}`);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/projects/${id}`));
      const instQuery = query(collection(db, `users/${user.uid}/installments`), where('projectId', '==', id));
      const snapshot = await getDocs(instQuery);
      snapshot.forEach(async (docSnap) => {
        await deleteDoc(doc(db, `users/${user.uid}/installments/${docSnap.id}`));
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/projects/${id}`);
    }
  };

  const handleToggleInstallment = async (projectId: string, installmentId: string) => {
    if (!user) return;
    
    const projectInstallments = installments[projectId] || [];
    const inst = projectInstallments.find(i => i.id === installmentId);
    if (!inst) return;
    
    const newStatus = inst.status === 'paid' ? 'pending' : 'paid';
    const paidAt = newStatus === 'paid' ? Timestamp.now() : null;

    // Check if all installments will be paid
    const allWillBePaid = projectInstallments.every(i => 
      i.id === installmentId ? newStatus === 'paid' : i.status === 'paid'
    );
    
    const project = projects.find(p => p.id === projectId);
    const newProjectStatus = allWillBePaid ? 'completed' : (project?.status === 'completed' ? 'active' : project?.status);

    try {
      const batch = writeBatch(db);
      
      const instRef = doc(db, `users/${user.uid}/installments/${installmentId}`);
      batch.update(instRef, {
        status: newStatus,
        paidAt: paidAt
      });
      
      if (project && project.status !== newProjectStatus) {
        const projRef = doc(db, `users/${user.uid}/projects/${projectId}`);
        batch.update(projRef, {
          status: newProjectStatus
        });
      }
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/installments/${installmentId}`);
    }
  };

  const handleUpdateInstallment = async (projectId: string, installmentId: string, data: Partial<Installment>) => {
    if (!user) return;
    try {
      const updateData: any = { ...data };
      if (data.dueDate) updateData.dueDate = data.dueDate instanceof Date ? Timestamp.fromDate(data.dueDate) : data.dueDate;
      if (data.paidAt) updateData.paidAt = data.paidAt instanceof Date ? Timestamp.fromDate(data.paidAt) : data.paidAt;
      
      await updateDoc(doc(db, `users/${user.uid}/installments/${installmentId}`), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/installments/${installmentId}`);
    }
  };

  const handleAddExpense = async (data: Omit<Expense, 'id'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/expenses`), {
        ...data,
        date: data.date instanceof Date ? Timestamp.fromDate(data.date) : data.date
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/expenses`);
    }
  };

  const handleUpdateExpense = async (id: string, data: Partial<Expense>) => {
    if (!user) return;
    try {
      const updateData: any = { ...data };
      if (data.date) updateData.date = data.date instanceof Date ? Timestamp.fromDate(data.date) : data.date;
      await updateDoc(doc(db, `users/${user.uid}/expenses/${id}`), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/expenses/${id}`);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/expenses/${id}`));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/expenses/${id}`);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const clientsRef = collection(db, `users/${user.uid}/clients`);
    const projectsRef = collection(db, `users/${user.uid}/projects`);
    const expensesRef = collection(db, `users/${user.uid}/expenses`);
    const installmentsRef = collection(db, `users/${user.uid}/installments`);

    const unsubClients = onSnapshot(query(clientsRef, orderBy('createdAt', 'desc')), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/clients`));

    const unsubProjects = onSnapshot(query(projectsRef, orderBy('createdAt', 'desc')), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/projects`));

    const unsubExpenses = onSnapshot(query(expensesRef, orderBy('date', 'desc')), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/expenses`));

    const unsubInstallments = onSnapshot(query(installmentsRef, orderBy('dueDate', 'asc')), (snapshot) => {
      const insts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Installment));
      const grouped: Record<string, Installment[]> = {};
      insts.forEach(inst => {
        if (!grouped[inst.projectId]) grouped[inst.projectId] = [];
        grouped[inst.projectId].push(inst);
      });
      setInstallments(grouped);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/installments`));

    return () => {
      unsubClients();
      unsubProjects();
      unsubExpenses();
      unsubInstallments();
    };
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F4]">
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 text-center max-w-sm w-full mx-4">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <span className="absolute left-0 top-0 text-5xl font-light text-slate-900 leading-none select-none z-10">J</span>
            <span className="absolute left-3 top-2 text-5xl font-extralight bg-slate-300 text-white leading-none select-none z-0">M</span>
          </div>
          <h1 className="text-xl font-light tracking-[0.15em] uppercase text-slate-800 leading-tight mb-8">
            Magalhães<br />
            <span className="font-bold tracking-normal">Arquitetura</span>
          </h1>
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center space-x-2 bg-slate-900 text-white px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <LogIn className="h-5 w-5" />
            <span>Entrar com Google</span>
          </button>
        </div>
      </div>
    );
  }

  const isAnonymous = user.isAnonymous;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F5F5F4] flex flex-col md:flex-row pb-16 md:pb-0">
        {/* Sidebar / Mobile Header */}
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-row md:flex-col justify-between md:justify-start md:sticky md:top-0 md:h-screen z-20">
          <div className="p-4 md:p-6 flex items-center justify-between md:justify-start w-full md:w-auto">
            <div className="flex items-center space-x-4">
              <div className="relative w-10 h-10 shrink-0">
                <span className="absolute left-0 top-0 text-3xl font-light text-slate-900 leading-none select-none z-10">J</span>
                <span className="absolute left-2.5 top-1.5 text-3xl font-extralight bg-slate-300 text-white leading-none select-none z-0">M</span>
              </div>
              <div className="border-l border-slate-100 pl-4">
                <h1 className="text-xs font-light tracking-[0.15em] uppercase text-slate-800 leading-tight">
                  Magalhães<br />
                  <span className="font-bold tracking-normal">Arquitetura</span>
                </h1>
              </div>
            </div>
            <p className="hidden md:block text-[8px] uppercase tracking-[0.3em] text-slate-400 font-medium mt-4 ml-1">
              {isAnonymous ? 'Modo de Teste' : 'Office Control v1.0'}
            </p>
            
            {/* Mobile User Actions */}
            <div className="md:hidden flex items-center space-x-3">
              <button 
                onClick={isAnonymous ? signIn : logOut} 
                className={cn("transition-colors", isAnonymous ? "text-slate-600 hover:text-slate-800" : "text-slate-400 hover:text-red-600")}
                title={isAnonymous ? "Entrar com Google" : "Sair"}
              >
                {isAnonymous ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
              </button>
            </div>
          </div>
          
          <nav className="hidden md:block flex-1 px-4 space-y-1 mt-2">
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

          <div className="hidden md:block p-4 border-t border-slate-100">
            <div className="flex items-center space-x-3 px-4 py-3">
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
                clients={clients}
                expenses={expenses} 
                allInstallments={Object.values(installments).flat()}
                onAddExpense={handleAddExpense}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
              />
            )}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center z-50 pb-safe">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center w-full py-3 space-y-1 transition-colors",
                activeTab === tab.id 
                  ? "text-slate-900" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <tab.icon className={cn("h-5 w-5", activeTab === tab.id ? "text-slate-900" : "text-slate-400")} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </ErrorBoundary>
  );
}
