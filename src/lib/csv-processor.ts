import Papa from 'papaparse';

export interface CSVData {
  data: Record<string, any>[];
  errors: any[];
  meta: {
    fields?: string[];
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
  };
}

export interface ProcessingOptions {
  header?: boolean;
  skipEmptyLines?: boolean;
  delimiter?: string;
  encoding?: string;
}

export const processCSVFile = (
  file: File,
  options: ProcessingOptions = {}
): Promise<CSVData> => {
  return new Promise((resolve, reject) => {
    const defaultOptions: ProcessingOptions = {
      header: true,
      skipEmptyLines: true,
      delimiter: '',
      encoding: 'UTF-8',
      ...options,
    };

    Papa.parse(file, {
      ...defaultOptions,
      complete: (results) => {
        const processedData: CSVData = {
          data: results.data as Record<string, any>[],
          errors: results.errors,
          meta: results.meta,
        };

        // Filter out completely empty rows
        processedData.data = processedData.data.filter(row => {
          return Object.values(row).some(value => 
            value !== null && value !== undefined && String(value).trim() !== ''
          );
        });

        resolve(processedData);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

export const validateCSVData = (data: Record<string, any>[]): {
  isValid: boolean;
  issues: string[];
} => {
  const issues: string[] = [];

  if (!data || data.length === 0) {
    issues.push('O arquivo está vazio ou não possui dados válidos');
    return { isValid: false, issues };
  }

  // Check for consistent column structure
  const firstRowKeys = Object.keys(data[0]);
  const hasInconsistentColumns = data.some(row => {
    const rowKeys = Object.keys(row);
    return rowKeys.length !== firstRowKeys.length || 
           !firstRowKeys.every(key => rowKeys.includes(key));
  });

  if (hasInconsistentColumns) {
    issues.push('Estrutura inconsistente de colunas detectada');
  }

  // Check for empty headers
  const emptyHeaders = firstRowKeys.filter(key => !key || key.trim() === '');
  if (emptyHeaders.length > 0) {
    issues.push(`Encontradas ${emptyHeaders.length} colunas sem nome`);
  }

  // Check data density
  const totalCells = data.length * firstRowKeys.length;
  const emptyCells = data.reduce((count, row) => {
    return count + firstRowKeys.filter(key => {
      const value = row[key];
      return value === null || value === undefined || String(value).trim() === '';
    }).length;
  }, 0);

  const emptyPercentage = (emptyCells / totalCells) * 100;
  if (emptyPercentage > 50) {
    issues.push(`Alta porcentagem de células vazias: ${emptyPercentage.toFixed(1)}%`);
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
};

export const getDataSummary = (data: Record<string, any>[]): {
  totalRows: number;
  totalColumns: number;
  columns: Array<{
    name: string;
    type: 'text' | 'number' | 'date' | 'boolean';
    emptyCount: number;
    uniqueCount: number;
    sample: any[];
  }>;
} => {
  if (!data || data.length === 0) {
    return {
      totalRows: 0,
      totalColumns: 0,
      columns: [],
    };
  }

  const columns = Object.keys(data[0]).map(columnName => {
    const values = data.map(row => row[columnName]).filter(val => 
      val !== null && val !== undefined && String(val).trim() !== ''
    );
    
    const emptyCount = data.length - values.length;
    const uniqueValues = Array.from(new Set(values));
    const sample = uniqueValues.slice(0, 5);

    // Determine column type
    let type: 'text' | 'number' | 'date' | 'boolean' = 'text';
    
    if (values.length > 0) {
      const isNumber = values.every(val => !isNaN(Number(val)) && val !== '');
      const isBoolean = values.every(val => 
        ['true', 'false', '1', '0', 'sim', 'não', 'yes', 'no'].includes(String(val).toLowerCase())
      );
      const isDate = values.some(val => !isNaN(Date.parse(val))) && 
                     values.every(val => {
                       const date = new Date(val);
                       return !isNaN(date.getTime()) && String(val).length > 4;
                     });

      if (isBoolean) type = 'boolean';
      else if (isNumber) type = 'number';
      else if (isDate) type = 'date';
    }

    return {
      name: columnName,
      type,
      emptyCount,
      uniqueCount: uniqueValues.length,
      sample,
    };
  });

  return {
    totalRows: data.length,
    totalColumns: columns.length,
    columns,
  };
};