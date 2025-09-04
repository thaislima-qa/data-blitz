import * as React from "react";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Upload, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  className?: string;
  disabled?: boolean;
  selectedFile?: File | null;
  onClearFile?: () => void;
}

export const FileUpload = React.forwardRef<HTMLDivElement, FileUploadProps>(
  ({ onFileSelect, accept = ".csv", className, disabled, selectedFile, onClearFile }, ref) => {
    const [isDragOver, setIsDragOver] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragOver(true);
      }
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      
      if (disabled) return;
      
      const files = Array.from(e.dataTransfer.files);
      const csvFile = files.find(file => file.name.toLowerCase().endsWith('.csv'));
      
      if (csvFile) {
        onFileSelect(csvFile);
        // Reset input para permitir seleção do mesmo arquivo novamente
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }
    }, [onFileSelect, disabled]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
        // Reset input para permitir seleção do mesmo arquivo novamente
        e.target.value = '';
      }
    }, [onFileSelect]);

    const handleClick = useCallback(() => {
      if (!disabled) {
        inputRef.current?.click();
      }
    }, [disabled]);

    if (selectedFile) {
      return (
        <div className={cn(
          "flex items-center justify-between p-4 border border-border rounded-lg bg-card",
          className
        )}>
          <div className="flex items-center gap-3">
            <File className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium text-card-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          {onClearFile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFile}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer",
          isDragOver
            ? "border-primary bg-primary/5 shadow-lg scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-accent/50",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled}
        />
        
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "p-4 rounded-full transition-colors",
            isDragOver
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-accent-foreground"
          )}>
            <Upload className="h-8 w-8" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {isDragOver ? "Solte o arquivo aqui" : "Envie seu arquivo CSV"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Arraste e solte ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground">
              Apenas arquivos .csv são aceitos
            </p>
          </div>
        </div>
      </div>
    );
  }
);

FileUpload.displayName = "FileUpload";