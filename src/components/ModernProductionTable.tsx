import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Package, Zap, Droplets, TrendingUp, Search, Filter, MoreVertical, Building2 } from 'lucide-react';
import { EnrichedPlanItem } from '../types/production';
import { materialsData } from '../data/materials';
import logoMotor from '../public/logo-motor.png';


interface ModernProductionTableProps {
  data: EnrichedPlanItem[];
}

export const ModernProductionTable: React.FC<ModernProductionTableProps> = ({ data }) => {
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 8;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredData = data.filter(item => 
    item.MaterialProducao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.CodMaterialProducao.toString().includes(searchTerm)
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortField) return 0;
    
    let aValue = a[sortField as keyof EnrichedPlanItem];
    let bValue = b[sortField as keyof EnrichedPlanItem];
    
    if (typeof aValue === 'string') aValue = aValue.toLowerCase();
    if (typeof bValue === 'string') bValue = bValue.toLowerCase();
    
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded-lg"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-2">
        <span>{children}</span>
        {sortField === field && (
          <div className="flex flex-col">
            {sortDirection === 'asc' ? 
              <ChevronUp className="w-4 h-4 text-blue-500" /> : 
              <ChevronDown className="w-4 h-4 text-blue-500" />
            }
          </div>
        )}
      </div>
    </th>
  );

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'from-green-400 to-green-500';
    if (progress >= 50) return 'from-yellow-400 to-yellow-500';
    return 'from-red-400 to-red-500';
  };

  const getProgressBg = (progress: number) => {
    if (progress >= 80) return 'bg-green-100';
    if (progress >= 50) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <img src={logoMotor} alt="Logo Motor" className="w-40 h-20" />
             
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-gray-800">Plano de Produção</h3>
              <p className="text-sm text-gray-600">{data.length} itens no plano</p>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader field="CodMaterialProducao">Código</SortHeader>
              <SortHeader field="MaterialProducao">Material</SortHeader>
              <SortHeader field="PlanoCaixasFardos">Plano de produção</SortHeader>
              <SortHeader field="Tons">Toneladas</SortHeader>
              <SortHeader field="BolsasProduzido">A Produzir</SortHeader>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                KPIs
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Progresso
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tempo Est.
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.map((item) => {
              const materialRef = materialsData.find(m => m.Codigo === item.CodMaterialProducao.toString());
              
              return (
                <tr key={item._id || item.CodMaterialProducao} className="hover:bg-gray-50 transition-colors duration-200 group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-2 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full mr-3"></div>
                      <span className="text-sm font-mono font-medium text-gray-900">{item.CodMaterialProducao}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                   <div>
                      <div className="text-sm font-semibold text-gray-900 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                        {item.MaterialProducao}
                      </div>
                      {materialRef && (
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded-full">{materialRef.Gramagem}g</span>
                          <span className="bg-gray-100 px-2 py-1 rounded-full">{materialRef.Und} und/cx</span>
                        </div>
                      )}
                    </div>
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                    <div className="text-blue-700 font-bold text-lg">
                      {(() => {
                        const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));

                        if (!materialRef || !materialRef.Caixas) {
                          return <span className="text-xs text-gray-400">0</span>;
                        }

                        // Cálculo arredondado para inteiro
                        const resultado = item.PlanoCaixasFardos / materialRef.Caixas;
                        const arredondado = Math.round(resultado);

                        return arredondado.toLocaleString('pt-BR');
                      })()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(() => {
                        const materialName = item.MaterialProducao.toUpperCase();
                        if (materialName.includes('TORCIDA')) {
                          return 'Pallets';
                        } else if (materialName.includes('FOFURA')) {
                          return 'Gaiolas';
                        }
                        return 'Pallets/Gaiolas';
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {item.Tons.toLocaleString('pt-BR', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })} t
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                    {(() => {
                      const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));

                      if (
                        materialRef &&
                        materialRef.Caixas &&
                        materialRef.Und &&
                        item.PlanoCaixasFardos !== undefined &&
                        item.BolsasProduzido !== undefined
                      ) {
                        const valor1 = item.PlanoCaixasFardos / materialRef.Caixas;
                        const valor2 = item.BolsasProduzido / (materialRef.Und * materialRef.Caixas);

                        const diferenca = Math.round(valor1) - Math.round(valor2);

                        return (
                          <div className="text-green-600 font-bold text-xl">
                            {diferenca.toLocaleString('pt-BR')}
                          </div>
                        );
                      }

                      return <span className="text-xs text-gray-400">0</span>;
                    })()}
                    <div className="text-xs text-gray-500 mt-1">
                      {(() => {
                        const materialName = item.MaterialProducao.toUpperCase();
                        if (materialName.includes('TORCIDA')) {
                          return 'Pallets';
                        } else if (materialName.includes('FOFURA')) {
                          return 'Gaiolas';
                        }
                        return 'Pallets/Gaiolas';
                      })()}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    {materialRef && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <div className="p-1 bg-blue-100 rounded">
                            <Zap className="w-3 h-3 text-blue-600" />
                          </div>
                          <span className="text-xs text-gray-600">
                           {(() => {
                              const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));

                              if (!materialRef || !materialRef.Caixas || !materialRef.Und || !item.PlanoCaixasFardos) {
                                return <span className="text-xs text-gray-400">0,000 und</span>;
                              }

                              // Etapas separadas para clareza
                              const pallets = item.PlanoCaixasFardos / materialRef.Caixas;
                              const totalUnidades = Math.round(pallets) * materialRef.Caixas * materialRef.Und;

                              return (
                                <div className="text-xs text-gray-600">
                                  {totalUnidades.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                    useGrouping: false
                                  })} und
                                </div>
                              );
                            })()}                        
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="p-1 bg-green-100 rounded">
                            <Droplets className="w-3 h-3 text-green-600" />
                          </div>
                          <span className="text-xs text-gray-600">
                          {(() => {
                                const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));

                                if (
                                  materialRef &&
                                  materialRef.Caixas &&
                                  materialRef.Und &&
                                  materialRef.Gramagem &&
                                  item.BolsasProduzido !== undefined
                                ) {
                                  // Consumo de matéria-prima em kg com base em BolsasProduzido
                                  const gramagem = parseFloat(materialRef.Gramagem.toString().replace(',', '.'));
                                  const consumoKg = (item.BolsasProduzido * gramagem) / 1000; // divide por 1000 para converter g → kg

                                  return (
                                    <div className="text-xs text-gray-600">
                                      {consumoKg.toLocaleString('pt-BR', {
                                        minimumFractionDigits: 3,
                                        maximumFractionDigits: 3,
                                        useGrouping: false
                                      })} t
                                    </div>
                                  );
                                }
                                return <span className="text-xs text-gray-400">0,000 kg</span>;
                              })()}                               
                          </span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                 {(() => {
                      const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));

                      if (
                        materialRef &&
                        materialRef.Caixas &&
                        materialRef.Und &&
                        item.PlanoCaixasFardos !== undefined &&
                        item.BolsasProduzido !== undefined
                      ) {
                        // Coluna PRODUZIDO
                        const produzido = Math.max(
                          Math.round(item.PlanoCaixasFardos / materialRef.Caixas) -
                          Math.round(item.BolsasProduzido / (materialRef.Und * materialRef.Caixas)),
                          0
                        );

                        // Coluna PLANO CAIXAS
                        const planoCaixas = Math.max(Math.round(item.PlanoCaixasFardos / materialRef.Caixas), 1); // evita divisão por 0

                        // Progresso invertido (%)
                        const progresso = Math.max(0, 100 - (produzido / planoCaixas) * 100);

                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">
                                {progresso.toFixed(1)}%
                              </span>
                            </div>
                            <div className={`w-full h-2 rounded-full ${getProgressBg(progresso)}`}>
                              <div
                                className={`h-2 rounded-full bg-gradient-to-r ${getProgressColor(progresso)} transition-all duration-500`}
                                style={{ width: `${Math.min(progresso, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="text-center">
                          <div className="w-full h-2 bg-gray-200 rounded-full">
                            <div className="h-2 bg-gray-300 rounded-full" style={{ width: '0%' }}></div>
                          </div>
                          <span className="text-xs text-gray-400 mt-1">0%</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      if (!materialRef || !materialRef.PPm) {
                        return <span className="text-xs text-gray-400">N/A</span>;
                      }

                      const produzido = item.BolsasProduzido || 0;
                      const planoTotal = item.PlanoCaixasFardos * materialRef.Und;
                      const restante = planoTotal - produzido;

                      if (restante <= 0) {
                        return (
                          <span className="text-xs text-green-600 font-semibold">
                            Concluído
                          </span>
                        );
                      }

                      // Tempo total para produção completa com 1 máquina
                      const tempoMinTotalUmaMaquina = planoTotal / materialRef.PPm;
                      const horasTotalUmaMaquina = tempoMinTotalUmaMaquina / 60;

                      // Limites
                      const limiteHoras = 22;
                      const limiteMaquinas = 24;

                      // Máquinas necessárias baseadas no total, e fixadas
                      const maquinasIdeais = Math.ceil(horasTotalUmaMaquina / limiteHoras);
                      const maquinasFixas = Math.min(maquinasIdeais, limiteMaquinas);

                      // Tempo restante com as máquinas fixas
                      const tempoRestanteMin = restante / materialRef.PPm / maquinasFixas;
                      const horasRestantes = Math.floor(tempoRestanteMin / 60);
                      const minutosRestantes = Math.floor(tempoRestanteMin % 60);
                      const tempoFormatado = `${horasRestantes.toString().padStart(2, '0')}:${minutosRestantes.toString().padStart(2, '0')}`;

                      const excedeCapacidade = maquinasIdeais > limiteMaquinas;

                      return (
                        <div className="text-center">
                          <span
                            className={`text-xs font-semibold block ${
                              excedeCapacidade ? 'text-red-600' : 'text-gray-700'
                            }`}
                          >
                            {tempoFormatado}
                          </span>
                          <span
                            className={`text-xs ${
                              excedeCapacidade ? 'text-red-500' : 'text-gray-500'
                            }`}
                          >
                            {maquinasFixas} EA{maquinasFixas > 1 ? 'S' : ''}
                          </span>
                          {excedeCapacidade && (
                            <span className="text-xs text-red-500 block mt-1">
                              ⚠️ Capacidade excedida
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Empty State */}
      {paginatedData.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum item encontrado</h3>
          <p className="text-gray-500">
            {searchTerm ? 'Tente ajustar os filtros de busca' : 'Carregue um arquivo Excel para visualizar os dados'}
          </p>
        </div>
      )}
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando <span className="font-semibold">{startIndex + 1}</span> a{' '}
            <span className="font-semibold">{Math.min(startIndex + itemsPerPage, sortedData.length)}</span> de{' '}
            <span className="font-semibold">{sortedData.length}</span> resultados
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Anterior
            </button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      currentPage === page
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="bg-gray-50 px-8 py-3 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          © 2025 Orlando Douglas Rocha - orlando.rocha@pepsico.com | Sistema de Planejamento de Produção
        </div>
      </div>
    </div>
  );
};