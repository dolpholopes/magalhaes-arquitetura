import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirmar', 
  cancelText = 'Cancelar',
  isDestructive = false
}: Props) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
      onClick={onCancel}
    >
      <div 
        className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center space-x-2">
            {isDestructive && <AlertTriangle className="h-5 w-5 text-red-500" />}
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-white rounded-full transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-slate-600 text-sm">{message}</p>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button 
            onClick={onCancel} 
            className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onCancel();
            }} 
            className={`flex-1 py-3 text-white rounded-xl font-medium transition-colors shadow-lg ${
              isDestructive 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-200' 
                : 'bg-slate-800 hover:bg-slate-900 shadow-slate-200'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
