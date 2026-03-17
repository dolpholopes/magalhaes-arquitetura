import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const exportToPDF = (title: string, headers: string[], rows: any[][], filename: string) => {
  const doc = new jsPDF();
  
  // Text "Magalhães Arquitetura"
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'normal');
  doc.text('MAGALHÃES', 14, 16);
  doc.setFont('helvetica', 'bold');
  doc.text('ARQUITETURA', 14, 22);

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
