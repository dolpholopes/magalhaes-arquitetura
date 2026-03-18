import React, { useState } from 'react';
import { Settings } from '../types';
import { Settings as SettingsIcon, Plus, Trash2, Save, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  settings: Settings;
  onUpdate: (data: Partial<Settings>) => void;
}

export function SettingsTab({ settings, onUpdate }: Props) {
  const [newCategory, setNewCategory] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    
    if (settings.expenseCategories.includes(newCategory.trim())) {
      setNewCategory('');
      return;
    }

    onUpdate({
      expenseCategories: [...settings.expenseCategories, newCategory.trim()]
    });
    setNewCategory('');
    triggerSuccess();
  };

  const handleRemoveCategory = (category: string) => {
    onUpdate({
      expenseCategories: settings.expenseCategories.filter(c => c !== category)
    });
    triggerSuccess();
  };

  const triggerSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Configurações</h2>
          <p className="text-slate-500">Gerencie as preferências e categorias do seu escritório.</p>
        </div>
        {showSuccess && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Salvo com sucesso!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Expense Categories */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
            <div className="h-10 w-10 bg-white text-slate-600 rounded-xl flex items-center justify-center shadow-sm">
              <SettingsIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Categorias de Despesas</h3>
              <p className="text-[10px] text-slate-500 font-medium">Personalize as categorias para classificar seus gastos.</p>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text"
                placeholder="Nova categoria (ex: Limpeza, Viagens...)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none transition-all"
              />
              <button
                type="submit"
                className="bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-lg shadow-slate-200"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">Adicionar</span>
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {settings.expenseCategories.map((category) => (
                <div 
                  key={category}
                  className="group flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-slate-300 hover:bg-white transition-all"
                >
                  <span className="text-sm font-medium text-slate-700">{category}</span>
                  <button
                    onClick={() => handleRemoveCategory(category)}
                    className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            
            {settings.expenseCategories.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-slate-400 text-sm italic">Nenhuma categoria personalizada cadastrada.</p>
              </div>
            )}
          </div>
        </div>

        {/* Future Settings Placeholder */}
        <div className="bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-12 text-center">
          <SettingsIcon className="h-12 w-12 text-slate-200 mx-auto mb-4" />
          <h4 className="text-slate-400 font-bold uppercase tracking-widest text-xs">Novas Configurações em Breve</h4>
          <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
            Estamos trabalhando em novas opções de personalização para o seu escritório.
          </p>
        </div>
      </div>
    </div>
  );
}
