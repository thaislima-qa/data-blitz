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
    totalInadimplentes: number;
  },
  orientation: 'portrait' | 'landscape' = 'landscape',
  activePlans?: SubscriptionPlan[],
  alunosAtivos?: {
    total: number;
    adimplentes: number;
    inadimplentes: number;
  },
  sede?: string,
  periodo?: string,
  inadimplentesList?: Record<string, any>[]
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

    const totalPlanos = activePlans.length;
    
    const totalGeral = totalRecebidoMensal + consolidado.totalEmAberto + valorTotalPlanos + (consolidado.totalInadimplentes || 0);

    const totalDistribuicao = totalGeral - consolidado.totalEmAberto

    
    // PLANOS MENSAIS
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Planos Mensais:', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(12);
    doc.setTextColor(0, 100, 0); // verde escuro
    doc.text(`Total Recebido: ${formatCurrencyForPDF(totalRecebidoMensal)}`, 25, yPosition);
    yPosition += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    Object.entries(consolidado.totalRecebidoPorForma)
      .filter(([forma, valor]) => forma.trim() !== '' && valor > 0) // Filtrar vazios e zeros
      .sort(([,a], [,b]) => b - a)
      .forEach(([forma, valor]) => {
        doc.text(`${forma}: ${formatCurrencyForPDF(valor)}`, 30, yPosition); 
        yPosition += 8;
      });
    yPosition += 8;

    // PLANOS ATIVOS
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Planos Ativos:', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(12);
    doc.setTextColor(0, 100, 0); // verde escuro
    doc.text(`Total Recebido: ${formatCurrencyForPDF(valorTotalPlanos)}`, 25, yPosition);
    yPosition += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    Object.entries(totaisPorMetodoPagamentoPlanos)
      .filter(([metodo, valor]) => metodo.trim() !== '' && valor > 0) // Filtrar vazios e zeros
      .sort(([,a], [,b]) => b - a)
      .forEach(([metodo, valor]) => {
        doc.text(`${metodo}: ${formatCurrencyForPDF(valor)}`, 30, yPosition);
        yPosition += 8;
      });
    yPosition += 8;

    // INADIMPLENTES RECEBIMENTOS
    if (consolidado.totalInadimplentes > 0) {
      doc.setFontSize(14);
      doc.setTextColor(255, 0, 0); // vermelho
      doc.setFont('helvetica', 'bold');
      doc.text(`Inadimplentes Recebimentos: ${formatCurrencyForPDF(consolidado.totalInadimplentes)}`, 20, yPosition);
      yPosition += 10;
    }

    // VALOR EM ABERTO
    doc.setFontSize(14);
    doc.setTextColor(255, 0, 0); // vermelho em RGB
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
    
    // TOTAL DISTRIBUÇÃO - destacado
    doc.setFontSize(14);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(0, 0, 0); // Volta para preto
    doc.text(`Total Distribuição: ${formatCurrencyForPDF(totalDistribuicao)}*`, 20, yPosition);
    yPosition += 5;
    doc.setFontSize(8);
    doc.text(`*Valor antes da dedução dos impostos`, 20, yPosition);
    yPosition += 15;

       
    // Linha separadora
    const pageWidth = doc.internal.pageSize.width;
    doc.setLineWidth(2);
    doc.setDrawColor(0, 0, 128);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
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
    doc.text(`Trimestral: ${trimestrais} | Semestral: ${semestrais}`, 20, yPosition);
    yPosition += 8;

    // Tabela de planos
    const plansTableData = activePlans.map(plan => [
      plan.tipo_plano.charAt(0).toUpperCase() + plan.tipo_plano.slice(1),
      plan.nome_cliente || 'Não informado',
      plan.data_vencimento.toLocaleDateString('pt-BR'),
      `${plan.data_inicio} a ${plan.data_fim}`,
      formatCurrencyForPDF(plan.valor),
      plan.metodoPagamento || 'Não especificado'
    ]);

    autoTable(doc, {
      head: [['Tipo', 'Cliente', 'Vencimento', 'Período', 'Valor', 'Método de pagamento']],
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

    // Forçar nova página para Total de Alunos Ativos (isolado após planos)
    doc.addPage();
    yPosition = 20;

    // TOTAL DE ALUNOS ATIVOS
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de Alunos Ativos: ${alunosAtivos.total}`, 20, yPosition);
    yPosition += 10;


    const adimplentesTotal = alunosAtivos.adimplentes + totalPlanos;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Adimplentes: ${adimplentesTotal}`, 25, yPosition);
    yPosition += 8;
    doc.text(`Inadimplentes: ${alunosAtivos.inadimplentes}`, 25, yPosition);
    yPosition += 15;
    
    // >>> Forçar nova página para iniciar DADOS DETALHADOS
    doc.addPage();
    yPosition = 20;

    // Adicionar Tabela de Inadimplentes se existir
    if (inadimplentesList && inadimplentesList.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Inadimplentes Recebidos', 20, yPosition);
      yPosition += 15;

      // Tabela de inadimplentes
      const inadimplentesCols = Object.keys(inadimplentesList[0]).filter(col => col.toLowerCase() !== 'consultor');
      const inadimplentesRows = inadimplentesList.map(row => 
        inadimplentesCols.map(col => formatCellForPDF(row[col], col))
      );

      autoTable(doc, {
        head: [inadimplentesCols],
        body: inadimplentesRows,
        startY: yPosition,
        margin: { left: 20, right: 20 },
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [220, 53, 69], // Red
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [255, 242, 242], // Light red
        },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;

    }
    
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

  // Adicionar marca d'água em todas as páginas (exceto capa)
  if (logoPathHeader) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 2; i <= pageCount; i++) { // Começa da página 2 (pula a capa)
      doc.setPage(i);
      await addWatermark(doc, logoPathHeader);
    }
  }

  // Baixar o PDF
  const fileName = `${('Report')} - ${sede || 'Sede não especificada'} - ${periodo || 'Período não especificado'}.pdf`;
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

export const generatePDFReport = async (
  sections: ReportSection[],
  options: PDFOptions = {}
): Promise<jsPDF> => {
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
    await addDocumentFooter(doc, defaultOptions);
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

const addWatermark = async (doc: jsPDF, logoPath?: string): Promise<void> => {
  if (!logoPath) return;

  try {
    const response = await fetch(logoPath);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Tamanho da marca d'água (menor para não atrapalhar a leitura)
    const watermarkSize = Math.min(pageWidth, pageHeight) * 0.5; // 50% do tamanho da página
    const x = (pageWidth - watermarkSize) / 2;
    const y = (pageHeight - watermarkSize) / 2;
    
    // Adiciona a marca d'água com opacity baixa
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        if (ctx) {
          ctx.globalAlpha = 0.15; // 15% de opacidade
          ctx.drawImage(img, 0, 0);
        }
        resolve();
      };
      img.onerror = reject;
      img.src = base64;
    });
    
    const watermarkBase64 = canvas.toDataURL();
    doc.addImage(watermarkBase64, 'PNG', x, y, watermarkSize, watermarkSize);
  } catch (error) {
    console.warn('Erro ao adicionar marca d\'água:', error);
  }
};

const addDocumentFooter = async (doc: jsPDF, options: Required<PDFOptions>, logoPath?: string): Promise<void> => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Adiciona marca d'água em todas as páginas exceto a primeira (capa)
    if (i > 1 && logoPath) {
      await addWatermark(doc, logoPath);
    }
    
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
  // Valores vazios não devem exibir R$ 0,00 no PDF
  if (value === null || value === undefined || value === '') return '';
  
  const numValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.')) 
    : parseFloat(String(value));
    
  // Se não for numérico válido, retorna vazio
  if (isNaN(numValue)) return '';
  
  return numValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  });
};

// Função para detectar se uma coluna contém valores monetários
const isMonetaryColumnPDF = (columnName: string): boolean => {
  const name = columnName.toLowerCase();

  // IMPORTANT: não tratar colunas de "método/forma de pagamento" como monetárias
  // (ex.: "Método de pagamento"), senão o valor vira vazio no PDF.
  if (
    name.includes('método') ||
    name.includes('metodo') ||
    name.includes('forma') ||
    name.includes('payment method') ||
    (name.includes('pagamento') && name.includes('método'))
  ) {
    return false;
  }

  const monetaryKeywords = [
    'valor', 'price', 'preco', 'preço', 'amount', 'total', 'subtotal',
    'desconto', 'discount', 'taxa', 'fee', 'custo', 'cost', 'receita',
    'revenue', 'faturamento', 'billing'
  ];

  return monetaryKeywords.some(keyword => name.includes(keyword));
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
      //console.log('Tentando carregar logo da capa:', logoPathCover);
      
      // Converte a imagem para Base64
      const base64 = "data:image/png;base64,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";
      /*
      await new Promise<string>((resolve, reject) => {
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
      });*/

      //console.log('Base64 da logo obtido, adicionando ao PDF');
      
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