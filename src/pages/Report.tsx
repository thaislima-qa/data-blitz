import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, FileText, Settings } from "lucide-react";
import { FilterState } from "@/components/ui/data-filters";
import { applyFilters } from "@/lib/data-filters";
import { generatePDF } from "@/lib/pdf-generator";
import { toast } from "sonner";
import logoPathCover from "@/assets/CT Taiana Lima.png";
import logoPathHeader from "@/assets/mini-logo.png";
import { getActivePlansInPeriod, SubscriptionPlan, identifySubscriptionPlans, saveSubscriptionPlans } from "@/lib/subscription-plans";

// Função para formatar valores monetários
const formatCurrency = (value: any): string => {
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
const isMonetaryColumn = (columnName: string): boolean => {
  const monetaryKeywords = [
    'valor', 'price', 'preco', 'preço', 'amount', 'total', 'subtotal',
    'desconto', 'discount', 'taxa', 'fee', 'custo', 'cost', 'receita',
    'revenue', 'faturamento', 'billing', 'pagamento', 'payment'
  ];
  
  return monetaryKeywords.some(keyword => 
    columnName.toLowerCase().includes(keyword)
  );
};

// Função para formatar valor de célula
const formatCellValue = (value: any, columnName: string): string => {
  if (isMonetaryColumn(columnName)) {
    return formatCurrency(value);
  }
  return String(value || '');
};

interface ReportData {
  filteredData: Record<string, any>[];
  originalData: Record<string, any>[];
  filters: FilterState;
}

export default function Report() {
  const location = useLocation();
  const navigate = useNavigate();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [consolidado, setConsolidado] = useState<{
    totalRecebidoPorForma: Record<string, number>;
    totalEmAberto: number;
    totalInadimplentes: number;
  } | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [showPdfSettings, setShowPdfSettings] = useState(false);
  const [activePlans, setActivePlans] = useState<SubscriptionPlan[]>([]);
  const [dataWithoutPlans, setDataWithoutPlans] = useState<Record<string, any>[]>([]);
  const [inadimplentesList, setInadimplentesList] = useState<Record<string, any>[]>([]);

  useEffect(() => {
    const data = location.state as ReportData;
    if (!data) {
      navigate('/');
      return;
    }
  
    setReportData(data);
    
    // Processar planos de assinatura e remover dos dados filtrados
    processSubscriptionPlans(data.filteredData, data.filters);
  }, [location.state, navigate]);

  const processSubscriptionPlans = async (filteredData: Record<string, any>[], filters: FilterState) => {
    try {
      // Identificar planos de assinatura no CSV atual
      const identifiedPlans = identifySubscriptionPlans(filteredData);
      
      // Salvar os planos identificados no Supabase (apenas os que não existem)
      if (identifiedPlans.length > 0) {
        const result = await saveSubscriptionPlans(identifiedPlans);
        
        if (result.saved > 0) {
          toast.success(`${result.saved} plano(s) de assinatura salvo(s) com sucesso!`);
        }
        
        if (result.skipped > 0) {
          toast.info(`${result.skipped} plano(s) já existia(m) no sistema e foi(ram) ignorado(s)`);
        }
        
        if (result.saved === 0 && result.skipped === 0 && identifiedPlans.length > 0) {
          toast.info('Nenhum plano de assinatura novo foi identificado para salvar');
        }
      }
      
      // Buscar TODOS os planos ativos existentes no Supabase baseado no mês referência ou filtro de data de vencimento
      let existingActivePlans: SubscriptionPlan[] = [];
     
      if (filters.mesReferencia) {
        // Se há mês referência, usar esse mês para buscar planos ativos
        const [mes, ano] = filters.mesReferencia.split('/');
        if (mes && ano) {
          const startDate = new Date(parseInt(ano), parseInt(mes) - 1, 1);
          const endDate = new Date(parseInt(ano), parseInt(mes), 0); // Último dia do mês
          existingActivePlans = await getActivePlansInPeriod(
            startDate,
            endDate,
            filters.sede,
            filters.metodoPagamento
          );
        }
      } else if (filters.dataVencimento?.from && filters.dataVencimento?.to) {
        existingActivePlans = await getActivePlansInPeriod(
          filters.dataVencimento.from,
          filters.dataVencimento.to,
          filters.sede,
          filters.metodoPagamento
        );
      }
      
      // Combinar planos identificados no CSV atual com os existentes no Supabase
      // Remover duplicatas baseadas em nome_cliente + tipo_plano + data_vencimento
      const allPlans = [...identifiedPlans];
      const planKeys = new Set<string>();
      
      identifiedPlans.forEach(plan => {
        const key = `${plan.nome_cliente || 'sem_nome'}_${plan.tipo_plano}_${plan.data_vencimento.toISOString().split('T')[0]}`;
        planKeys.add(key);
      });
      
      existingActivePlans.forEach(plan => {
        const key = `${plan.nome_cliente || 'sem_nome'}_${plan.tipo_plano}_${plan.data_vencimento.toISOString().split('T')[0]}`;
        if (!planKeys.has(key)) {
          allPlans.push(plan);
        }
        return allPlans
      });
      
      setActivePlans(allPlans);

      // Separar inadimplentes e filtrar dados removendo planos de assinatura e inadimplentes
      const inadimplentesList: Record<string, any>[] = [];
      const dataWithoutPlans = filteredData.filter(row => {
        // Verifica se este registro é um plano de assinatura
        const rowText = Object.entries(row)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' ')
          .toLowerCase();
          
        const isSubscriptionPlan = rowText.includes('trimestral') || rowText.includes('semestral');
        
        // Verifica se é inadimplente baseado no mês de referência
        let isInadimplente = false;
        if (filters.mesReferencia) {
          const [mes, ano] = filters.mesReferencia.split('/');
          if (mes && ano) {
            // Data limite: primeiro dia do mês de referência
            const mesReferenciaDate = new Date(parseInt(ano), parseInt(mes) - 1, 1);
            
            // Procurar coluna de data de vencimento
            const columns = Object.keys(row);
            const dataVencimentoColumn = columns.find(col => 
              col.toLowerCase().includes('vencimento') || 
              col.toLowerCase().includes('due') ||
              col.toLowerCase().includes('data') && col.toLowerCase().includes('venc')
            );
            
            if (dataVencimentoColumn) {
              const dataVencimentoStr = String(row[dataVencimentoColumn] || '');
              const dataVencimento = parseDate(dataVencimentoStr);
              
              // Inadimplente: data de vencimento anterior ao mês de referência
              if (dataVencimento && dataVencimento < mesReferenciaDate) {
                isInadimplente = true;
                // Adicionar à lista de inadimplentes
                inadimplentesList.push(row);
              }
            }
          }
        }
        
        return !isSubscriptionPlan && !isInadimplente;
      });
      
      setDataWithoutPlans(dataWithoutPlans);
      setInadimplentesList(inadimplentesList);
      
      // Inicializar colunas selecionadas com base nos dados sem planos
      if (dataWithoutPlans.length > 0) {
        const columns = Object.keys(dataWithoutPlans[0]);
        setSelectedColumns(columns);
      }
      
      // Calcular consolidado apenas com dados que não são planos
      calculateConsolidado(filteredData, filters);
      
    } catch (error) {
      console.error('Erro ao processar planos de assinatura:', error);
      toast.error('Erro ao processar planos de assinatura');
      
      // Em caso de erro, usar os dados originais
     // setDataWithoutPlans(filteredData);
      //calculateConsolidado(filteredData, filters);
    }
  };



  const calculateConsolidado = (data: Record<string, any>[], filters: FilterState) => {
    if (!data.length) return;

    const columns = Object.keys(data[0]);
    
    // Detectar colunas
    const valorColumn = columns.find(col => 
      col.toLowerCase().includes('valor') || 
      col.toLowerCase().includes('amount') ||
      col.toLowerCase().includes('total') ||
      col.toLowerCase().includes('preco') ||
      col.toLowerCase().includes('preço')
    );
    
    const recebimentoColumn = columns.find(col => 
      col.toLowerCase().includes('recebimento') || 
      col.toLowerCase().includes('receb') ||
      col.toLowerCase().includes('received') ||
      col.toLowerCase().includes('pagamento') && !col.toLowerCase().includes('método')
    );
    
    const metodoPagamentoColumn = columns.find(col => 
      col.toLowerCase().includes('método') || 
      col.toLowerCase().includes('metodo') ||
      col.toLowerCase().includes('forma') ||
      col.toLowerCase().includes('payment') ||
      col.toLowerCase().includes('type')
    );

    const dataVencimentoColumn = columns.find(col => 
      col.toLowerCase().includes('vencimento') || 
      col.toLowerCase().includes('due') ||
      col.toLowerCase().includes('data') && col.toLowerCase().includes('venc')
    );

    const totalRecebidoPorForma: Record<string, number> = {};
    let totalEmAberto = 0;
    let totalInadimplentes = 0;
debugger
    // Obter mês de referência para comparação
    let mesReferenciaDate: Date | null = null;
    if (filters.mesReferencia) {
      const [mes, ano] = filters.mesReferencia.split('/');
      if (mes && ano) {
        mesReferenciaDate = new Date(parseInt(ano), parseInt(mes) - 1, 1);
      }
    }
debugger
    data.forEach(row => {
      // Melhor parsing de valores monetários
      const valorStr = String(row[valorColumn || ''] || '0');
      const valor = parseFloat(valorStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
      
      const recebimento = row[recebimentoColumn || ''];
      const metodoPagamento = String(row[metodoPagamentoColumn || ''] || 'Não especificado').trim();
      debugger
      // Verificar se é inadimplente baseado no mês de referência
      let isInadimplente = false;
      if (mesReferenciaDate && dataVencimentoColumn) {
        const dataVencimentoStr = String(row[dataVencimentoColumn] || '');
        const dataVencimento = parseDate(dataVencimentoStr);
        
        // Inadimplente: data de vencimento anterior ao mês de referência
        if (dataVencimento && dataVencimento < mesReferenciaDate) {
          isInadimplente = true;
          totalInadimplentes += valor;
          console.log(`🔴 Inadimplente encontrado: ${row[valorColumn || '']} - Data vencimento: ${dataVencimentoStr} - Valor: ${valor}`);
        }
      }
      
      // Se não é inadimplente, contabilizar normalmente
      if (!isInadimplente) {
        // Se tem data de recebimento (recebido)
        if (recebimento && String(recebimento).trim() !== '') {
          if (!totalRecebidoPorForma[metodoPagamento]) {
            totalRecebidoPorForma[metodoPagamento] = 0;
          }
          totalRecebidoPorForma[metodoPagamento] += valor;
        } else {
          // Em aberto
          totalEmAberto += valor;
        }
      }
    });

    console.log(`📊 Total inadimplentes calculado: ${totalInadimplentes}`);
    console.log(`📊 Mês referência usado: ${filters.mesReferencia}`);
    console.log(`📊 Data limite para inadimplência: ${mesReferenciaDate?.toLocaleDateString('pt-BR')}`);

    setConsolidado({ totalRecebidoPorForma, totalEmAberto, totalInadimplentes });
  };

  // Função auxiliar para fazer parsing de datas
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    
    const cleanDate = String(dateStr).trim();
    
    // Tenta diferentes formatos de data
    const dateFormats = [
      // dd/mm/yyyy ou dd/mm/yy
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
      // dd/mm
      /(\d{1,2})\/(\d{1,2})/,
      // dd-mm-yyyy
      /(\d{1,2})-(\d{1,2})-(\d{2,4})/,
    ];

    for (const format of dateFormats) {
      const match = cleanDate.match(format);
      if (match) {
        let day = parseInt(match[1]);
        let month = parseInt(match[2]);
        let year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
        
        // Ajusta ano de 2 dígitos
        if (year < 100) {
          year += year < 50 ? 2000 : 1900;
        }
        
        // Valida data
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return new Date(year, month - 1, day);
        }
      }
    }
    
    return null;
  };

  const handleGeneratePDF = async () => {
    if (!reportData || !consolidado || selectedColumns.length === 0) {
      toast.error("Selecione pelo menos uma coluna para o PDF");
      return;
    }

    try {
      // Filtrar dados para incluir apenas as colunas selecionadas (sem planos de assinatura)
      const filteredForPDF = dataWithoutPlans.map(row => {
        const newRow: Record<string, any> = {};
        selectedColumns.forEach(col => {
          newRow[col] = row[col];
        });
        return newRow;
      });

      // Calcular total de alunos ativos
      const clientesData = dataWithoutPlans.length > 0 ? Object.keys(dataWithoutPlans[0]) : [];
      const nomeColumn = clientesData.find(col => 
        col.toLowerCase().includes('nome') || 
        col.toLowerCase().includes('cliente') ||
        col.toLowerCase().includes('client')
      );
      
      const recebimentoColumn = clientesData.find(col => 
        col.toLowerCase().includes('recebimento') || 
        col.toLowerCase().includes('receb') ||
        col.toLowerCase().includes('received') ||
        col.toLowerCase().includes('pagamento') && !col.toLowerCase().includes('método')
      );
      
      // Clientes únicos dos dados mensais
      const clientesMensaisUnicos = new Set<string>();
      const clientesAdimplentes = new Set<string>();
      const clientesInadimplentes = new Set<string>();
      
      dataWithoutPlans.forEach(row => {
        const nomeCliente = String(row[nomeColumn || ''] || '').trim();
        if (nomeCliente && nomeCliente !== '') {
          clientesMensaisUnicos.add(nomeCliente.toLowerCase());
          
          const recebimento = row[recebimentoColumn || ''];
          if (recebimento && String(recebimento).trim() !== '') {
            clientesAdimplentes.add(nomeCliente.toLowerCase());
          } else {
            clientesInadimplentes.add(nomeCliente.toLowerCase());
          }
        }
      });
      
      // Clientes únicos dos planos ativos
      const clientesPlanos = new Set<string>();
      activePlans.forEach(plan => {
        const nomeCliente = String(plan.nome_cliente || '').trim();
        if (nomeCliente && nomeCliente !== '') {
          clientesPlanos.add(nomeCliente.toLowerCase());
        }
      });
      
      // Combinar todos os clientes únicos
      const todosClientes = new Set([...clientesMensaisUnicos, ...clientesPlanos]);
      
      const alunosAtivos = {
        total: todosClientes.size,
        adimplentes: clientesAdimplentes.size,
        inadimplentes: clientesInadimplentes.size
      };

      // Determinar mês/ano para o título
      let periodoTexto = '';
      if (filters.mesReferencia) {
        periodoTexto = filters.mesReferencia;
      } else if (filters.dataVencimento?.from) {
        const dataVenc = new Date(filters.dataVencimento.from);
        const mes = dataVenc.toLocaleDateString('pt-BR', { month: '2-digit' });
        const ano = dataVenc.getFullYear();
        periodoTexto = `${mes}/${ano}`;
      }

      await generatePDF(
        filteredForPDF, 
        `Relatório Consolidado - ${periodoTexto || 'Período não especificado'}`,
        logoPathCover,
        logoPathHeader,
        consolidado,
        pdfOrientation,
        activePlans, // Incluir planos ativos
        alunosAtivos, // Incluir dados de alunos ativos
        filters.sede || 'Sede não especificada', // Sede
        periodoTexto || 'Período não especificado', // Período MM/AAAA
        inadimplentesList // Incluir lista de inadimplentes
      );
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error("Erro ao gerar PDF");
    }
  };

  const handleColumnToggle = (column: string, checked: boolean) => {
    if (checked) {
      setSelectedColumns(prev => [...prev, column]);
    } else {
      setSelectedColumns(prev => prev.filter(col => col !== column));
    }
  };

  const handleSelectAllColumns = () => {
    if (!dataWithoutPlans.length) return;
    const allColumns = Object.keys(dataWithoutPlans[0]);
    setSelectedColumns(allColumns);
  };

  const handleDeselectAllColumns = () => {
    setSelectedColumns([]);
  };

  if (!reportData || !consolidado) {
    return <div>Carregando...</div>;
  }
  const { filters } = reportData;
  const activeFilters = Object.entries(filters).filter(([_, value]) => value).length;

  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Relatório Final</h1>
            <p className="text-muted-foreground">
              {dataWithoutPlans.length} registros filtrados • {activePlans.length} plano(s) de assinatura
              {activeFilters > 0 && ` • ${activeFilters} filtro${activeFilters > 1 ? 's' : ''} aplicado${activeFilters > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPdfSettings(!showPdfSettings)}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Configurar PDF
          </Button>
          <Button 
            onClick={handleGeneratePDF} 
            className="gap-2"
            disabled={selectedColumns.length === 0}
          >
            <Download className="h-4 w-4" />
            Gerar PDF
          </Button>
        </div>
      </div>

      {/* Filtros Aplicados */}
      {activeFilters > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros Aplicados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {filters.mesReferencia && (
                <Badge variant="outline">
                  Mês Referência: {filters.mesReferencia}
                </Badge>
              )}
              {filters.dataVencimento && (
                <Badge variant="outline">
                  Vencimento: {filters.dataVencimento.from?.toLocaleDateString('pt-BR')} - {filters.dataVencimento.to?.toLocaleDateString('pt-BR')}
                </Badge>
              )}
              {filters.dataRecebimento && (
                <Badge variant="outline">
                  Recebimento: {filters.dataRecebimento.from?.toLocaleDateString('pt-BR')} - {filters.dataRecebimento.to?.toLocaleDateString('pt-BR')}
                </Badge>
              )}
              {filters.metodoPagamento && (
                <Badge variant="outline">
                  Método: {filters.metodoPagamento}
                </Badge>
              )}
              {filters.sede && (
                <Badge variant="outline">
                  Sede: {filters.sede}
                </Badge>
              )}
              {filters.tipo && (
                <Badge variant="outline">
                  Tipo: {filters.tipo}
                </Badge>
              )}
              {filters.status && (
                <Badge variant="outline">
                  Status: {filters.status}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        )}

      {/* Configurações do PDF */}
      {showPdfSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações do PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Seleção de Colunas */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-sm font-medium">Colunas para incluir no PDF</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllColumns}
                  >
                    Selecionar Todas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllColumns}
                  >
                    Limpar Seleção
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/20">
                {dataWithoutPlans.length > 0 && Object.keys(dataWithoutPlans[0]).map((column) => (
                  <div key={column} className="flex items-center space-x-2">
                    <Checkbox
                      id={`col-${column}`}
                      checked={selectedColumns.includes(column)}
                      onCheckedChange={(checked) => handleColumnToggle(column, !!checked)}
                    />
                    <Label
                      htmlFor={`col-${column}`}
                      className="text-sm cursor-pointer truncate"
                      title={column}
                    >
                      {column}
                    </Label>
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                {selectedColumns.length} de {dataWithoutPlans.length > 0 ? Object.keys(dataWithoutPlans[0]).length : 0} colunas selecionadas
              </p>
            </div>

            {/* Orientação do PDF */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Orientação do PDF</Label>
              <RadioGroup
                value={pdfOrientation}
                onValueChange={(value) => setPdfOrientation(value as 'portrait' | 'landscape')}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="portrait" id="portrait" />
                  <Label htmlFor="portrait" className="cursor-pointer">
                    Retrato (Vertical)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="landscape" id="landscape" />
                  <Label htmlFor="landscape" className="cursor-pointer">
                    Paisagem (Horizontal)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground mt-2">
                Paisagem é recomendada para tabelas com muitas colunas
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consolidado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total Recebido por Forma de Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Valores Recebidos por Forma de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(consolidado.totalRecebidoPorForma).length > 0 ? (
              Object.entries(consolidado.totalRecebidoPorForma)
                .sort(([,a], [,b]) => b - a)
                .map(([forma, valor]) => (
                  <div key={forma} className="flex justify-between items-center">
                    <span className="font-medium">{forma}</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(valor)}
                    </span>
                  </div>
                ))
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Nenhum valor recebido nos registros filtrados
              </p>
            )}
            
            {Object.keys(consolidado.totalRecebidoPorForma).length > 0 && (
              <>
                <Separator />
                <div className="flex justify-between items-center font-bold">
                  <span>Total Recebido:</span>
                  <span className="text-xl text-green-700">
                    {formatCurrency(Object.values(consolidado.totalRecebidoPorForma).reduce((acc, val) => acc + val, 0))}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total em Aberto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Valores em Aberto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="text-3xl font-bold text-red-600 mb-2">
                {formatCurrency(consolidado.totalEmAberto)}
              </div>
              <p className="text-muted-foreground">
                Total de valores ainda não recebidos
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Inadimplentes Recebimentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Inadimplentes Recebidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="text-3xl font-bold text-red-600 mb-2">
                {formatCurrency(consolidado.totalInadimplentes)}
              </div>
              <p className="text-muted-foreground">
                Recebimentos com vencimento anterior ao mês de referência
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total de Alunos Ativos */}
      <Card>
        <CardHeader>
          <CardTitle>Total de Alunos Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            {(() => {
              // Calcular alunos únicos dos dados filtrados (planos mensais)
              const clientesData = dataWithoutPlans.length > 0 ? Object.keys(dataWithoutPlans[0]) : [];
              const nomeColumn = clientesData.find(col => 
                col.toLowerCase().includes('nome') || 
                col.toLowerCase().includes('cliente') ||
                col.toLowerCase().includes('client')
              );
              
              const recebimentoColumn = clientesData.find(col => 
                col.toLowerCase().includes('recebimento') || 
                col.toLowerCase().includes('receb') ||
                col.toLowerCase().includes('received') ||
                col.toLowerCase().includes('pagamento') && !col.toLowerCase().includes('método')
              );
              
              // Clientes únicos dos dados mensais
              const clientesMensaisUnicos = new Set<string>();
              const clientesAdimplentes = new Set<string>();
              const clientesInadimplentes = new Set<string>();
              
              dataWithoutPlans.forEach(row => {
                const nomeCliente = String(row[nomeColumn || ''] || '').trim();
                if (nomeCliente && nomeCliente !== '') {
                  clientesMensaisUnicos.add(nomeCliente.toLowerCase());
                  
                  const recebimento = row[recebimentoColumn || ''];
                  if (recebimento && String(recebimento).trim() !== '') {
                    clientesAdimplentes.add(nomeCliente.toLowerCase());
                  } else {
                    clientesInadimplentes.add(nomeCliente.toLowerCase());
                  }
                }
              });
              
              // Clientes únicos dos planos ativos
              const clientesPlanos = new Set<string>();
              activePlans.forEach(plan => {
                const nomeCliente = String(plan.nome_cliente || '').trim();
                if (nomeCliente && nomeCliente !== '') {
                  clientesPlanos.add(nomeCliente.toLowerCase());
                }
              });
              
              // Combinar todos os clientes únicos
              const todosClientes = new Set([...clientesMensaisUnicos, ...clientesPlanos]);
              
              return (
                <>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {todosClientes.size}
                    </div>
                    <p className="text-sm text-muted-foreground">Total de Alunos Ativos</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {clientesAdimplentes.size}
                    </div>
                    <p className="text-sm text-muted-foreground">Adimplentes</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {clientesInadimplentes.size}
                    </div>
                    <p className="text-sm text-muted-foreground">Inadimplentes</p>
                  </div>
                </>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Resumo Geral */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(Object.values(consolidado.totalRecebidoPorForma).reduce((acc, val) => acc + val, 0))}
              </div>
              <p className="text-sm text-muted-foreground">Total Recebido</p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(consolidado.totalEmAberto)}
              </div>
              <p className="text-sm text-muted-foreground">Total em Aberto</p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">
                {formatCurrency(activePlans.reduce((sum, plan) => sum + (plan.valor || 0), 0))}
              </div>
              <p className="text-sm text-muted-foreground">Total Planos Trimestrais/Semmestrais</p>
            </div>            
            
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(Object.values(consolidado.totalRecebidoPorForma).reduce((acc, val) => acc + val, 0) 
                                + consolidado.totalEmAberto 
                                + (activePlans.reduce((sum, plan) => sum + (plan.valor || 0), 0)))}
              </div>
              <p className="text-sm text-muted-foreground">Total Geral</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Planos de Assinatura Ativos */}
      {activePlans.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Planos de Assinatura Ativos no Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {activePlans.length}
                  </div>
                  <p className="text-sm text-muted-foreground">Total de Planos</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {activePlans.filter(p => p.tipo_plano === 'trimestral').length}
                  </div>
                  <p className="text-sm text-muted-foreground">Trimestrais</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {activePlans.filter(p => p.tipo_plano === 'semestral').length}
                  </div>
                  <p className="text-sm text-muted-foreground">Semestrais</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(activePlans.reduce((sum, plan) => sum + (plan.valor || 0), 0))}
                  </div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                </div>
              </div>

              {/* Totais por Método de Pagamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Totais por Método de Pagamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(() => {
                      const totaisPorMetodo = activePlans.reduce((acc, plan) => {
                        const metodo = plan.metodoPagamento || 'Não especificado';
                        acc[metodo] = (acc[metodo] || 0) + (plan.valor || 0);
                        return acc;
                      }, {} as Record<string, number>);

                      return Object.entries(totaisPorMetodo)
                        .sort(([,a], [,b]) => b - a)
                        .map(([metodo, valor]) => (
                          <div key={metodo} className="flex justify-between items-center">
                            <span className="font-medium">{metodo}</span>
                            <span className="text-lg font-bold text-purple-600">
                              {formatCurrency(valor)}
                            </span>
                          </div>
                        ));
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quantidade por Método de Pagamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(() => {
                      const quantidadePorMetodo = activePlans.reduce((acc, plan) => {
                        const metodo = plan.metodoPagamento || 'Não especificado';
                        acc[metodo] = (acc[metodo] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);

                      return Object.entries(quantidadePorMetodo)
                        .sort(([,a], [,b]) => b - a)
                        .map(([metodo, quantidade]) => (
                          <div key={metodo} className="flex justify-between items-center">
                            <span className="font-medium">{metodo}</span>
                            <span className="text-lg font-bold text-blue-600">
                              {quantidade}
                            </span>
                          </div>
                        ));
                    })()}
                  </CardContent>
                </Card>
              </div>

              {/* Tabela de Planos */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 p-2 text-left font-medium">Tipo</th>
                      <th className="border border-gray-300 p-2 text-left font-medium">Cliente</th>
                      <th className="border border-gray-300 p-2 text-left font-medium">Vencimento</th>
                      <th className="border border-gray-300 p-2 text-left font-medium">Período</th>
                      <th className="border border-gray-300 p-2 text-left font-medium">Valor</th>
                      <th className="border border-gray-300 p-2 text-left font-medium">Método de pagamento</th>
                    </tr>
                  </thead>
                  <tbody> 
                    {activePlans.map((plan, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-2">
                          <Badge variant={plan.tipo_plano === 'trimestral' ? 'default' : 'secondary'}>
                            {plan.tipo_plano}
                          </Badge>
                        </td>
                        <td className="border border-gray-300 p-2">
                          {plan.nome_cliente || 'Não informado'}
                        </td>
                        <td className="border border-gray-300 p-2">
                          {plan.data_vencimento.toLocaleDateString('pt-BR')}
                        </td>
                        <td className="border border-gray-300 p-2">
                          {plan.data_inicio} a {plan.data_fim}
                        </td>
                        <td className="border border-gray-300 p-2">
                          {formatCurrency(plan.valor)}
                        </td>
                          <td className="border border-gray-300 p-2">
                          {plan.metodoPagamento || 'Não identificado'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Inadimplentes */}
      {inadimplentesList.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Tabela de Inadimplentes ({inadimplentesList.length} registros)</CardTitle>
            <p className="text-muted-foreground">
              Registros que compõem o valor de "Inadimplentes Recebidos" - vencimento anterior ao mês de referência
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    {inadimplentesList.length > 0 && Object.keys(inadimplentesList[0]).map((column) => (
                      <th key={column} className="border border-gray-300 p-2 text-left font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody> 
                  {inadimplentesList.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      {Object.entries(row).map(([column, value], cellIndex) => (
                        <td key={cellIndex} className="border border-gray-300 p-2">
                          {formatCellValue(value, column)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview dos Dados */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Filtrados ({dataWithoutPlans.length} registros)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  {dataWithoutPlans.length > 0 && Object.keys(dataWithoutPlans[0])
                    .filter(column => selectedColumns.includes(column))
                    .map((column) => (
                    <th key={column} className="border border-gray-300 p-2 text-left font-medium">
                      {column}
                      {!selectedColumns.includes(column) && (
                        <span className="text-xs text-muted-foreground ml-1">(não incluída no PDF)</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataWithoutPlans.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {Object.entries(row)
                      .filter(([column]) => selectedColumns.includes(column))
                      .map(([column, value], cellIndex) => (
                      <td key={cellIndex} className="border border-gray-300 p-2">
                        {formatCellValue(value, column)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}