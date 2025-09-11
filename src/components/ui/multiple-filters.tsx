import * as React from "react";
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Separator } from "@/components/ui/separator";
import { Filter, FilterX, Calendar, CreditCard, Plus, Trash2, Combine } from "lucide-react";
import { FilterState } from "./data-filters";

interface MultipleFilter {
  id: string;
  name: string;
  filters: FilterState;
}

interface MultipleFiltersProps {
  data: Record<string, any>[];
  multipleFilters: MultipleFilter[];
  onMultipleFiltersChange: (filters: MultipleFilter[]) => void;
  className?: string;
}

export const MultipleFilters = React.forwardRef<HTMLDivElement, MultipleFiltersProps>(
  ({ data, multipleFilters, onMultipleFiltersChange, className }, ref) => {
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
    
    const consultorColumn = columns.find(col => 
      col.toLowerCase().includes('consultor') || 
      col.toLowerCase().includes('advisor') ||
      col.toLowerCase().includes('salesperson')
    );

    const descricaoColumn = columns.find(col => 
      col.toLowerCase().includes('descrição') || 
      col.toLowerCase().includes('descricao') ||
      col.toLowerCase().includes('description') ||
      col.toLowerCase().includes('item') ||
      col.toLowerCase().includes('produto') ||
      col.toLowerCase().includes('product')
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

    const hasFilters = vencimentoColumn || recebimentoColumn || metodoPagamentoColumn || consultorColumn || descricaoColumn;
    
    if (!hasFilters) {
      return null;
    }

    const addNewFilter = () => {
      const newFilter: MultipleFilter = {
        id: `filter-${Date.now()}`,
        name: `Filtro ${multipleFilters.length + 1}`,
        filters: {}
      };
      onMultipleFiltersChange([...multipleFilters, newFilter]);
    };

    const removeFilter = (filterId: string) => {
      onMultipleFiltersChange(multipleFilters.filter(f => f.id !== filterId));
    };

    const updateFilter = (filterId: string, filters: FilterState) => {
      onMultipleFiltersChange(
        multipleFilters.map(f => 
          f.id === filterId ? { ...f, filters } : f
        )
      );
    };

    const updateFilterName = (filterId: string, name: string) => {
      onMultipleFiltersChange(
        multipleFilters.map(f => 
          f.id === filterId ? { ...f, name } : f
        )
      );
    };

    const clearAllFilters = () => {
      onMultipleFiltersChange([]);
    };

    const getTotalActiveFilters = () => {
      return multipleFilters.reduce((total, mf) => {
        return total + Object.values(mf.filters).filter(Boolean).length;
      }, 0);
    };

    const renderFilterSection = (multipleFilter: MultipleFilter) => {
      const { filters } = multipleFilter;
      
      const handleVencimentoChange = (range: DateRange | undefined) => {
        updateFilter(multipleFilter.id, {
          ...filters,
          dataVencimento: range,
        });
      };

      const handleRecebimentoChange = (range: DateRange | undefined) => {
        updateFilter(multipleFilter.id, {
          ...filters,
          dataRecebimento: range,
        });
      };

      const handleMetodoChange = (method: string) => {
        updateFilter(multipleFilter.id, {
          ...filters,
          metodoPagamento: method === "all" ? undefined : method,
        });
      };

      const handleSedeChange = (sede: string) => {
        updateFilter(multipleFilter.id, {
          ...filters,
          sede: sede === "all" ? undefined : sede,
        });
      };

      const handleTipoChange = (tipo: string) => {
        updateFilter(multipleFilter.id, {
          ...filters,
          tipo: tipo === "all" ? undefined : tipo,
        });
      };

      const handleStatusChange = (status: string) => {
        updateFilter(multipleFilter.id, {
          ...filters,
          status: status === "all" ? undefined : status,
        });
      };

      const activeFiltersCount = Object.values(filters).filter(Boolean).length;

      return (
        <Card key={multipleFilter.id} className="border-l-4 border-l-primary">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Input
                  value={multipleFilter.name}
                  onChange={(e) => updateFilterName(multipleFilter.id, e.target.value)}
                  className="h-8 w-40 font-medium"
                />
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary">
                    {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFilter(multipleFilter.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Mês Referência */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Mês Referência
                </Label>
                <Input
                  type="text"
                  placeholder="01/2024"
                  value={filters.mesReferencia || ''}
                  onChange={(e) => {
                    let value = e.target.value;
                    value = value.replace(/\D/g, '');
                    if (value.length >= 2) {
                      value = value.slice(0, 2) + '/' + value.slice(2, 6);
                    }
                    updateFilter(multipleFilter.id, { ...filters, mesReferencia: value });
                  }}
                  maxLength={7}
                />
              </div>

              {/* Data de Vencimento */}
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
                </div>
              )}

              {/* Data de Recebimento */}
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
                </div>
              )}

              {/* Método de Pagamento */}
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
                </div>
              )}

              {/* Sede */}
              {consultorColumn && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Sede
                  </Label>
                  <Select
                    value={filters.sede || "all"}
                    onValueChange={handleSedeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as sedes" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      <SelectItem value="all">Todas as sedes</SelectItem>
                      <SelectItem value="Maraponga">Maraponga</SelectItem>
                      <SelectItem value="Fátima">Fátima</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tipo */}
              {descricaoColumn && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Tipo
                  </Label>
                  <Select
                    value={filters.tipo || "all"}
                    onValueChange={handleTipoChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="Contrato/Serviço">Contrato/Serviço</SelectItem>
                      <SelectItem value="Produto">Produto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status */}
              {recebimentoColumn && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Status
                  </Label>
                  <Select
                    value={filters.status || "all"}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="Recebido">Recebido</SelectItem>
                      <SelectItem value="Em Aberto">Em Aberto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Filtros Ativos */}
            {activeFiltersCount > 0 && (
              <div className="pt-2 border-t">
                <div className="flex flex-wrap gap-2">
                  {filters.mesReferencia && (
                    <Badge variant="outline" className="text-xs">
                      Mês: {filters.mesReferencia}
                    </Badge>
                  )}
                  {filters.dataVencimento && (
                    <Badge variant="outline" className="text-xs">
                      Venc: {filters.dataVencimento.from?.toLocaleDateString('pt-BR')} - {filters.dataVencimento.to?.toLocaleDateString('pt-BR')}
                    </Badge>
                  )}
                  {filters.dataRecebimento && (
                    <Badge variant="outline" className="text-xs">
                      Receb: {filters.dataRecebimento.from?.toLocaleDateString('pt-BR')} - {filters.dataRecebimento.to?.toLocaleDateString('pt-BR')}
                    </Badge>
                  )}
                  {filters.metodoPagamento && (
                    <Badge variant="outline" className="text-xs">
                      Método: {filters.metodoPagamento}
                    </Badge>
                  )}
                  {filters.sede && (
                    <Badge variant="outline" className="text-xs">
                      Sede: {filters.sede}
                    </Badge>
                  )}
                  {filters.tipo && (
                    <Badge variant="outline" className="text-xs">
                      Tipo: {filters.tipo}
                    </Badge>
                  )}
                  {filters.status && (
                    <Badge variant="outline" className="text-xs">
                      Status: {filters.status}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      );
    };

    return (
      <Card ref={ref} className={className}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Combine className="h-5 w-5" />
              Filtros Combinados
              {multipleFilters.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {multipleFilters.length} filtro{multipleFilters.length > 1 ? 's' : ''} ({getTotalActiveFilters()} critério{getTotalActiveFilters() > 1 ? 's' : ''})
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={addNewFilter}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Filtro
              </Button>
              {multipleFilters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-8 px-2"
                >
                  <FilterX className="h-4 w-4 mr-1" />
                  Limpar Todos
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {multipleFilters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Combine className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Nenhum filtro criado</p>
              <p className="text-sm mb-4">
                Adicione filtros para combinar diferentes critérios de busca
              </p>
              <Button onClick={addNewFilter} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Filtro
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {multipleFilters.map((multipleFilter, index) => (
                  <div key={multipleFilter.id}>
                    {index > 0 && (
                      <div className="flex items-center gap-4 my-4">
                        <Separator className="flex-1" />
                        <Badge variant="outline" className="bg-muted">OU</Badge>
                        <Separator className="flex-1" />
                      </div>
                    )}
                    {renderFilterSection(multipleFilter)}
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  Os resultados incluirão registros que atendam a <strong>qualquer um</strong> dos filtros acima (operação OU).
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }
);

MultipleFilters.displayName = "MultipleFilters";

export type { MultipleFilter };