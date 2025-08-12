import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Package, Zap, Droplets, TrendingUp } from 'lucide-react';
import { EnrichedPlanItem } from '../types/production';

interface ProductionTableProps {
  data: EnrichedPlanItem[];
}

export const ProductionTable: React.FC<ProductionTableProps> = ({ data }) => {
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
  if (!sortField) return 0;

  let aValue = a[sortField as keyof EnrichedPlanItem];
  let bValue = b[sortField as keyof EnrichedPlanItem];

  // Define padrão para evitar undefined
  if (aValue === undefined || aValue === null) aValue = typeof aValue === 'number' ? 0 : '';
  if (bValue === undefined || bValue === null) bValue = typeof bValue === 'number' ? 0 : '';

  if (typeof aValue === 'string') aValue = aValue.toLowerCase();
  if (typeof bValue === 'string') bValue = bValue.toLowerCase();

  if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
  if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
  return 0;
});


  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          sortDirection === 'asc' ? 
            <ChevronUp className="w-4 h-4" /> : 
            <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </th>
  );

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Package className="w-5 h-5 mr-2" />
          Plano de Produção
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader field="CodMaterialProducao">Código</SortHeader>
              <SortHeader field="MaterialProducao">Material</SortHeader>
              <SortHeader field="PlanoCaixasFardos">Plano Caixas/Fardos</SortHeader>
              <SortHeader field="Tons">Toneladas</SortHeader>
              <SortHeader field="BolsasProduzido">Produzido</SortHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                KPIs
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progresso
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((item, index) => (
              <tr key={item.CodMaterialProducao} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                  {item.CodMaterialProducao}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="font-medium">{item.MaterialProducao}</div>
                  {item.material && (
                    <div className="text-xs text-gray-500">
                      {item.material.Gramagem}g | {item.material.Und} und/cx
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                  {item.PlanoCaixasFardos.toLocaleString('pt-BR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.Tons.toLocaleString('pt-BR')} T
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.BolsasProduzido ? (
                    <span className="font-medium text-green-600">
                      {item.BolsasProduzido.toLocaleString('pt-BR')}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {item.material && (
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1">
                        <Zap className="w-3 h-3 text-blue-500" />
                        <span className="text-xs">Prod: {item.produtividadeEsperada?.toFixed(2)} cx/min</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Droplets className="w-3 h-3 text-green-500" />
                        <span className="text-xs">MP: {item.consumoMateriaPrima?.toFixed(2)} kg</span>
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.progressoProducao !== undefined && item.progressoProducao > 0 ? (
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(item.progressoProducao)}`}
                          style={{ width: `${Math.min(item.progressoProducao, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium w-12 text-right">
                        {item.progressoProducao.toFixed(1)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, sortedData.length)} de {sortedData.length} resultados
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-sm text-gray-700">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
};