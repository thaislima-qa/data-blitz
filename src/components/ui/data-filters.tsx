import * as React from "react";
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Filter, FilterX, Calendar, CreditCard } from "lucide-react";

export interface FilterState {
  dataVencimento?: DateRange;
  dataRecebimento?: DateRange;
  metodoPagamento?: string;
}

interface DataFiltersProps {
  data: Record<string, any>[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  className?: string;
}

export const DataFilters = React.forwardRef<HTMLDivElement, DataFiltersProps>(
  ({ data, filters, onFiltersChange, className }, ref) => {
    // Detect column names for dates and payment method
    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    
    const vencimentoColumn = columns.find(col => 
      col.toLowerCase().includes('vencimento') || 
      col.toLowerCase().includes('venc') ||
      col.toLowerCase().includes('due')
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

    // Get unique payment methods
    const paymentMethods = React.useMemo(() => {
      if (!metodoPagamentoColumn) return [];
      
      const methods = data
        .map(row => row[metodoPagamentoColumn])
        .filter(method => method && String(method).trim() !== '')
        .map(method => String(method).trim());
      
      return Array.from(new Set(methods)).sort();
    }, [data, metodoPagamentoColumn]);

    const hasFilters = vencimentoColumn || recebimentoColumn || metodoPagamentoColumn;
    
    if (!hasFilters) {
      return null;
    }

    const activeFiltersCount = Object.values(filters).filter(Boolean).length;

    const handleClearFilters = () => {
      onFiltersChange({});
    };

    const handleVencimentoChange = (range: DateRange | undefined) => {
      onFiltersChange({
        ...filters,
        dataVencimento: range,
      });
    };

    const handleRecebimentoChange = (range: DateRange | undefined) => {
      onFiltersChange({
        ...filters,
        dataRecebimento: range,
      });
    };

    const handleMetodoChange = (method: string) => {
      onFiltersChange({
        ...filters,
        metodoPagamento: method === "all" ? undefined : method,
      });
    };

    return (
      <Card ref={ref} className={className}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filtros de Dados
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount} ativo{activeFiltersCount > 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 px-2"
              >
                <FilterX className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Data de Vencimento Filter */}
            {vencimentoColumn && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data de Vencimento
                </Label>
                <DateRangePicker
                  value={filters.dataVencimento}
                  onChange={handleVencimentoChange}
                  placeholder="Período de vencimento"
                />
                <p className="text-xs text-muted-foreground">
                  Coluna: {vencimentoColumn}
                </p>
              </div>
            )}

            {/* Data de Recebimento Filter */}
            {recebimentoColumn && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data de Recebimento
                </Label>
                <DateRangePicker
                  value={filters.dataRecebimento}
                  onChange={handleRecebimentoChange}
                  placeholder="Período de recebimento"
                />
                <p className="text-xs text-muted-foreground">
                  Coluna: {recebimentoColumn}
                </p>
              </div>
            )}

            {/* Método de Pagamento Filter */}
            {metodoPagamentoColumn && paymentMethods.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Método de Pagamento
                </Label>
                <Select
                  value={filters.metodoPagamento || "all"}
                  onValueChange={handleMetodoChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os métodos" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    <SelectItem value="all">Todos os métodos</SelectItem>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Coluna: {metodoPagamentoColumn} ({paymentMethods.length} opções)
                </p>
              </div>
            )}
          </div>

          {/* Active Filters Summary */}
          {activeFiltersCount > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Filtros ativos:</p>
              <div className="flex flex-wrap gap-2">
                {filters.dataVencimento && (
                  <Badge variant="outline" className="text-xs">
                    Vencimento: {filters.dataVencimento.from?.toLocaleDateString('pt-BR')} - {filters.dataVencimento.to?.toLocaleDateString('pt-BR')}
                  </Badge>
                )}
                {filters.dataRecebimento && (
                  <Badge variant="outline" className="text-xs">
                    Recebimento: {filters.dataRecebimento.from?.toLocaleDateString('pt-BR')} - {filters.dataRecebimento.to?.toLocaleDateString('pt-BR')}
                  </Badge>
                )}
                {filters.metodoPagamento && (
                  <Badge variant="outline" className="text-xs">
                    Método: {filters.metodoPagamento}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

DataFilters.displayName = "DataFilters";