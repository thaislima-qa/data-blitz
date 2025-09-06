import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SubscriptionPlan } from './subscription-plans';

export const generatePDF = async (
  data: Record<string, any>[], 
  title: string = 'Relatório CSV',
  logoPathCover?: string,   // logo da capa
  logoPathHeader?: string,  // logo das demais páginas
  consolidado?: {
    totalRecebidoPorForma: Record<string, number>;
    totalEmAberto: number;
  },
  orientation: 'portrait' | 'landscape' = 'landscape',
  activePlans?: SubscriptionPlan[],
  alunosAtivos?: {
    total: number;
    adimplentes: number;
    inadimplentes: number;
  },
  sede?: string,
  periodo?: string
) => {
  if (!data.length) return;

  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4'
  });
  
  // Criar capa com logo
  await createCoverPage(doc, title, logoPathCover, sede, periodo);
  
  // Nova página para o conteúdo
  doc.addPage();
  doc.setTextColor(0, 0, 0); // volta para preto
  let yPosition = 20;

  // Adicionar logo se fornecida
  if (logoPathHeader) {
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        logoImg.src = logoPathHeader;
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

  // Nova estrutura do consolidado conforme solicitado
  if (consolidado && activePlans && alunosAtivos) {
    // Calcular totais necessários
    const totalRecebidoMensal = Object.values(consolidado.totalRecebidoPorForma).reduce((acc, val) => acc + val, 0);
    const valorTotalPlanos = activePlans.reduce((sum, plan) => sum + (plan.valor || 0), 0);
    
    // Totais por método de pagamento dos planos
    const totaisPorMetodoPagamentoPlanos = activePlans.reduce((acc, plan) => {
      const metodo = plan.metodoPagamento || 'Não especificado';
      acc[metodo] = (acc[metodo] || 0) + (plan.valor || 0);
      return acc;
    }, {} as Record<string, number>);
    
    const totalGeral = totalRecebidoMensal + consolidado.totalEmAberto + valorTotalPlanos;

    // PLANOS MENSAIS
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Planos Mensais:', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(12);
    doc.text(`Total Recebido: ${formatCurrencyForPDF(totalRecebidoMensal)}`, 25, yPosition);
    yPosition += 8;
    
    Object.entries(consolidado.totalRecebidoPorForma)
      .sort(([,a], [,b]) => b - a)
      .forEach(([forma, valor]) => {
        doc.text(`${forma}: ${formatCurrencyForPDF(valor)}`, 25, yPosition);
        yPosition += 8;
      });
    yPosition += 10;

    // PLANOS ATIVOS
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Planos Ativos:', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(12);
    doc.text(`Total Recebido: ${formatCurrencyForPDF(valorTotalPlanos)}`, 25, yPosition);
    yPosition += 8;
    
    Object.entries(totaisPorMetodoPagamentoPlanos)
      .sort(([,a], [,b]) => b - a)
      .forEach(([metodo, valor]) => {
        doc.text(`${metodo}: ${formatCurrencyForPDF(valor)}`, 25, yPosition);
        yPosition += 8;
      });
    yPosition += 10;

    // VALOR EM ABERTO
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Valor em Aberto: ${formatCurrencyForPDF(consolidado.totalEmAberto)}`, 20, yPosition);
    yPosition += 15;

    // TOTAL GERAL - destacado
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 128); // Azul escuro
    doc.text(`Total Geral: ${formatCurrencyForPDF(totalGeral)}`, 20, yPosition);
    doc.setTextColor(0, 0, 0); // Volta para preto
    yPosition += 10;
    
    // Linha separadora
    const pageWidth = doc.internal.pageSize.width;
    doc.setLineWidth(2);
    doc.setDrawColor(0, 0, 128);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 15;

    // TOTAL DE ALUNOS ATIVOS
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL DE ALUNOS ATIVOS:', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Adimplentes: ${alunosAtivos.adimplentes}`, 25, yPosition);
    yPosition += 8;
    doc.text(`Inadimplentes: ${alunosAtivos.inadimplentes}`, 25, yPosition);
    yPosition += 15;

    // >>> Forçar nova página para iniciar DADOS DETALHADOS
    doc.addPage();
    yPosition = 20;

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
    doc.text('Planos de Assinatura Ativos no Período', 20, yPosition);
    yPosition += 15;

    // Resumo dos planos
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const totalPlanos = activePlans.length;
    const trimestrais = activePlans.filter(p => p.tipo_plano === 'trimestral').length;
    const semestrais = activePlans.filter(p => p.tipo_plano === 'semestral').length;

    doc.text(`Total de Planos: ${totalPlanos}`, 20, yPosition);
    yPosition += 8;
    doc.text(`Trimestrais: ${trimestrais} | Semestrais: ${semestrais}`, 20, yPosition);
    yPosition += 8;

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
    
    // >>> Forçar nova página para iniciar DADOS DETALHADOS
    doc.addPage();
    yPosition = 20;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Planos Mensais Ativos no Período', 20, yPosition);
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

// Função para criar a capa do PDF
const createCoverPage = async (doc: jsPDF, title: string, logoPathCover?: string, sede?: string, periodo?: string): Promise<void> => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // Fundo gradiente roxo simulado
  doc.setFillColor(138, 43, 226); // Purple
  doc.rect(0, 0, pageWidth, pageHeight / 3, 'F');
  
  doc.setFillColor(100, 25, 180); // Darker purple
  doc.rect(0, pageHeight / 3, pageWidth, pageHeight / 3, 'F');
  
  doc.setFillColor(80, 15, 150); // Even darker purple
  doc.rect(0, (pageHeight / 3) * 2, pageWidth, pageHeight / 3, 'F');

  if (logoPathCover) {
    try {
      console.log('Tentando carregar logo da capa:', logoPathCover);
      
      // Converte a imagem para Base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          console.log('Logo carregada com sucesso');
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('Canvas não suportado');
            return reject('Canvas não suportado');
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        
        img.onerror = (error) => {
          console.error('Erro ao carregar imagem:', error, 'Path:', logoPathCover);
          reject(error);
        };
        
        img.src = logoPathCover;
      });

      console.log('Base64 da logo obtido, adicionando ao PDF');
      
      // Defina tamanho da logo
      const logoWidth = 140;
      const logoHeight = 80;
      const logoX = (pageWidth - logoWidth) / 2;
      const logoY = 30;

      // Fundo branco para a logo
      const border = 5;
      doc.setFillColor(255, 255, 255);
      doc.rect(logoX - border, logoY - border, logoWidth + border*2, logoHeight + border*2, 'F');

      // Adiciona logo usando Base64
      doc.addImage(base64, 'PNG', logoX, logoY, logoWidth, logoHeight);
      console.log('Logo adicionada ao PDF com sucesso');

    } catch (error) {
      console.error('Erro ao carregar logo na capa:', error);
    }
  } else {
    console.log('Nenhuma logo fornecida para a capa');
  }


  // Título principal
  doc.setTextColor(255, 255, 255); // <- garante branco
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('CT Taiana Lima', pageWidth / 2, 155, { align: 'center' });

  // Título do relatório - "Prestação de Contas - [Sede] - MM/AAAA"
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const tituloRelatorio = `Prestação de Contas - ${sede || 'Sede não especificada'} - ${periodo || 'Período não especificado'}`;
  doc.text(tituloRelatorio, pageWidth / 2, pageHeight / 2 + 30, { align: 'center' });

  // Data de geração
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(`Gerado em ${currentDate}`, pageWidth / 2, pageHeight - 40, { align: 'center' });

  // Linha decorativa
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(2);
  doc.line(50, pageHeight - 50, pageWidth - 50, pageHeight - 50);
};