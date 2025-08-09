import React, { useRef } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  title: string;
  description: string;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = '.xlsx,.xls',
  title,
  description,
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div
        onClick={handleClick}
        className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors duration-200 rounded-lg p-6 cursor-pointer bg-gray-50 hover:bg-blue-50 group"
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-blue-100 group-hover:bg-blue-200 transition-colors duration-200">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
          </div>
          
          <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-4">{description}</p>
          
          <div className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors duration-200">
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">Clique para selecionar arquivo</span>
          </div>
        </div>
      </div>
    </div>
  );
};