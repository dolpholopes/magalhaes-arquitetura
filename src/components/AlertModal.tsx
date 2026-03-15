import React from 'react';
import { X, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  buttonText?: string;
}

export function AlertModal({ 
  isOpen, 
  title, 
  message, 
  onClose, 
  buttonText = 'Entendi'
}: Props) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-slate-600 text-sm">{message}</p>
        </div>
        <div className="p-6 pt-0">
          <button 
            onClick={onClose} 
            className="w-full py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
