export interface Client {
  id: string;
  name: string;
  cpf: string;
  address: string;
  contact: string;
  createdAt: any;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description: string;
  totalValue: number;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: any;
}

export interface Installment {
  id: string;
  projectId: string;
  amount: number;
  percentage: number;
  dueDate: any;
  status: 'pending' | 'paid';
  paidAt?: any;
}

export interface Expense {
  id: string;
  projectId?: string;
  description: string;
  amount: number;
  date: any;
  category: string;
}

export interface Contract {
  id: string;
  clientId: string;
  contractNumber: string;
  status: 'active' | 'completed' | 'cancelled' | 'draft';
  createdAt: any;
  totalValue: number;
  description?: string;
}

export interface Settings {
  expenseCategories: string[];
  officeName?: string;
}
