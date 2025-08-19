import { FilterState } from "@/components/ui/data-filters";
import { parse, isWithinInterval, isValid } from "date-fns";

export const applyFilters = (
  data: Record<string, any>[],
  filters: FilterState
): Record<string, any>[] => {
  if (!data.length) return data;

  let filteredData = [...data];
  const columns = Object.keys(data[0]);

  // Detect column names
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

  // Apply Data de Vencimento filter
  if (filters.dataVencimento && vencimentoColumn) {
    const { from, to } = filters.dataVencimento;
    if (from && to) {
      filteredData = filteredData.filter(row => {
        const dateValue = row[vencimentoColumn];
        if (!dateValue) return false;
        
        const parsedDate = parseFlexibleDate(dateValue);
        if (!parsedDate || !isValid(parsedDate)) return false;
        
        return isWithinInterval(parsedDate, { start: from, end: to });
      });
    }
  }

  // Apply Data de Recebimento filter
  if (filters.dataRecebimento && recebimentoColumn) {
    const { from, to } = filters.dataRecebimento;
    if (from && to) {
      filteredData = filteredData.filter(row => {
        const dateValue = row[recebimentoColumn];
        if (!dateValue) return false;
        
        const parsedDate = parseFlexibleDate(dateValue);
        if (!parsedDate || !isValid(parsedDate)) return false;
        
        return isWithinInterval(parsedDate, { start: from, end: to });
      });
    }
  }

  // Apply Método de Pagamento filter
  if (filters.metodoPagamento && metodoPagamentoColumn) {
    filteredData = filteredData.filter(row => {
      const methodValue = row[metodoPagamentoColumn];
      if (!methodValue) return false;
      
      return String(methodValue).trim() === filters.metodoPagamento;
    });
  }

  return filteredData;
};

const parseFlexibleDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  
  const dateStr = String(dateValue).trim();
  if (!dateStr) return null;

  // Try different date formats
  const formats = [
    'dd/MM/yyyy',
    'dd-MM-yyyy',
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'dd/MM/yy',
    'dd-MM-yy',
    'yyyy/MM/dd',
  ];

  // First try native Date parsing
  const nativeDate = new Date(dateStr);
  if (isValid(nativeDate)) {
    return nativeDate;
  }

  // Try specific formats
  for (const format of formats) {
    try {
      const parsedDate = parse(dateStr, format, new Date());
      if (isValid(parsedDate)) {
        return parsedDate;
      }
    } catch (error) {
      // Continue to next format
    }
  }

  return null;
};

export const getFilterSummary = (
  originalData: Record<string, any>[],
  filteredData: Record<string, any>[],
  filters: FilterState
): {
  total: number;
  filtered: number;
  filtersApplied: number;
  activeFilters: string[];
} => {
  const activeFilters: string[] = [];
  
  if (filters.dataVencimento) {
    activeFilters.push('Data de Vencimento');
  }
  if (filters.dataRecebimento) {
    activeFilters.push('Data de Recebimento');
  }
  if (filters.metodoPagamento) {
    activeFilters.push('Método de Pagamento');
  }

  return {
    total: originalData.length,
    filtered: filteredData.length,
    filtersApplied: activeFilters.length,
    activeFilters,
  };
};