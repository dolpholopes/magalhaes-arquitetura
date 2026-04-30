/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, signIn, logOut, db, handleFirestoreError, OperationType, signInAnon } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, doc, getDocFromServer, addDoc, setDoc, updateDoc, deleteDoc, Timestamp, where, getDocs, writeBatch } from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LayoutDashboard, Users, Briefcase, DollarSign, Settings as SettingsIcon, LogOut, LogIn, FileText } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Tabs
import { ClientsTab } from './components/ClientsTab';
import { ProjectsTab } from './components/ProjectsTab';
import { FinanceTab } from './components/FinanceTab';
import { DashboardTab } from './components/DashboardTab';
import { ContractsTab } from './components/ContractsTab';
import { SettingsTab } from './components/SettingsTab';
import { Logo } from './components/Logo';

import { Client, Project, Expense, Installment, Contract, Settings } from './types';
import { addMonths } from 'date-fns';

import { Modal } from './components/Modal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [installments, setInstallments] = useState<Record<string, Installment[]>>({});
  const [settings, setSettings] = useState<Settings>({ expenseCategories: ['Geral', 'Aluguel', 'Salários', 'Marketing', 'Software', 'Impostos'] });
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean, title: string, description: string } | null>(null);

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

  const handleAddContract = async (data: Omit<Contract, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, `users/${user.uid}/contracts`), {
        ...data,
        createdAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/contracts`);
    }
  };

  const handleUpdateContract = async (id: string, data: Partial<Contract>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/contracts/${id}`), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/contracts/${id}`);
    }
  };

  const handleDeleteContract = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/contracts/${id}`));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/contracts/${id}`);
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
      if (data.projectId === '') updateData.projectId = null;
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

  const handleUpdateSettings = async (data: Partial<Settings>) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/settings/general`), {
        ...settings,
        ...data
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/settings/general`);
    }
  };

  const handleResetAndPopulate = async () => {
    if (!user) return;
    
    try {
      const collections = ['clients', 'projects', 'contracts', 'expenses', 'installments'];
      
      // Delete all existing data
      for (const collName of collections) {
        const collRef = collection(db, `users/${user.uid}/${collName}`);
        const snapshot = await getDocs(collRef);
        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }

      // Populate with sample data
      // 1. Clients
      const client1 = await addDoc(collection(db, `users/${user.uid}/clients`), {
        name: 'Construtora Horizonte',
        email: 'contato@horizonte.com.br',
        phone: '(11) 98888-7777',
        address: 'Av. Paulista, 1000 - São Paulo, SP',
        createdAt: Timestamp.now()
      });

      const client2 = await addDoc(collection(db, `users/${user.uid}/clients`), {
        name: 'Residencial Vila Verde',
        email: 'adm@vilaverde.com.br',
        phone: '(11) 97777-6666',
        address: 'Rua das Flores, 500 - Campinas, SP',
        createdAt: Timestamp.now()
      });

      // 2. Projects & Installments
      // Project 1
      const proj1Value = 15000;
      const proj1Ref = await addDoc(collection(db, `users/${user.uid}/projects`), {
        clientId: client1.id,
        name: 'Reforma Apartamento 402',
        description: 'Reforma completa da área social e cozinha.',
        totalValue: proj1Value,
        status: 'active',
        createdAt: Timestamp.now()
      });

      for (let i = 0; i < 3; i++) {
        await addDoc(collection(db, `users/${user.uid}/installments`), {
          projectId: proj1Ref.id,
          amount: proj1Value / 3,
          percentage: 33.33,
          dueDate: Timestamp.fromDate(addMonths(new Date(), i)),
          status: i === 0 ? 'paid' : 'pending',
          paidAt: i === 0 ? Timestamp.now() : null
        });
      }

      // Project 2
      const proj2Value = 45000;
      const proj2Ref = await addDoc(collection(db, `users/${user.uid}/projects`), {
        clientId: client2.id,
        name: 'Projeto Sede Corporativa',
        description: 'Projeto arquitetônico e executivo para nova sede.',
        totalValue: proj2Value,
        status: 'active',
        createdAt: Timestamp.now()
      });

      for (let i = 0; i < 5; i++) {
        await addDoc(collection(db, `users/${user.uid}/installments`), {
          projectId: proj2Ref.id,
          amount: proj2Value / 5,
          percentage: 20,
          dueDate: Timestamp.fromDate(addMonths(new Date(), i)),
          status: 'pending'
        });
      }

      // 3. Expenses
      const expenseCategories = settings.expenseCategories;
      await addDoc(collection(db, `users/${user.uid}/expenses`), {
        description: 'Aluguel Escritório',
        amount: 3500,
        category: expenseCategories[1] || 'Aluguel',
        date: Timestamp.now(),
        status: 'paid'
      });

      await addDoc(collection(db, `users/${user.uid}/expenses`), {
        description: 'Software Adobe Creative Cloud',
        amount: 250,
        category: expenseCategories[4] || 'Software',
        date: Timestamp.now(),
        status: 'paid'
      });

      // 4. Contracts
      await addDoc(collection(db, `users/${user.uid}/contracts`), {
        clientId: client1.id,
        contractNumber: '2024-001',
        description: 'Contrato referente ao projeto de reforma do apartamento 402...',
        status: 'active',
        totalValue: 15000,
        createdAt: Timestamp.now()
      });

    } catch (error) {
      console.error("Error resetting and populating data:", error);
      setErrorModal({
        isOpen: true,
        title: "Erro ao Resetar Dados",
        description: "Ocorreu um problema ao tentar limpar e popular o banco de dados. Por favor, tente novamente ou verifique sua conexão."
      });
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

    const contractsRef = collection(db, `users/${user.uid}/contracts`);
    const unsubContracts = onSnapshot(query(contractsRef, orderBy('createdAt', 'desc')), (snapshot) => {
      setContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/contracts`));

    const settingsRef = doc(db, `users/${user.uid}/settings/general`);
    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as Settings);
      } else {
        setDoc(settingsRef, {
          expenseCategories: ['Geral', 'Aluguel', 'Salários', 'Marketing', 'Software', 'Impostos']
        });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/settings/general`));

    return () => {
      unsubClients();
      unsubProjects();
      unsubExpenses();
      unsubInstallments();
      unsubContracts();
      unsubSettings();
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
    { id: 'contracts', label: 'Contratos', icon: FileText },
    { id: 'finance', label: 'Financeiro', icon: DollarSign },
    { id: 'settings', label: 'Configurações', icon: SettingsIcon },
  ];

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F4] p-4">
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <Logo className="w-16 h-16 mx-auto mb-6 text-slate-900" />
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
        
        <div className="mt-8 text-center text-[10px] text-slate-300 font-montserrat uppercase tracking-widest select-none">
          © 2023 - 2026. Todos direitos reservados a RR Sistemas.
        </div>
      </div>
    );
  }

  const isAnonymous = user.isAnonymous;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F5F5F4] flex flex-col md:flex-row pb-16 md:pb-0">
        {errorModal && (
          <Modal
            isOpen={errorModal.isOpen}
            onClose={() => setErrorModal(null)}
            title={errorModal.title}
            description={errorModal.description}
            type="error"
            confirmLabel="Entendido"
          />
        )}
        {/* Sidebar / Mobile Header */}
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-row md:flex-col justify-between md:justify-start md:sticky md:top-0 md:h-screen z-20">
          <div className="p-4 md:p-6 flex items-center justify-between md:justify-start w-full md:w-auto">
            <div className="flex items-center space-x-4">
              <Logo className="w-10 h-10 shrink-0 text-slate-900" />
              <div className="border-l border-slate-100 pl-4">
                <h1 className="text-xs font-light tracking-[0.15em] uppercase text-slate-800 leading-tight">
                  Magalhães<br />
                  <span className="font-bold tracking-normal">Arquitetura</span>
                </h1>
              </div>
            </div>
            
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
        <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
          <div className="max-w-7xl mx-auto w-full min-h-full flex flex-col">
            <div className="flex-1">
              {activeTab === 'dashboard' && (
                <DashboardTab 
                  clients={clients} 
                  projects={projects} 
                  contracts={contracts}
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
                  expenseCategories={settings.expenseCategories}
                  onAddExpense={handleAddExpense}
                  onUpdateExpense={handleUpdateExpense}
                  onDeleteExpense={handleDeleteExpense}
                />
              )}
              {activeTab === 'contracts' && (
                <ContractsTab 
                  contracts={contracts} 
                  clients={clients}
                  onAdd={handleAddContract}
                  onUpdate={handleUpdateContract}
                  onDelete={handleDeleteContract}
                />
              )}
              {activeTab === 'settings' && (
                <SettingsTab 
                  settings={settings}
                  onUpdate={handleUpdateSettings}
                  onResetData={handleResetAndPopulate}
                />
              )}
            </div>

            <div className="mt-8 text-center text-[10px] text-slate-300 font-montserrat uppercase tracking-widest select-none">
              © 2023 - 2026. Todos direitos reservados a RR Sistemas.
            </div>
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
