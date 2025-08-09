import React from 'react';
import { Search, Filter } from 'lucide-react';

// ✅ Tipo definido separadamente para evitar referência circular
interface Filters {
  codigo: string;
  material: string;
  periodo: string;
}

interface FilterBarProps {
  filters: Filters;
  onFilterChange: (filters: Partial<Filters>) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center mb-4">
        <Filter className="w-5 h-5 text-gray-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Filtro por Código */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Código do Material
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Ex: 300047935"
              value={filters.codigo}
              onChange={(e) => onFilterChange({ codigo: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>
        
        {/* Filtro por Material */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nome do Material
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Ex: TORCIDA QUEIJO"
              value={filters.material}
              onChange={(e) => onFilterChange({ material: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>
        
        {/* Filtro por Período */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Período
          </label>
          <input
            type="date"
            value={filters.periodo}
            onChange={(e) => onFilterChange({ periodo: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          />
        </div>
      </div>
    </div>
  );
};
