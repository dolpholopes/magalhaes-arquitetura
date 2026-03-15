import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const exportToPDF = (title: string, headers: string[], rows: any[][], filename: string) => {
  const doc = new jsPDF();
  
  // Logo "JM"
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(24);
  doc.setTextColor(203, 213, 225); // slate-300 (M)
  doc.text('M', 18, 20);
  doc.setTextColor(15, 23, 42); // slate-900 (J)
  doc.text('J', 14, 18);
  
  // Text "Magalhães Arquitetura"
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('MAGALHÃES', 28, 16);
  doc.setFont('helvetica', 'bold');
  doc.text('ARQUITETURA', 28, 21);

  // Divider line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(14, 26, 196, 26);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, 38);
  
  // Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 45);

  autoTable(doc, {
    startY: 52,
    head: [headers],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42] }, // slate-900
  });

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};
