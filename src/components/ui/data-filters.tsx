import * as React from "react";
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Filter, FilterX, Calendar, CreditCard } from "lucide-react";

export interface FilterState {
  dataVencimento?: DateRange;
  dataRecebimento?: DateRange;
  metodoPagamento?: string;
  sede?: string;
  tipo?: string;
  status?: string;
  mesReferencia?: string; // Formato MM/AAAA
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

    const handleSedeChange = (sede: string) => {
      onFiltersChange({
        ...filters,
        sede: sede === "all" ? undefined : sede,
      });
    };

    const handleTipoChange = (tipo: string) => {
      onFiltersChange({
        ...filters,
        tipo: tipo === "all" ? undefined : tipo,
      });
    };

    const handleStatusChange = (status: string) => {
      onFiltersChange({
        ...filters,
        status: status === "all" ? undefined : status,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                  // Formatar entrada para MM/AAAA
                  value = value.replace(/\D/g, ''); // Remove não-dígitos
                  if (value.length >= 2) {
                    value = value.slice(0, 2) + '/' + value.slice(2, 6);
                  }
                  onFiltersChange({ ...filters, mesReferencia: value });
                }}
                maxLength={7}
              />
              <p className="text-xs text-muted-foreground">
                Formato: MM/AAAA (ex: 01/2024)
              </p>
            </div>

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

            {/* Sede Filter */}
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
                <p className="text-xs text-muted-foreground">
                  Baseado na coluna: {consultorColumn}
                </p>
              </div>
            )}

            {/* Tipo Filter */}
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
                    <SelectItem value="Sala Interativa">Sala Interativa</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Baseado na coluna: {descricaoColumn}
                </p>
              </div>
            )}

            {/* Status Filter */}
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
                <p className="text-xs text-muted-foreground">
                  Baseado na coluna: {recebimentoColumn}
                </p>
              </div>
            )}
          </div>

          {/* Active Filters Summary */}
          {activeFiltersCount > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Filtros ativos:</p>
              <div className="flex flex-wrap gap-2">
                {filters.mesReferencia && (
                  <Badge variant="outline" className="text-xs">
                    Mês Referência: {filters.mesReferencia}
                  </Badge>
                )}
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
  }
);

DataFilters.displayName = "DataFilters";