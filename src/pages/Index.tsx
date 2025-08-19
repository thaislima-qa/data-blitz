import React, { useState, useMemo } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { DataTable } from "@/components/ui/data-table";
import { DataFilters, FilterState } from "@/components/ui/data-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { processCSVFile, validateCSVData, getDataSummary } from "@/lib/csv-processor";
import { generatePDFReport, downloadPDF } from "@/lib/pdf-generator";
import { applyFilters, getFilterSummary } from "@/lib/data-filters";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, BarChart3, Upload, AlertCircle, Filter, TrendingDown, FilterX } from "lucide-react";

const Index = () => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<Record<string, any>[]>([]);
  const [filters, setFilters] = useState<FilterState>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { toast } = useToast();

  // Apply filters to data
  const filteredData = useMemo(() => {
    return applyFilters(csvData, filters);
  }, [csvData, filters]);

  // Get filter summary
  const filterSummary = useMemo(() => {
    return getFilterSummary(csvData, filteredData, filters);
  }, [csvData, filteredData, filters]);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setCsvFile(file);
    
    try {
      const result = await processCSVFile(file);
      
      if (result.errors.length > 0) {
        toast({
          title: "Avisos no processamento",
          description: `${result.errors.length} avisos encontrados. Dados processados com sucesso.`,
          variant: "default",
        });
      }

      const validation = validateCSVData(result.data);
      if (!validation.isValid) {
        toast({
          title: "Problemas detectados",
          description: validation.issues.join(", "),
          variant: "destructive",
        });
      }

      setCsvData(result.data);
      
      toast({
        title: "Arquivo processado com sucesso!",
        description: `${result.data.length} linhas carregadas.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: "Verifique se o arquivo está no formato CSV correto.",
        variant: "destructive",
      });
      console.error("CSV processing error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearFile = () => {
    setCsvFile(null);
    setCsvData([]);
    setFilters({});
  };

  const handleGeneratePDF = async () => {
    if (filteredData.length === 0) return;

    setIsGeneratingPDF(true);
    
    try {
      const summary = getDataSummary(filteredData);
      
      const sections = [{
        title: filterSummary.filtersApplied > 0 
          ? `Dados Filtrados - ${filterSummary.activeFilters.join(', ')}`
          : "Dados Importados do CSV",
        data: filteredData,
        summary: {
          totalRows: summary.totalRows,
          columnStats: summary.columns.reduce((acc, col) => {
            acc[col.name] = {
              type: col.type,
              unique: col.uniqueCount,
              empty: col.emptyCount,
            };
            return acc;
          }, {} as Record<string, any>),
        },
      }];

      const doc = generatePDFReport(sections, {
        title: `Relatório - ${csvFile?.name || 'Dados CSV'}${filterSummary.filtersApplied > 0 ? ' (Filtrado)' : ''}`,
        orientation: 'landscape',
        includeHeader: true,
        includeFooter: true,
      });

      const filterSuffix = filterSummary.filtersApplied > 0 ? '_filtrado' : '';
      const filename = `relatorio_${csvFile?.name?.replace('.csv', '') || 'dados'}${filterSuffix}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      downloadPDF(doc, filename);
      
      toast({
        title: "PDF gerado com sucesso!",
        description: `Relatório ${filterSummary.filtersApplied > 0 ? 'filtrado ' : ''}salvo como ${filename}`,
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar PDF",
        description: "Ocorreu um erro durante a geração do relatório.",
        variant: "destructive",
      });
      console.error("PDF generation error:", error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const dataSummary = filteredData.length > 0 ? getDataSummary(filteredData) : null;

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
              onFileSelect={handleFileSelect}
              selectedFile={csvFile}
              onClearFile={handleClearFile}
              disabled={isProcessing}
            />
            {isProcessing && (
              <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Processando arquivo...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters Section */}
        {csvData.length > 0 && (
          <DataFilters
            data={csvData}
            filters={filters}
            onFiltersChange={setFilters}
            className="mb-8 shadow-lg border-0 bg-card/50 backdrop-blur-sm"
          />
        )}

        {/* Filter Summary */}
        {filterSummary.filtersApplied > 0 && (
          <Alert className="mb-8 bg-primary/5 border-primary/20">
            <Filter className="h-4 w-4" />
            <AlertDescription>
              <strong>Filtros aplicados:</strong> {filterSummary.activeFilters.join(', ')} • 
              Mostrando {filterSummary.filtered} de {filterSummary.total} registros
              {filterSummary.filtered !== filterSummary.total && (
                <span className="ml-2 text-primary font-medium">
                  ({((filterSummary.filtered / filterSummary.total) * 100).toFixed(1)}% dos dados)
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Data Summary */}
        {dataSummary && (
          <Card className="mb-8 shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Resumo dos Dados {filterSummary.filtersApplied > 0 && "(Filtrados)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 rounded-lg bg-primary/5">
                  <div className="text-2xl font-bold text-primary">{dataSummary.totalRows}</div>
                  <div className="text-sm text-muted-foreground">
                    {filterSummary.filtersApplied > 0 ? 'Linhas Filtradas' : 'Total de Linhas'}
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-secondary/50">
                  <div className="text-2xl font-bold text-secondary-foreground">{dataSummary.totalColumns}</div>
                  <div className="text-sm text-muted-foreground">Colunas</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-accent/50">
                  <div className="text-2xl font-bold text-accent-foreground">
                    {dataSummary.columns.reduce((sum, col) => sum + col.uniqueCount, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Valores Únicos</div>
                </div>
                {filterSummary.filtersApplied > 0 && (
                  <div className="text-center p-4 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 flex items-center justify-center gap-1">
                      <TrendingDown className="h-5 w-5" />
                      {filterSummary.total - filterSummary.filtered}
                    </div>
                    <div className="text-sm text-muted-foreground">Registros Filtrados</div>
                  </div>
                )}
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">COLUNAS DETECTADAS</h4>
                <div className="flex flex-wrap gap-2">
                  {dataSummary.columns.map((column, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {column.name} ({column.type})
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Preview */}
        {filteredData.length > 0 && (
          <div className="mb-8">
            <DataTable data={filteredData} />
          </div>
        )}

        {/* Generate PDF */}
        {filteredData.length > 0 && (
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Gerar Relatório PDF
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Relatório será gerado com:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Resumo estatístico dos dados</li>
                    <li>• Tabela completa formatada</li>
                    <li>• Metadados e informações técnicas</li>
                    <li>• Layout otimizado para impressão</li>
                  </ul>
                </div>
                <Button
                  onClick={handleGeneratePDF}
                  disabled={isGeneratingPDF || filteredData.length === 0}
                  variant="gradient"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {isGeneratingPDF ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      Gerando PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Gerar Relatório PDF
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {filteredData.length === 0 && csvData.length === 0 && !csvFile && (
          <Card className="text-center py-12 shadow-lg border-0 bg-card/30 backdrop-blur-sm">
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-muted/50">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
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

        {/* No Results After Filter */}
        {csvData.length > 0 && filteredData.length === 0 && filterSummary.filtersApplied > 0 && (
          <Card className="text-center py-12 shadow-lg border-0 bg-orange-50 dark:bg-orange-900/10">
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-orange-100 dark:bg-orange-900/20">
                  <Filter className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Nenhum resultado encontrado</h3>
                  <p className="text-muted-foreground max-w-md">
                    Os filtros aplicados não retornaram nenhum resultado. Tente ajustar os critérios de filtro ou limpe os filtros para ver todos os dados.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setFilters({})}
                    className="mt-4"
                  >
                    <FilterX className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
