import { FilterState } from "@/components/ui/data-filters";
import { MultipleFilter } from "@/components/ui/multiple-filters";
import { parse, isWithinInterval, isValid, startOfDay, endOfDay, isSameDay, isAfter, isBefore } from "date-fns";

// Função para combinar múltiplos filtros (operação OU)
export const applyCombinedFilters = (
  data: Record<string, any>[],
  multipleFilters: MultipleFilter[]
): Record<string, any>[] => {
  if (!multipleFilters.length) return data;
  
  // Aplicar cada filtro separadamente e combinar resultados
  const combinedResults = new Set<Record<string, any>>();
  
  multipleFilters.forEach(multipleFilter => {
    const filteredData = applyFilters(data, multipleFilter.filters);
    filteredData.forEach(item => combinedResults.add(item));
  });
  
  return Array.from(combinedResults);
};

// Função para obter resumo dos filtros combinados
export const getCombinedFilterSummary = (
  originalData: Record<string, any>[],
  filteredData: Record<string, any>[],
  multipleFilters: MultipleFilter[]
): {
  total: number;
  filtered: number;
  filtersCount: number;
  totalCriteria: number;
  filterNames: string[];
} => {
  const totalCriteria = multipleFilters.reduce((total, mf) => {
    return total + Object.values(mf.filters).filter(Boolean).length;
  }, 0);

  return {
    total: originalData.length,
    filtered: filteredData.length,
    filtersCount: multipleFilters.length,
    totalCriteria,
    filterNames: multipleFilters.map(mf => mf.name),
  };
};

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

  // Apply Data de Vencimento filter
  if (filters.dataVencimento && vencimentoColumn) {
    const { from, to } = filters.dataVencimento;
    if (from && to) {
      filteredData = filteredData.filter(row => {
        const dateValue = row[vencimentoColumn];
        if (!dateValue) return false;
        
        const parsedDate = parseFlexibleDate(dateValue);
        if (!parsedDate || !isValid(parsedDate)) return false;
        
        // Normalize all dates to start of day for accurate comparison
        const normalizedParsedDate = startOfDay(parsedDate);
        const normalizedFrom = startOfDay(from);
        const normalizedTo = endOfDay(to);
        
        // Check if date is within range (inclusive)
        return (isSameDay(normalizedParsedDate, normalizedFrom) || isAfter(normalizedParsedDate, normalizedFrom)) &&
               (isSameDay(normalizedParsedDate, normalizedTo) || isBefore(normalizedParsedDate, normalizedTo));
      });
    }
  }

  // Apply Data de Recebimento filter - inclui recebidos no período + em aberto
  if (filters.dataRecebimento && recebimentoColumn) {
    const { from, to } = filters.dataRecebimento;
    if (from && to) {
      filteredData = filteredData.filter(row => {
        const dateValue = row[recebimentoColumn];
        
        // Se não tem data de recebimento (em aberto), inclui no resultado
        if (!dateValue || String(dateValue).trim() === '') return true;
        
        const parsedDate = parseFlexibleDate(dateValue);
        if (!parsedDate || !isValid(parsedDate)) return true; // Considera como em aberto se não conseguir parsear
        
        // Normalize all dates to start of day for accurate comparison
        const normalizedParsedDate = startOfDay(parsedDate);
        const normalizedFrom = startOfDay(from);
        const normalizedTo = endOfDay(to);
        
        // Check if date is within range (inclusive)
        return (isSameDay(normalizedParsedDate, normalizedFrom) || isAfter(normalizedParsedDate, normalizedFrom)) &&
               (isSameDay(normalizedParsedDate, normalizedTo) || isBefore(normalizedParsedDate, normalizedTo));
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

  // Apply Sede filter
  if (filters.sede && consultorColumn) {
    filteredData = filteredData.filter(row => {
      const consultorValue = row[consultorColumn];
      if (!consultorValue) return false;
      
      const consultor = String(consultorValue).trim();
      
      if (filters.sede === 'Maraponga') {
        return consultor === 'Thais Lima';
      } else if (filters.sede === 'Fátima') {
        return consultor === 'Taiana Lima';
      }
      
      return false;
    });
  }

  // Apply Tipo filter
  if (filters.tipo && descricaoColumn) {
    filteredData = filteredData.filter(row => {
      const descricaoValue = row[descricaoColumn];
      if (!descricaoValue) return false;
      
      const descricao = String(descricaoValue).toLowerCase();
      
      if (filters.tipo === 'Contrato/Serviço') {
        return descricao.includes('plano');
      } else if (filters.tipo === 'Produto') {
        return descricao.includes('camisa') || descricao.includes('regata');
      }
      
      return false;
    });
  }

  // Apply Status filter
  if (filters.status && recebimentoColumn) {
    filteredData = filteredData.filter(row => {
      const recebimentoValue = row[recebimentoColumn];
      
      if (filters.status === 'Recebido') {
        return recebimentoValue && String(recebimentoValue).trim() !== '';
      } else if (filters.status === 'Em Aberto') {
        return !recebimentoValue || String(recebimentoValue).trim() === '';
      }
      
      return false;
    });
  }

  return filteredData;
};

const parseFlexibleDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  
  const dateStr = String(dateValue).trim();
  if (!dateStr) return null;

  // Try different date formats - most common Brazilian formats first
  const formats = [
    'dd/MM/yyyy',
    'dd/MM/yy',
    'dd-MM-yyyy',
    'dd-MM-yy',
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'yyyy/MM/dd',
    'd/M/yyyy',
    'd/M/yy',
    'd-M-yyyy',
    'd-M-yy',
  ];

  // Try specific formats first (more reliable than native parsing)
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

  // As last resort, try native Date parsing
  try {
    const nativeDate = new Date(dateStr);
    if (isValid(nativeDate) && !isNaN(nativeDate.getTime())) {
      return nativeDate;
    }
  } catch (error) {
    // Ignore
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
  if (filters.sede) {
    activeFilters.push('Sede');
  }
  if (filters.tipo) {
    activeFilters.push('Tipo');
  }
  if (filters.status) {
    activeFilters.push('Status');
  }

  return {
    total: originalData.length,
    filtered: filteredData.length,
    filtersApplied: activeFilters.length,
    activeFilters,
  };
};