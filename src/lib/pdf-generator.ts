import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SubscriptionPlan } from './subscription-plans';

export const generatePDF = async (
  data: Record<string, any>[], 
  title: string = 'Relatório CSV',
  logoPath?: string,
  consolidado?: {
    totalRecebidoPorForma: Record<string, number>;
    totalEmAberto: number;
  },
  orientation: 'portrait' | 'landscape' = 'landscape',
  activePlans?: SubscriptionPlan[]
) => {
  if (!data.length) return;

  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4'
  });
  let yPosition = 20;

  // Adicionar logo se fornecida
  if (logoPath) {
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        logoImg.src = logoPath;
      });

      // Adicionar logo no canto superior direito
      const logoWidth = 30;
      const logoHeight = 30;
      const logoX = doc.internal.pageSize.width - logoWidth - 20;
      
      doc.addImage(logoImg, 'PNG', logoX, yPosition, logoWidth, logoHeight);
    } catch (error) {
      console.warn('Erro ao carregar logo:', error);
    }
  }

  // Título
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, yPosition + 15);
  yPosition += 35;

  // Adicionar consolidado se fornecido
  if (consolidado) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CONSOLIDADO FINANCEIRO', 20, yPosition);
    yPosition += 15;

    // Total Recebido por Forma de Pagamento
    if (Object.keys(consolidado.totalRecebidoPorForma).length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Valores Recebidos por Forma de Pagamento:', 20, yPosition);
      yPosition += 10;

      doc.setFont('helvetica', 'normal');
      Object.entries(consolidado.totalRecebidoPorForma)
        .sort(([,a], [,b]) => b - a)
        .forEach(([forma, valor]) => {
          doc.text(`${forma}: ${formatCurrencyForPDF(valor)}`, 25, yPosition);
          yPosition += 8;
        });
      
      // Total Recebido
      const totalRecebido = Object.values(consolidado.totalRecebidoPorForma).reduce((acc, val) => acc + val, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Recebido: ${formatCurrencyForPDF(totalRecebido)}`, 25, yPosition);
      yPosition += 15;
    }

    // Total em Aberto
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total em Aberto: ${formatCurrencyForPDF(consolidado.totalEmAberto)}`, 20, yPosition);
    yPosition += 10;

    //Total Planos Trimestrais/Semestrais
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total em Planos Trimestrais/Semestrais: ${formatCurrencyForPDF(activePlans.reduce((sum, plan) => sum + (plan.valor || 0), 0))}`, 20, yPosition);
    yPosition += 10;

    // Total Geral
    const totalGeral = Object.values(consolidado.totalRecebidoPorForma).reduce((acc, val) => acc + val, 0) + consolidado.totalEmAberto;
    doc.text(`Total Geral: ${formatCurrencyForPDF(totalGeral)}`, 20, yPosition);
    yPosition += 20;

    // Linha separadora
    doc.line(20, yPosition, doc.internal.pageSize.width - 20, yPosition);
    yPosition += 15;

    doc.setFontSize(14);
    doc.text('DADOS DETALHADOS', 20, yPosition);
    yPosition += 15;
  }

  // Adicionar planos de assinatura se fornecidos
  if (activePlans && activePlans.length > 0) {
    // Verificar se precisa de nova página
    if (yPosition > doc.internal.pageSize.height - 100) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PLANOS DE ASSINATURA ATIVOS NO PERÍODO', 20, yPosition);
    yPosition += 15;

    // Resumo dos planos
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const totalPlanos = activePlans.length;
    const trimestrais = activePlans.filter(p => p.tipo_plano === 'trimestral').length;
    const semestrais = activePlans.filter(p => p.tipo_plano === 'semestral').length;
    const valorTotal = activePlans.reduce((sum, plan) => sum + (plan.valor || 0), 0);

    doc.text(`Total de Planos: ${totalPlanos}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Trimestrais: ${trimestrais} | Semestrais: ${semestrais}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Valor Total: ${formatCurrencyForPDF(valorTotal)}`, 20, yPosition);
    yPosition += 15;

    // Tabela de planos
    const plansTableData = activePlans.map(plan => [
      plan.tipo_plano.charAt(0).toUpperCase() + plan.tipo_plano.slice(1),
      plan.nome_cliente || 'Não informado',
      plan.data_vencimento.toLocaleDateString('pt-BR'),
      `${plan.data_inicio} a ${plan.data_fim}`,
      formatCurrencyForPDF(plan.valor)
    ]);

    autoTable(doc, {
      head: [['Tipo', 'Cliente', 'Vencimento', 'Período', 'Valor']],
      body: plansTableData,
      startY: yPosition,
      margin: { left: 20, right: 20 },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [138, 43, 226], // Purple
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 248, 255], // Light purple
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 20;

    // Linha separadora
    doc.line(20, yPosition, doc.internal.pageSize.width - 20, yPosition);
    yPosition += 15;

    doc.setFontSize(14);
    doc.text('DADOS DETALHADOS', 20, yPosition);
    yPosition += 15;
  }

  // Preparar dados da tabela
  const columns = Object.keys(data[0]);
  const rows = data.map(row => columns.map(col => formatCellForPDF(row[col], col)));

  // Adicionar tabela
  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: yPosition,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 20, left: 20, right: 20 },
  });

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} - Página ${i} de ${pageCount}`,
      20,
      doc.internal.pageSize.height - 10
    );
  }

  // Baixar o PDF
  const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};

export interface PDFOptions {
  title?: string;
  author?: string;
  subject?: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'a3' | 'letter';
  margin?: number;
  fontSize?: number;
  includeHeader?: boolean;
  includeFooter?: boolean;
  maxRowsPerPage?: number;
}

export interface ReportSection {
  title: string;
  data: Record<string, any>[];
  columns?: string[];
  summary?: {
    totalRows: number;
    columnStats?: Record<string, {
      type: string;
      unique: number;
      empty: number;
    }>;
  };
}

export const generatePDFReport = (
  sections: ReportSection[],
  options: PDFOptions = {}
): jsPDF => {
  const defaultOptions: Required<PDFOptions> = {
    title: 'Relatório de Dados',
    author: 'Sistema de Relatórios',
    subject: 'Relatório gerado automaticamente',
    orientation: 'landscape',
    format: 'a4',
    margin: 20,
    fontSize: 10,
    includeHeader: true,
    includeFooter: true,
    maxRowsPerPage: 50,
    ...options,
  };

  const doc = new jsPDF({
    orientation: defaultOptions.orientation,
    unit: 'mm',
    format: defaultOptions.format,
  });

  // Set document metadata
  doc.setProperties({
    title: defaultOptions.title,
    author: defaultOptions.author,
    subject: defaultOptions.subject,
    creator: 'Sistema de Relatórios CSV',
  });

  let currentY = defaultOptions.margin;

  // Add document header
  if (defaultOptions.includeHeader) {
    currentY = addDocumentHeader(doc, defaultOptions, currentY);
  }

  // Process each section
  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      doc.addPage();
      currentY = defaultOptions.margin;
      if (defaultOptions.includeHeader) {
        currentY = addDocumentHeader(doc, defaultOptions, currentY);
      }
    }

    currentY = addSection(doc, section, defaultOptions, currentY);
  });

  // Add footer to all pages
  if (defaultOptions.includeFooter) {
    addDocumentFooter(doc, defaultOptions);
  }

  return doc;
};

const addDocumentHeader = (
  doc: jsPDF,
  options: Required<PDFOptions>,
  startY: number
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(options.title, pageWidth / 2, startY, { align: 'center' });
  
  // Date
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Gerado em: ${currentDate}`, pageWidth / 2, startY + 8, { align: 'center' });
  
  // Separator line
  doc.setLineWidth(0.5);
  doc.line(options.margin, startY + 12, pageWidth - options.margin, startY + 12);
  
  return startY + 20;
};

const addSection = (
  doc: jsPDF,
  section: ReportSection,
  options: Required<PDFOptions>,
  startY: number
): number => {
  let currentY = startY;
  
  // Section title
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(section.title, options.margin, currentY);
  currentY += 10;

  // Summary information
  if (section.summary) {
    doc.setFontSize(options.fontSize);
    doc.setFont(undefined, 'normal');
    doc.text(`Total de registros: ${section.summary.totalRows}`, options.margin, currentY);
    currentY += 6;

    if (section.summary.columnStats) {
      const statsText = Object.entries(section.summary.columnStats)
        .map(([col, stats]) => `${col}: ${stats.type} (${stats.unique} únicos, ${stats.empty} vazios)`)
        .join(' | ');
      
      const splitText = doc.splitTextToSize(statsText, doc.internal.pageSize.getWidth() - (options.margin * 2));
      doc.text(splitText, options.margin, currentY);
      currentY += splitText.length * 4 + 5;
    }
  }

  // Prepare table data
  if (section.data.length > 0) {
    const columns = section.columns || Object.keys(section.data[0]);
    const tableData = section.data.slice(0, options.maxRowsPerPage).map(row =>
      columns.map(col => formatCellForPDF(row[col], col))
    );

    // Generate table
    autoTable(doc, {
      head: [columns],
      body: tableData,
      startY: currentY,
      margin: { left: options.margin, right: options.margin },
      styles: {
        fontSize: options.fontSize - 1,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185], // Blue
        textColor: 255,
        fontSize: options.fontSize,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245], // Light gray
      },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.1,
      columnStyles: columns.reduce((acc, _, index) => {
        acc[index] = { cellWidth: 'auto' };
        return acc;
      }, {} as Record<number, any>),
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Add note if data was truncated
    if (section.data.length > options.maxRowsPerPage) {
      doc.setFontSize(8);
      doc.setFont(undefined, 'italic');
      doc.text(
        `Nota: Mostrando apenas os primeiros ${options.maxRowsPerPage} registros de ${section.data.length} total.`,
        options.margin,
        currentY
      );
      currentY += 8;
    }
  }

  return currentY;
};

const addDocumentFooter = (doc: jsPDF, options: Required<PDFOptions>): void => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    
    // Page number
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - options.margin,
      pageHeight - 10,
      { align: 'right' }
    );
    
    // System info
    doc.text(
      'Gerado pelo Sistema de Relatórios CSV',
      options.margin,
      pageHeight - 10
    );
  }
};

// Função para formatar valores monetários no PDF
const formatCurrencyForPDF = (value: any): string => {
  if (!value) return 'R$ 0,00';
  
  const numValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.')) 
    : parseFloat(String(value));
    
  if (isNaN(numValue)) return String(value);
  
  return numValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  });
};

// Função para detectar se uma coluna contém valores monetários
const isMonetaryColumnPDF = (columnName: string): boolean => {
  const monetaryKeywords = [
    'valor', 'price', 'preco', 'preço', 'amount', 'total', 'subtotal',
    'desconto', 'discount', 'taxa', 'fee', 'custo', 'cost', 'receita',
    'revenue', 'faturamento', 'billing', 'pagamento', 'payment'
  ];
  
  return monetaryKeywords.some(keyword => 
    columnName.toLowerCase().includes(keyword)
  );
};

const formatCellForPDF = (value: any, columnName: string): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  
  // Formatar valores monetários
  if (isMonetaryColumnPDF(columnName)) {
    return formatCurrencyForPDF(value);
  }
  
  // Formatar números não monetários
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  
  const str = String(value);
  return str.length > 50 ? str.substring(0, 47) + '...' : str;
};

export const downloadPDF = (doc: jsPDF, filename: string = 'relatorio.pdf'): void => {
  doc.save(filename);
};

export const previewPDF = (doc: jsPDF): string => {
  return doc.output('datauristring');
};