import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { FilterState } from "@/components/ui/data-filters";
import { applyFilters } from "@/lib/data-filters";
import { generatePDF } from "@/lib/pdf-generator";
import { toast } from "sonner";
import logoTaianaLima from "/logo-taiana-lima.png";

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

  useEffect(() => {
    const data = location.state as ReportData;
    if (!data) {
      navigate('/');
      return;
    }
    
    setReportData(data);
    
    // Calcular consolidado
    const { filteredData } = data;
    calculateConsolidado(filteredData);
  }, [location.state, navigate]);

  const calculateConsolidado = (data: Record<string, any>[]) => {
    if (!data.length) return;

    const columns = Object.keys(data[0]);
    
    // Detectar colunas
    const valorColumn = columns.find(col => 
      col.toLowerCase().includes('valor') || 
      col.toLowerCase().includes('amount') ||
      col.toLowerCase().includes('total')
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
      const valor = parseFloat(String(row[valorColumn || ''] || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
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
    if (!reportData || !consolidado) return;

    try {
      await generatePDF(
        reportData.filteredData, 
        `Relatório Consolidado - ${new Date().toLocaleDateString('pt-BR')}`,
        logoTaianaLima,
        consolidado
      );
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error("Erro ao gerar PDF");
    }
  };

  if (!reportData || !consolidado) {
    return <div>Carregando...</div>;
  }

  const { filteredData, filters } = reportData;
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
              {filteredData.length} registros encontrados
              {activeFilters > 0 && ` • ${activeFilters} filtro${activeFilters > 1 ? 's' : ''} aplicado${activeFilters > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        
        <Button onClick={handleGeneratePDF} className="gap-2">
          <Download className="h-4 w-4" />
          Gerar PDF
        </Button>
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
                      R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                    R$ {Object.values(consolidado.totalRecebidoPorForma)
                      .reduce((acc, val) => acc + val, 0)
                      .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                R$ {consolidado.totalEmAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                R$ {Object.values(consolidado.totalRecebidoPorForma)
                  .reduce((acc, val) => acc + val, 0)
                  .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-muted-foreground">Total Recebido</p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                R$ {consolidado.totalEmAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-muted-foreground">Total em Aberto</p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                R$ {(Object.values(consolidado.totalRecebidoPorForma)
                  .reduce((acc, val) => acc + val, 0) + consolidado.totalEmAberto)
                  .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-muted-foreground">Total Geral</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview dos Dados */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Filtrados ({filteredData.length} registros)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  {filteredData.length > 0 && Object.keys(filteredData[0]).map((column) => (
                    <th key={column} className="border border-gray-300 p-2 text-left font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.slice(0, 10).map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {Object.values(row).map((value, cellIndex) => (
                      <td key={cellIndex} className="border border-gray-300 p-2">
                        {String(value || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredData.length > 10 && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Mostrando 10 de {filteredData.length} registros. Veja o relatório completo no PDF.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}