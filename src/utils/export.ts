import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const exportToPDF = (title: string, headers: string[], rows: any[][], filename: string, orientation: 'p' | 'l' = 'p') => {
  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Text "Magalhães Arquitetura"
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'normal');
  doc.text('MAGALHÃES', 14, 16);
  doc.setFont('helvetica', 'bold');
  doc.text('ARQUITETURA', 14, 22);

  // Divider line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(14, 26, pageWidth - 14, 26);

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
    didParseCell: (data) => {
      if (data.section === 'body') {
        const typeIndex = headers.indexOf('Tipo');
        const valueIndex = headers.indexOf('Valor');
        
        // Regular rows
        if (typeIndex !== -1 && valueIndex !== -1 && data.column.index === valueIndex) {
          const typeValue = data.row.raw[typeIndex];
          if (typeValue === 'Receita') {
            data.cell.styles.textColor = [5, 150, 105]; // emerald-600
            data.cell.styles.fontStyle = 'bold';
          } else if (typeValue === 'Despesa') {
            data.cell.styles.textColor = [220, 38, 38]; // red-600
            data.cell.styles.fontStyle = 'bold';
          }
        }

        // Summary rows (FinanceTab)
        if (data.column.index === 5) {
          const labelCell = data.row.raw[4];
          if (labelCell === 'Total Receitas:') {
            data.cell.styles.textColor = [5, 150, 105];
            data.cell.styles.fontStyle = 'bold';
          } else if (labelCell === 'Total Despesas:') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (labelCell === 'Saldo Líquido:') {
            const value = data.row.raw[5];
            if (value && value.toString().includes('-')) {
              data.cell.styles.textColor = [220, 38, 38];
            } else if (value && value.toString().includes('R$')) {
              data.cell.styles.textColor = [5, 150, 105];
            }
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    }
  });

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};
