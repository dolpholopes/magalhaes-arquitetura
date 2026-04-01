import React from 'react';
import { X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  type?: 'info' | 'warning' | 'error' | 'success';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  isDestructive?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  type = 'info',
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  isDestructive = false
}: ModalProps) {
  if (!isOpen) return null;

  const icons = {
    info: <Info className="h-6 w-6 text-blue-600" />,
    warning: <AlertTriangle className="h-6 w-6 text-amber-600" />,
    error: <AlertTriangle className="h-6 w-6 text-red-600" />,
    success: <CheckCircle2 className="h-6 w-6 text-emerald-600" />
  };

  const bgColors = {
    info: 'bg-blue-50',
    warning: 'bg-amber-50',
    error: 'bg-red-50',
    success: 'bg-emerald-50'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={cn("p-3 rounded-2xl", bgColors[type])}>
              {icons[type]}
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          {description && (
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              {description}
            </p>
          )}

          {children}

          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            {confirmLabel && (
              <button
                onClick={() => {
                  onConfirm?.();
                  onClose();
                }}
                className={cn(
                  "flex-1 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all shadow-lg",
                  isDestructive 
                    ? "bg-red-600 text-white hover:bg-red-700 shadow-red-100" 
                    : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200"
                )}
              >
                {confirmLabel}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider text-slate-600 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
