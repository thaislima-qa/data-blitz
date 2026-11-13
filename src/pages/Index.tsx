import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { processCSVFile } from "@/lib/csv-processor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Filter, Combine } from "lucide-react";
import { toast } from "sonner";
import { DataFilters, FilterState } from "@/components/ui/data-filters";
import { MultipleFilters, MultipleFilter } from "@/components/ui/multiple-filters";
import { applyFilters, getFilterSummary, applyCombinedFilters, getCombinedFilterSummary } from "@/lib/data-filters";
import { identifySubscriptionPlans, saveSubscriptionPlans } from "@/lib/subscription-plans";

export default function Index() {
  const navigate = useNavigate();
  const [csvData, setCsvData] = useState<Record<string, any>[]>([]);
  const [filters, setFilters] = useState<FilterState>({});
  const [multipleFilters, setMultipleFilters] = useState<MultipleFilter[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [filterMode, setFilterMode] = useState<'simple' | 'combined'>('simple');

  // Aplicar filtros baseado no modo selecionado
  const filteredData = filterMode === 'simple' 
    ? applyFilters(csvData, filters)
    : applyCombinedFilters(csvData, multipleFilters);
    
  const filterSummary = filterMode === 'simple'
    ? getFilterSummary(csvData, filteredData, filters)
    : getCombinedFilterSummary(csvData, filteredData, multipleFilters);

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error("Por favor, selecione apenas arquivos CSV");
      return;
    }

    setIsUploading(true);
    try {
      const result = await processCSVFile(file);
      setCsvData(result.data);
      
      // Identifica e salva planos de assinatura
      const plans = identifySubscriptionPlans(result.data);
      if (plans.length > 0) {
        const saveResult = await saveSubscriptionPlans(plans);
        if (saveResult.saved > 0) {
          toast.success(`Arquivo processado com sucesso! ${result.data.length} registros carregados e ${saveResult.saved} plano(s) salvo(s).`);
        } else if (saveResult.skipped > 0) {
          toast.success(`Arquivo processado com sucesso! ${result.data.length} registros carregados. ${saveResult.skipped} plano(s) já existia(m).`);
        } else {
          toast.success(`Arquivo processado com sucesso! ${result.data.length} registros carregados.`);
        }
      } else {
        toast.success(`Arquivo processado com sucesso! ${result.data.length} registros carregados.`);
      }
    } catch (error) {
      toast.error("Erro ao processar arquivo CSV");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateReport = () => {
    if (filteredData.length === 0) {
      toast.error("Nenhum dado disponível para gerar relatório");
      return;
    }

    // Preparar dados para o relatório baseado no modo de filtro
    const reportState = filterMode === 'simple' 
      ? {
          filteredData,
          originalData: csvData,
          filters,
          filterMode: 'simple' as const
        }
      : {
          filteredData,
          originalData: csvData,
          multipleFilters,
          filterMode: 'combined' as const
        };

    navigate('/report', { state: reportState });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <FileText className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Sistema de Relatórios CSV
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Importe seus dados CSV e gere relatórios profissionais em PDF de forma rápida e intuitiva
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/consolidado")}>
            Consolidado mensal por sede (.xlsx)
          </Button>
        </div>

        {/* Upload Section */}
        <Card className="mb-8 shadow-lg border-0 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar Arquivo CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              onFileSelect={handleFileUpload}
              disabled={isUploading}
            />
            {isUploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Processando arquivo...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters Section */}
        {csvData.length > 0 && (
          <Card className="mb-8 shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <Tabs value={filterMode} onValueChange={(value) => setFilterMode(value as 'simple' | 'combined')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="simple" className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtro Simples
                  </TabsTrigger>
                  <TabsTrigger value="combined" className="flex items-center gap-2">
                    <Combine className="h-4 w-4" />
                    Filtros Combinados
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="simple" className="mt-0">
                  <DataFilters
                    data={csvData}
                    filters={filters}
                    onFiltersChange={setFilters}
                  />
                </TabsContent>
                
                <TabsContent value="combined" className="mt-0">
                  <MultipleFilters
                    data={csvData}
                    multipleFilters={multipleFilters}
                    onMultipleFiltersChange={setMultipleFilters}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Results Summary and Generate Report Button */}
        {csvData.length > 0 && (
          <Card className="mb-8 shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Resumo dos Dados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-lg">
                    <strong>{filterSummary.filtered}</strong> registros 
                    <span className="text-muted-foreground">
                      {" "}de {filterSummary.total} total
                    </span>
                  </p>
                  {filterMode === 'simple' ? (
                    'filtersApplied' in filterSummary && filterSummary.filtersApplied > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Filtros ativos: {(filterSummary as any).activeFilters.join(', ')}
                      </p>
                    )
                  ) : (
                    'filtersCount' in filterSummary && filterSummary.filtersCount > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {filterSummary.filtersCount} filtro{filterSummary.filtersCount > 1 ? 's' : ''} combinado{filterSummary.filtersCount > 1 ? 's' : ''} ({filterSummary.totalCriteria} critério{filterSummary.totalCriteria > 1 ? 's' : ''})
                      </p>
                    )
                  )}
                </div>
                
                <Button
                  onClick={handleGenerateReport}
                  className="gap-2"
                  disabled={filteredData.length === 0}
                  size="lg"
                >
                  <FileText className="h-4 w-4" />
                  Gerar Relatório Final
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Preview Table */}
        {filteredData.length > 0 && (
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Preview dos Dados ({filteredData.length} registros)</CardTitle>
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
                    {filteredData.map((row, index) => (
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {csvData.length === 0 && (
          <Card className="text-center py-12 shadow-lg border-0 bg-card/30 backdrop-blur-sm">
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-muted/50">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Nenhum arquivo carregado</h3>
                  <p className="text-muted-foreground max-w-md">
                    Faça upload de um arquivo CSV para começar a visualizar os dados e gerar relatórios profissionais.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}