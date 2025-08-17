import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

interface ModernFileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  title: string;
  description: string;
  className?: string;
  isLoading?: boolean;
  success?: boolean;
  error?: string;
}

export const ModernFileUpload: React.FC<ModernFileUploadProps> = ({
  onFileSelect,
  accept = '.xlsx,.xls',
  title,
  description,
  className = '',
  isLoading = false,
  success = false,
  error
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleClick = () => {
    if (!isLoading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && !isLoading) {
      onFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && !isLoading) {
      onFileSelect(files[0]);
    }
  };

  const getStatusColor = () => {
    if (error) return 'border-red-300 bg-red-50';
    if (success) return 'border-green-300 bg-green-50';
    if (isDragOver) return 'border-blue-400 bg-blue-50';
    return 'border-gray-300 bg-white hover:bg-gray-50';
  };

  const getStatusIcon = () => {
    if (error) return <AlertCircle className="w-8 h-8 text-red-500" />;
    if (success) return <CheckCircle className="w-8 h-8 text-green-500" />;
    return <FileSpreadsheet className="w-8 h-8 text-blue-500" />;
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={isLoading}
      />
      
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl p-4 sm:p-8 cursor-pointer transition-all duration-300
          ${getStatusColor()}
          ${isLoading ? 'cursor-not-allowed opacity-60' : 'hover:shadow-lg transform hover:-translate-y-0.5 sm:hover:-translate-y-1'}
        `}
      >
        <div className="flex flex-col items-center justify-center text-center space-y-3 sm:space-y-4">
          <div className="relative">
            {getStatusIcon()}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-full">
                <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">{title}</h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4 px-2">{description}</p>
            
            {error ? (
              <p className="text-xs sm:text-sm text-red-600 font-medium px-2">{error}</p>
            ) : success ? (
              <p className="text-xs sm:text-sm text-green-600 font-medium">Arquivo carregado com sucesso!</p>
            ) : (
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <Upload className="w-4 h-4" />
                <span className="text-xs sm:text-sm font-medium">
                  {isLoading ? 'Processando...' : 'Clique ou arraste o arquivo aqui'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};