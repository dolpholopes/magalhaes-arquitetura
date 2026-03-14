import { format } from 'date-fns';

export function formatDate(date: any): string {
  if (!date) return 'N/A';
  
  // Handle Firestore Timestamp
  if (typeof date.toDate === 'function') {
    return format(date.toDate(), 'dd/MM/yyyy');
  }
  
  // Handle Date object
  if (date instanceof Date) {
    return format(date, 'dd/MM/yyyy');
  }
  
  // Handle string
  try {
    return format(new Date(date), 'dd/MM/yyyy');
  } catch (e) {
    return 'Data Inválida';
  }
}
