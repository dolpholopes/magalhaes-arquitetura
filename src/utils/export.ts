import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const val = row[header];
      return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (title: string, headers: string[], rows: any[][], filename: string) => {
  const doc = new jsPDF() as any;
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);

  doc.autoTable({
    startY: 35,
    head: [headers],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
  });

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};
