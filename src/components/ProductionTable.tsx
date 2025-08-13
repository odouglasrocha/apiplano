import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Package, Zap, Droplets } from 'lucide-react';
import { EnrichedPlanItem } from '../types/production';

interface ProductionTableProps {
  data: EnrichedPlanItem[];
}

export const ProductionTable: React.FC<ProductionTableProps> = ({ data }) => {
  const [sortField, setSortField] = useState<keyof EnrichedPlanItem | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  const handleSort = (field: keyof EnrichedPlanItem) => {
    setSortField(prev => (prev === field ? prev : field));
    setSortDirection(prev =>
      sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'
    );
  };

  const sortedData = useMemo(() => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (aValue === undefined || aValue === null)
        aValue = typeof aValue === 'number' ? 0 : '';
      if (bValue === undefined || bValue === null)
        bValue = typeof bValue === 'number' ? 0 : '';

      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  const SortHeader = ({
    field,
    children,
  }: {
    field: keyof EnrichedPlanItem;
    children: React.ReactNode;
  }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field &&
          (sortDirection === 'asc' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          ))}
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
      {/* Cabeçalho */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center">
        <Package className="w-5 h-5 mr-2" />
        <h3 className="text-lg font-semibold text-gray-800">
          Plano de Produção
        </h3>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader field="CodMaterialProducao">Código</SortHeader>
              <SortHeader field="MaterialProducao">Material</SortHeader>
              <SortHeader field="PlanoCaixasFardos">Plano Caixas/Fardos</SortHeader>
              <SortHeader field="Tons">Toneladas</SortHeader>
              <SortHeader field="BolsasProduzido">Produzido</SortHeader>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                KPIs
              </th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Progresso
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map(item => (
              <tr
                key={item.CodMaterialProducao}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                  {item.CodMaterialProducao}
                </td>

                <td className="px-6 py-4 text-sm">
                  <div className="font-medium">{item.MaterialProducao}</div>
                  {item.material && (
                    <div className="text-xs text-gray-500">
                      {item.material.Gramagem}g | {item.material.Und} und/cx
                    </div>
                  )}
                </td>

                <td className="px-6 py-4 text-sm font-medium">
                  {item.PlanoCaixasFardos.toLocaleString('pt-BR')}
                </td>

                <td className="px-6 py-4 text-sm">
                  {item.Tons.toLocaleString('pt-BR')} T
                </td>

                <td className="px-6 py-4 text-sm">
                  {item.BolsasProduzido ? (
                    <span className="font-medium text-green-600">
                      {item.BolsasProduzido.toLocaleString('pt-BR')}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                <td className="px-6 py-4 text-xs text-gray-500">
                  {item.material && (
                    <>
                      <div className="flex items-center space-x-1">
                        <Zap className="w-3 h-3 text-blue-500" />
                        <span>
                          Prod: {item.produtividadeEsperada?.toFixed(2)} cx/min
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Droplets className="w-3 h-3 text-green-500" />
                        <span>
                          MP: {item.consumoMateriaPrima?.toFixed(2)} kg
                        </span>
                      </div>
                    </>
                  )}
                </td>

                <td className="px-6 py-4 text-sm">
                  {item.progressoProducao && item.progressoProducao > 0 ? (
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(
                            item.progressoProducao
                          )}`}
                          style={{
                            width: `${Math.min(
                              item.progressoProducao,
                              100
                            )}%`,
                          }}
                        />
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

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Mostrando {startIndex + 1} a{' '}
            {Math.min(startIndex + itemsPerPage, sortedData.length)} de{' '}
            {sortedData.length}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-sm">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
