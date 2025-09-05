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

  // --- CAPA ---
  await createCoverPage(doc, title, logoPathCover, sede, periodo);

  // --- NOVA PÁGINA PARA CONTEÚDO ---
  doc.addPage();
  let yPosition = 20;

  // --- LOGO HEADER ---
  if (logoPathHeader) {
    try {
      const base64Header = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Canvas não suportado');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = logoPathHeader;
      });

      const logoWidth = 30;
      const logoHeight = 30;
      const logoX = doc.internal.pageSize.width - logoWidth - 20;
      doc.addImage(base64Header, 'PNG', logoX, yPosition, logoWidth, logoHeight);

    } catch (error) {
      console.warn('Erro ao carregar logo header:', error);
    }
  }

  // --- TÍTULO ---
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, yPosition + 15);
  yPosition += 35;

  // --- CONSOLIDADO ---
  if (consolidado && activePlans && alunosAtivos) {
    const totalRecebidoMensal = Object.values(consolidado.totalRecebidoPorForma).reduce((acc, val) => acc + val, 0);
    const valorTotalPlanos = activePlans.reduce((sum, plan) => sum + (plan.valor || 0), 0);
    const totaisPorMetodoPagamentoPlanos = activePlans.reduce((acc, plan) => {
      const metodo = plan.metodoPagamento || 'Não especificado';
      acc[metodo] = (acc[metodo] || 0) + (plan.valor || 0);
      return acc;
    }, {} as Record<string, number>);
    const totalGeral = totalRecebidoMensal + consolidado.totalEmAberto + valorTotalPlanos;

    yPosition = addConsolidadoSection(doc, yPosition, consolidado, activePlans, totaisPorMetodoPagamentoPlanos, totalGeral, alunosAtivos);
  }

  // --- PLANOS DE ASSINATURA ---
  if (activePlans && activePlans.length > 0) {
    yPosition = addActivePlansSection(doc, yPosition, activePlans);
  }

  // --- TABELA DADOS DETALHADOS ---
  const columns = Object.keys(data[0]);
  const rows = data.map(row => columns.map(col => formatCellForPDF(row[col], col)));
  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: yPosition,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [66, 66, 66], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 20, left: 20, right: 20 },
  });

  // --- BAIXAR PDF ---
  const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};

// --- FUNÇÕES AUXILIARES ---

const addConsolidadoSection = (
  doc: jsPDF,
  yPosition: number,
  consolidado: { totalRecebidoPorForma: Record<string, number>; totalEmAberto: number },
  activePlans: SubscriptionPlan[],
  totaisPorMetodoPagamentoPlanos: Record<string, number>,
  totalGeral: number,
  alunosAtivos: { adimplentes: number; inadimplentes: number }
): number => {
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Planos Mensais:', 20, yPosition);
  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const totalRecebidoMensal = Object.values(consolidado.totalRecebidoPorForma).reduce((acc, val) => acc + val, 0);
  doc.text(`Total Recebido: ${formatCurrencyForPDF(totalRecebidoMensal)}`, 25, yPosition);
  yPosition += 8;
  Object.entries(consolidado.totalRecebidoPorForma).forEach(([forma, valor]) => {
    doc.text(`${forma}: ${formatCurrencyForPDF(valor)}`, 25, yPosition);
    yPosition += 8;
  });
  yPosition += 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Planos Ativos:', 20, yPosition);
  yPosition += 10;

  doc.setFontSize(12);
  Object.entries(totaisPorMetodoPagamentoPlanos).forEach(([metodo, valor]) => {
    doc.text(`${metodo}: ${formatCurrencyForPDF(valor)}`, 25, yPosition);
    yPosition += 8;
  });
  yPosition += 10;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 128);
  doc.text(`Total Geral: ${formatCurrencyForPDF(totalGeral)}`, 20, yPosition);
  doc.setTextColor(0, 0, 0);
  yPosition += 15;

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

  return yPosition;
};

const addActivePlansSection = (doc: jsPDF, yPosition: number, activePlans: SubscriptionPlan[]): number => {
  if (yPosition > doc.internal.pageSize.height - 100) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Planos de Assinatura Ativos no Período', 20, yPosition);
  yPosition += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const totalPlanos = activePlans.length;
  const trimestrais = activePlans.filter(p => p.tipo_plano === 'trimestral').length;
  const semestrais = activePlans.filter(p => p.tipo_plano === 'semestral').length;

  doc.text(`Total de Planos: ${totalPlanos}`, 20, yPosition);
  yPosition += 8;
  doc.text(`Trimestrais: ${trimestrais} | Semestrais: ${semestrais}`, 20, yPosition);
  yPosition += 8;

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
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [138, 43, 226], textColor: 255, fontSize: 10, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 255] },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 20;

  return yPosition;
};

// --- FORMATAÇÃO CELULAS ---
const formatCurrencyForPDF = (value: any): string => {
  if (!value) return 'R$ 0,00';
  const numValue = typeof value === 'string'
    ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'))
    : parseFloat(String(value));
  if (isNaN(numValue)) return String(value);
  return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
};

const isMonetaryColumnPDF = (columnName: string): boolean => {
  const monetaryKeywords = ['valor','preco','preço','amount','total','subtotal','desconto','taxa','fee','custo','receita','faturamento','pagamento','payment'];
  return monetaryKeywords.some(k => columnName.toLowerCase().includes(k));
};

const formatCellForPDF = (value: any, columnName: string): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  if (isMonetaryColumnPDF(columnName)) return formatCurrencyForPDF(value);
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  const str = String(value);
  return str.length > 50 ? str.substring(0, 47) + '...' : str;
};

// --- CAPA ---
const createCoverPage = async (doc: jsPDF, title: string, logoPathCover?: string, sede?: string, periodo?: string): Promise<void> => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Fundo gradiente roxo simulado
  doc.setFillColor(138, 43, 226); doc.rect(0,0,pageWidth,pageHeight/3,'F');
  doc.setFillColor(100,25,180); doc.rect(0,pageHeight/3,pageWidth,pageHeight/3,'F');
  doc.setFillColor(80,15,150); doc.rect(0,(pageHeight/3)*2,pageWidth,pageHeight/3,'F');

  // Logo capa
  if (logoPathCover) {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Canvas não suportado');
          ctx.drawImage(img,0,0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = logoPathCover;
      });

      const logoWidth = 140;
      const logoHeight = 80;
      const logoX = (pageWidth - logoWidth)/2;
      const logoY = 30;
      const border = 5;
      doc.setFillColor(255,255,255);
      doc.rect(logoX-border, logoY-border, logoWidth+border*2, logoHeight+border*2,'F');
      doc.addImage(base64,'PNG',logoX,logoY,logoWidth,logoHeight);

    } catch (error) {
      console.warn('Erro ao carregar logo na capa:', error);
    }
  }

  // Títulos
  doc.setTextColor(255,255,255);
  doc.setFontSize(18); doc.setFont('helvetica','bold'); doc.text('CT Taiana Lima', pageWidth/2,155,{align:'center'});
  doc.setFontSize(20); doc.setFont('helvetica','bold');
  const tituloRelatorio = `Prestação de Contas - ${sede || 'Sede não especificada'} - ${periodo || 'Período não especificado'}`;
  doc.text(tituloRelatorio,pageWidth/2,pageHeight/2+30,{align:'center'});

  // Data
  doc.setFontSize(10); doc.setFont('helvetica','normal');
  const currentDate = new Date().toLocaleDateString('pt-BR',{year:'numeric',month:'long',day:'numeric'});
  doc.text(`Gerado em ${currentDate}`, pageWidth/2, pageHeight-40,{align:'center'});

  // Linha decorativa
  doc.setDrawColor(255,255,255); doc.setLineWidth(2);
  doc.line(50,pageHeight-50,pageWidth-50,pageHeight-50);
};
