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
import logoTaianaLima from "/logo-taiana-lima.png";
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
  } | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [showPdfSettings, setShowPdfSettings] = useState(false);
  const [activePlans, setActivePlans] = useState<SubscriptionPlan[]>([]);
  const [dataWithoutPlans, setDataWithoutPlans] = useState<Record<string, any>[]>([]);

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
      
      // Buscar TODOS os planos ativos existentes no Supabase baseado no filtro de data de vencimento
      let existingActivePlans: SubscriptionPlan[] = [];
      if (filters.dataVencimento?.from && filters.dataVencimento?.to) {
        existingActivePlans = await getActivePlansInPeriod(
          filters.dataVencimento.from,
          filters.dataVencimento.to
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
      });
      
      // Filtrar dados removendo os que são planos de assinatura
      const dataWithoutPlans = filteredData.filter(row => {
        // Verifica se este registro é um plano de assinatura
        const rowText = Object.entries(row)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' ')
          .toLowerCase();
          
        const isSubscriptionPlan = rowText.includes('trimestral') || rowText.includes('semestral');
        return !isSubscriptionPlan;
      });
      
      setDataWithoutPlans(dataWithoutPlans);
      setActivePlans(allPlans);
      
      // Inicializar colunas selecionadas com base nos dados sem planos
      if (dataWithoutPlans.length > 0) {
        const columns = Object.keys(dataWithoutPlans[0]);
        setSelectedColumns(columns);
      }
      
      // Calcular consolidado apenas com dados que não são planos
      calculateConsolidado(dataWithoutPlans);
      
    } catch (error) {
      console.error('Erro ao processar planos de assinatura:', error);
      toast.error('Erro ao processar planos de assinatura');
      
      // Em caso de erro, usar os dados originais
      setDataWithoutPlans(filteredData);
      calculateConsolidado(filteredData);
    }
  };



  const calculateConsolidado = (data: Record<string, any>[]) => {
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

    const totalRecebidoPorForma: Record<string, number> = {};
    let totalEmAberto = 0;

    data.forEach(row => {
      // Melhor parsing de valores monetários
      const valorStr = String(row[valorColumn || ''] || '0');
      const valor = parseFloat(valorStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
      
      const recebimento = row[recebimentoColumn || ''];
      const metodoPagamento = String(row[metodoPagamentoColumn || ''] || 'Não especificado').trim();
      
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
    });

    setConsolidado({ totalRecebidoPorForma, totalEmAberto });
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

      await generatePDF(
        filteredForPDF, 
        `Relatório Consolidado - ${new Date().toLocaleDateString('pt-BR')}`,
        logoTaianaLima,
        consolidado,
        pdfOrientation,
        activePlans // Incluir planos ativos
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      </div>

      {/* Resumo Geral */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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