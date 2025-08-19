import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DataTableProps {
  data: Record<string, any>[];
  className?: string;
  maxRows?: number;
}

export const DataTable = React.forwardRef<HTMLDivElement, DataTableProps>(
  ({ data, className, maxRows = 100 }, ref) => {
    if (!data.length) {
      return (
        <Card className={cn("w-full", className)}>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Nenhum dado disponível</p>
          </CardContent>
        </Card>
      );
    }

    const columns = Object.keys(data[0]);
    const displayData = data.slice(0, maxRows);
    const hasMoreRows = data.length > maxRows;

    return (
      <Card ref={ref} className={cn("w-full", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Preview dos Dados
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                {displayData.length} {hasMoreRows && `de ${data.length}`} linhas
              </Badge>
              <Badge variant="outline" className="text-sm">
                {columns.length} colunas
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] w-full">
            <div className="min-w-full overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    {columns.map((column, index) => (
                      <TableHead
                        key={index}
                        className="font-semibold text-foreground bg-muted/50 border-b-2 border-border"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="truncate max-w-[120px]">{column}</span>
                          <Badge variant="outline" className="text-xs w-fit">
                            {getColumnType(data, column)}
                          </Badge>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                
                <TableBody>
                  {displayData.map((row, rowIndex) => (
                    <TableRow
                      key={rowIndex}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      {columns.map((column, colIndex) => (
                        <TableCell
                          key={colIndex}
                          className="max-w-[200px] truncate text-sm"
                          title={String(row[column])}
                        >
                          {formatCellValue(row[column])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
          
          {hasMoreRows && (
            <div className="p-4 border-t bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground">
                Mostrando primeiras {maxRows} linhas de {data.length} total
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

DataTable.displayName = "DataTable";

function getColumnType(data: Record<string, any>[], column: string): string {
  const sample = data.slice(0, 10).map(row => row[column]).filter(val => val !== null && val !== undefined && val !== '');
  
  if (sample.length === 0) return "text";
  
  const isNumber = sample.every(val => !isNaN(Number(val)) && val !== '');
  const isDate = sample.every(val => !isNaN(Date.parse(val)));
  
  if (isNumber) return "number";
  if (isDate) return "date";
  return "text";
}

function formatCellValue(value: any): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return value.toLocaleString('pt-BR');
  return String(value);
}