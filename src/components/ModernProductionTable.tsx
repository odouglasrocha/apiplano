import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Package, Zap, Droplets, Search } from 'lucide-react';
import { EnrichedPlanItem } from '../types/production';
import { materialsData } from '../data/materials';
import logoMotor from '../public/logo-motor.png';
import { IntermediaryStockModal } from './IntermediaryStockModal';
import { EmailReportModal } from './EmailReportModal';


interface ModernProductionTableProps {
  data: EnrichedPlanItem[];
}

export const ModernProductionTable: React.FC<ModernProductionTableProps> = ({ data }) => {
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 8;
  const [showIntermediaryModal, setShowIntermediaryModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [aromaDifferences, setAromaDifferences] = useState<Record<string, number>>({});

  // Utilidades compartilhadas com o modal
  const parseNumber = (value: string | number | undefined): number => {
    if (value === undefined) return 0;
    if (typeof value === 'number') return value;
    const raw = String(value).trim();
    if (raw.includes(',') && !raw.includes('.')) {
      const normalized = raw.replace(/\./g, '').replace(/,/g, '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : num;
    }
    const num = parseFloat(raw);
    return isNaN(num) ? 0 : num;
  };

  const AROMAS: { key: string; label: string; predicate: (m: string) => boolean }[] = [
    { key: 'BACON', label: 'TORCIDA BACON', predicate: (m) => m.includes('TORCIDA') && m.includes('BACON') },
    { key: 'CEBOLA', label: 'TORCIDA CEBOLA', predicate: (m) => m.includes('TORCIDA') && m.includes('CEBOLA') },
    { key: 'CHURRASCO', label: 'TORCIDA CHURRASCO', predicate: (m) => m.includes('TORCIDA') && m.includes('CHURRASCO') },
    { key: 'COSTELA', label: 'TORCIDA COSTELINHA', predicate: (m) => m.includes('TORCIDA') && m.includes('COSTELA') },
    { key: 'MEXICANA', label: 'TORCIDA MEXICANA', predicate: (m) => m.includes('TORCIDA') && (m.includes('PIMENTA MEX') || m.includes('MEXICANA')) },
    { key: 'QUEIJO', label: 'TORCIDA QUEIJO', predicate: (m) => m.includes('TORCIDA') && m.includes('QUEIJO') },
    { key: 'CAMARAO', label: 'TORCIDA CAMARAO', predicate: (m) => m.includes('TORCIDA') && m.includes('CAMARAO') },
    { key: 'VINAGRETE', label: 'TORCIDA VINAGRETE', predicate: (m) => m.includes('TORCIDA') && m.includes('VINAGRETE') },
    { key: 'PAO_DE_ALHO', label: 'TORCIDA PAO DE ALHO', predicate: (m) => m.includes('TORCIDA') && m.includes('PAO DE ALHO') },
  ];

  const getPacoteKgForAroma = (aromaPredicate: (m: string) => boolean): number => {
    const candidatos = materialsData
      .filter(m => m.Material.toUpperCase().includes('TORCIDA'))
      .filter(m => aromaPredicate(m.Material.toUpperCase()))
      .map(m => parseNumber(m.Pacote))
      .filter(n => !isNaN(n) && n > 0);
    if (candidatos.length === 0) return 10;
    const freq = new Map<number, number>();
    for (const n of candidatos) freq.set(n, (freq.get(n) || 0) + 1);
    let escolhido = candidatos[0];
    let max = 0;
    for (const [n, f] of freq.entries()) {
      if (f > max) { max = f; escolhido = n; }
    }
    return escolhido;
  };

  const getGramagemKgForItem = (item: EnrichedPlanItem): number => {
    let gramagemStr: string | undefined = item.material?.Gramagem;
    if (!gramagemStr) {
      const byCode = materialsData.find(m => String(m.Codigo) === String(item.CodMaterialProducao));
      gramagemStr = byCode?.Gramagem;
    }
    if (!gramagemStr) {
      const name = (item.MaterialProducao || '').toUpperCase();
      const byName = materialsData.find(m => m.Material.toUpperCase().includes(name));
      gramagemStr = byName?.Gramagem;
    }
    return parseNumber(gramagemStr);
  };

  const getAromaKeyForMaterial = (nameUpper: string): string | null => {
    for (const a of AROMAS) {
      if (a.predicate(nameUpper)) return a.key;
    }
    return null;
  };

  // Função que busca os pacotes salvos e calcula a diferença por aroma para exibir alerta na tabela
  const refreshAromaDifferences = async () => {
    try {
      const resp = await fetch('/api/intermediario');
      const json = await resp.json();
      const qtdMap: Record<string, number> = {};
      if (json?.success && Array.isArray(json.data)) {
        for (const item of json.data) {
          const key = String(item?.aromaKey || '').toUpperCase();
          const val = Number(item?.qtdPacotes || 0);
          if (!isNaN(val)) qtdMap[key] = val;
        }
      }

      const diffMap: Record<string, number> = {};
      for (const aroma of AROMAS) {
        const qtdPacotes = qtdMap[aroma.key] || 0;
        const pacoteKg = getPacoteKgForAroma(aroma.predicate);
        const tonsIntermediario = (qtdPacotes * pacoteKg) / 1000;
        const filteredItems = data.filter((it) => {
          const nameRaw = (it.MaterialProducao || '').toUpperCase();
          const name = nameRaw.replace(/\s+/g, ' ').trim();
          return aroma.predicate(name) && name.includes('TORCIDA');
        });
        const plannedTons = filteredItems.reduce((sum, it) => sum + (it.Tons || 0), 0);
        const producedTons = filteredItems.reduce((sum, it) => {
          const gramagemKg = getGramagemKgForItem(it);
          const bolsas = it.totalBolsasProduzido ?? it.BolsasProduzido ?? 0;
          const tons = (bolsas * gramagemKg) / 1000;
          return sum + tons;
        }, 0);
        const faltaPlanoTons = plannedTons - producedTons;
        const diferenca = tonsIntermediario - faltaPlanoTons;
        diffMap[aroma.key] = diferenca;
      }
      setAromaDifferences(diffMap);
    } catch (_) {
      // silencioso
    }
  };

  // Atualiza os alertas ao montar/alterar dados do plano
  useEffect(() => {
    refreshAromaDifferences();
  }, [data]);

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
    item.CodMaterialProducao.toString().includes(searchTerm) ||
    (searchTerm.toLowerCase() === 'fofura' && item.MaterialProducao.toUpperCase().includes('FOFURA')) ||
    (searchTerm.toLowerCase() === 'torcida' && item.MaterialProducao.toUpperCase().includes('TORCIDA'))
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

  // === Resumo consolidado para e-mail ===
  const formatTons = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const computePlannedTons = (item: EnrichedPlanItem) => {
    const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));
    if (materialRef && materialRef.Gramagem && materialRef.Und && item.PlanoCaixasFardos !== undefined) {
      const und = parseFloat(String(materialRef.Und).replace(',', '.'));
      const gramagem = parseFloat(String(materialRef.Gramagem).replace(',', '.'));
      const consumoTons = (item.PlanoCaixasFardos * und * gramagem) / 1000; // kg -> tons
      return consumoTons;
    }
    return item.Tons || 0;
  };

  const computeProducedTons = (item: EnrichedPlanItem) => {
    const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));
    if (materialRef && materialRef.Gramagem && item.BolsasProduzido !== undefined) {
      const gramagem = parseFloat(String(materialRef.Gramagem).replace(',', '.'));
      const bolsas = item.totalBolsasProduzido ?? item.BolsasProduzido ?? 0;
      const consumoTons = (bolsas * gramagem) / 1000; // kg -> tons
      return consumoTons;
    }
    return 0;
  };

  const summaryHtml = (() => {
    // Apenas itens TORCIDA devem ser enviados no resumo por e-mail
    const torcidaData = data.filter((it) => /TORCIDA/i.test(it.MaterialProducao || ''));
    const lines = torcidaData.map((it) => {
      const planned = computePlannedTons(it);
      const produced = computeProducedTons(it);
      return `<li> ${it.MaterialProducao} — Tons: ${formatTons(planned)} Produzido Tons: ${formatTons(produced)}t </li>`;
    }).join('');
    const totals = torcidaData.reduce((acc, it) => {
      acc.planned += computePlannedTons(it);
      acc.produced += computeProducedTons(it);
      return acc;
    }, { planned: 0, produced: 0 });
    const falta = Math.max(totals.planned - totals.produced, 0);
    return `
      <div><div style="font-weight:600">Itens TORCIDA somados no plano:</div><ul style="margin:6px 0 8px 18px;">${lines}</ul>
      <div><span style="font-weight:600">Resumo:</span> Planejado: ${formatTons(totals.planned)}t · Produzido: ${formatTons(totals.produced)}t · Falta: ${formatTons(falta)}t.</div></div>
    `;
  })();

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <img src={logoMotor} alt="Logo Motor" className="w-24 h-12 sm:w-40 sm:h-20" />
             
            </div>
            
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">Plano de Produção</h3>
              <p className="text-xs sm:text-sm text-gray-600">{data.length} itens no plano</p>
            </div>
          </div>
          
          {/* Search + Botão Estoque Intermediário */}
          <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar material, código, FOFURA ou TORCIDA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full sm:w-64 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowIntermediaryModal(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Estoque Intermediário
          </button>
          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Enviar e-mail
          </button>
        </div>
      </div>
    </div>
      
      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader field="CodMaterialProducao">
                <span className="hidden sm:inline">Código</span>
                <span className="sm:hidden">Cód.</span>
              </SortHeader>
              <SortHeader field="MaterialProducao">Material</SortHeader>
              <SortHeader field="PlanoCaixasFardos">
                <span className="hidden lg:inline">Plano de produção</span>
                <span className="lg:hidden">Plano</span>
              </SortHeader>
              <SortHeader field="Tons">
                <span className="hidden sm:inline">Toneladas</span>
                <span className="sm:hidden">Tons</span>
              </SortHeader>
              <SortHeader field="BolsasProduzido">
                <span className="hidden lg:inline">A Produzir</span>
                <span className="lg:hidden">Produzir</span>
              </SortHeader>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                KPIs
              </th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Progresso
              </th>
              <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <span className="hidden sm:inline">Tempo Est.</span>
                <span className="sm:hidden">Tempo</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.map((item) => {
              const materialRef = materialsData.find(m => m.Codigo === item.CodMaterialProducao.toString());
              
              return (
                <tr key={item._id || item.CodMaterialProducao} className="hover:bg-gray-50 transition-colors duration-200 group">
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-1 sm:w-2 h-6 sm:h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full mr-2 sm:mr-3"></div>
                      <span className="text-xs sm:text-sm font-mono font-medium text-gray-900">{item.CodMaterialProducao}</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                   <div>
                      <div className="text-xs sm:text-sm font-semibold text-gray-900 mb-1 max-w-[150px] sm:max-w-none overflow-hidden text-ellipsis">
                        {item.MaterialProducao}
                      </div>
                      {materialRef && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-3 text-xs text-gray-500">
                        {/* <span className="bg-gray-100 px-1 sm:px-2 py-1 rounded-full text-xs">{materialRef.Und} und/cx</span> */}
                          {(() => {
                            const nameUpper = (item.MaterialProducao || '').toUpperCase();
                            // Se for FOFURA, não exibir nenhum texto/valor para Estoque
                            if (nameUpper.includes('FOFURA')) {
                              return null;
                            }
                            const aromaKey = getAromaKeyForMaterial(nameUpper);
                            const diff = aromaKey ? aromaDifferences[aromaKey] : undefined;
                            const cls = diff === undefined
                              ? 'bg-gray-100 text-gray-700'
                              : diff < 0
                                ? 'bg-red-100 text-red-700 border border-red-300 animate-pulse'
                                : 'bg-green-100 text-green-700 border border-green-300';
                            const label = diff === undefined
                              ? 'Estoque'
                              : diff < 0
                                ? 'Estoque Mezanino: Falta'
                                : 'Estoque Mezanino: Ok';
                            return (
                              <span className={`${cls} px-1 sm:px-2 py-1 rounded-full text-xs`} title={diff !== undefined ? `Diferença: ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t` : undefined}>
                                 {label}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center align-middle">
                    <div className="text-blue-700 font-bold text-sm sm:text-lg">
                      {(() => {
                        const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));

                        if (!materialRef || !materialRef.Caixas) {
                          return <span className="text-xs sm:text-sm text-gray-400">0</span>;
                        }

                        // Cálculo arredondado para inteiro
                        const resultado = item.PlanoCaixasFardos / materialRef.Caixas;
                        const arredondado = Math.round(resultado);

                        return arredondado.toLocaleString('pt-BR');
                      })()}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 mt-1">
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
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    {(() => {
                      const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));
                      
                      if (materialRef && materialRef.Gramagem && materialRef.Und && item.PlanoCaixasFardos !== undefined) {
                        // Calcular consumo de matéria-prima baseado em BolsasProduzido
                        const und = parseFloat(materialRef.Und.toString().replace(',', '.'));
                        const gramagem = parseFloat(materialRef.Gramagem.toString().replace(',', '.'));
                        const consumoKg = (item.PlanoCaixasFardos * und * gramagem) / 1000; // Converter para toneladas
                        
                        return (
                          <div>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900">
                              {consumoKg.toLocaleString('pt-BR', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1
                              })} t
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Planejado
                            </div>
                          </div>
                        );
                      }
                      
                      // Fallback para o valor original se não houver dados
                      return (
                        <div>
                          <div className="text-xs sm:text-sm font-semibold text-gray-900">
                            {item.Tons.toLocaleString('pt-BR', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })} t
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Planejado
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center align-middle">
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
                          <div className="text-green-600 font-bold text-base sm:text-xl">
                            {diferenca.toLocaleString('pt-BR')}
                          </div>
                        );
                      }

                      return <span className="text-xs sm:text-sm text-gray-400">0</span>;
                    })()}
                    <div className="text-xs sm:text-sm text-gray-500 mt-1">
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

                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    {materialRef && (
                      <div className="space-y-1 sm:space-y-2">
                        <div className="flex items-center space-x-2">
                          <div className="p-1 bg-blue-100 rounded">
                            <Zap className="w-3 h-3 text-blue-600" />
                          </div>
                          <span className="text-xs sm:text-sm text-gray-600">
                           {(() => {
                              const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));

                              if (!materialRef || !materialRef.Caixas || !materialRef.Und || !item.PlanoCaixasFardos) {
                                return <span className="text-xs sm:text-sm text-gray-400">0,000 und</span>;
                              }

                              // Etapas separadas para clareza
                              const pallets = item.PlanoCaixasFardos / materialRef.Caixas;
                              const totalUnidades = Math.round(pallets) * materialRef.Caixas * materialRef.Und;

                              return (
                                <div className="text-xs sm:text-sm text-gray-600">
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
                          <span className="text-xs sm:text-sm text-gray-600">
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
                                    <div className="text-xs sm:text-sm text-gray-600">
                                      {consumoKg.toLocaleString('pt-BR', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                        useGrouping: false
                                      })} t
                                    </div>
                                  );
                                }
                                return <span className="text-xs sm:text-sm text-gray-400">0,000 kg</span>;
                              })()}                               
                          </span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
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
                              <span className="text-xs sm:text-sm font-semibold text-gray-700">
                                {progresso.toFixed(1)}%
                              </span>
                            </div>
                            <div className={`w-full h-1 sm:h-2 rounded-full ${getProgressBg(progresso)}`}>
                              <div
                                className={`h-1 sm:h-2 rounded-full bg-gradient-to-r ${getProgressColor(progresso)} transition-all duration-500`}
                                style={{ width: `${Math.min(progresso, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="text-center">
                          <div className="w-full h-1 sm:h-2 bg-gray-200 rounded-full">
                            <div className="h-1 sm:h-2 bg-gray-300 rounded-full" style={{ width: '0%' }}></div>
                          </div>
                          <span className="text-xs sm:text-sm text-gray-400 mt-1">0%</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                    {(() => {
                     const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));

                     if (
                       materialRef &&
                       materialRef.Caixas &&
                       materialRef.Und &&
                       item.PlanoCaixasFardos !== undefined &&
                       item.BolsasProduzido !== undefined
                     ) {
                       // Calcular progresso invertido (%) - mesma lógica da coluna anterior
                       const produzido = Math.max(
                         Math.round(item.PlanoCaixasFardos / materialRef.Caixas) -
                         Math.round(item.BolsasProduzido / (materialRef.Und * materialRef.Caixas)),
                         0
                       );
                       const planoCaixas = Math.max(Math.round(item.PlanoCaixasFardos / materialRef.Caixas), 1);
                       const progresso = Math.max(0, 100 - (produzido / planoCaixas) * 100);

                       // Se progresso for 100%, exibir "Concluído"
                       if (progresso >= 100) {
                         return (
                           <div className="text-center">
                             <span className="text-xs sm:text-sm text-green-600 font-semibold block">
                               Concluído
                             </span>
                           </div>
                         );
                       }
                     }

                     // Lógica original para casos não concluídos
                      if (!materialRef || !materialRef.PPm) {
                        return <span className="text-xs sm:text-sm text-gray-400">N/A</span>;
                      }

                      const produzido = item.BolsasProduzido || 0;
                      const planoTotal = item.PlanoCaixasFardos * materialRef.Und;
                      const restante = planoTotal - produzido;


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
                            <span className="text-xs sm:text-sm text-red-500 block mt-1">
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
        <div className="text-center py-8 sm:py-12 px-4">
          <Package className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Nenhum item encontrado</h3>
          <p className="text-sm sm:text-base text-gray-500">
            {searchTerm ? 'Tente ajustar os filtros de busca' : 'Carregue um arquivo Excel para visualizar os dados'}
          </p>
        </div>
      )}
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-gray-50 px-4 sm:px-8 py-3 sm:py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Mostrando <span className="font-semibold">{startIndex + 1}</span> a{' '}
            <span className="font-semibold">{Math.min(startIndex + itemsPerPage, sortedData.length)}</span> de{' '}
            <span className="font-semibold">{sortedData.length}</span> resultados
          </div>
          
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 min-h-[44px] min-w-[80px]"
            >
              Anterior
            </button>
            <div className="flex items-center space-x-1 overflow-x-auto">
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
                    } min-h-[44px] min-w-[44px]`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 min-h-[44px] min-w-[80px]"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="bg-gray-50 px-4 sm:px-8 py-2 sm:py-3 border-t border-gray-200">
        <div className="text-xs sm:text-sm text-gray-500 text-center">
          {(() => {
            const year = new Date().getFullYear();
            const contactName = (import.meta.env.VITE_CONTACT_NAME || '').trim();
            const contactEmail = (import.meta.env.VITE_CONTACT_EMAIL || '').trim();
            const contact = contactEmail ? ` | Contato: ${contactName ? contactName + ' ' : ''}<${contactEmail}>` : '';
            return `© ${year} Sistema de Planejamento de Produção${contact}`;
          })()}
        </div>
      </div>

      {/* Modal: Estoque Intermediário */}
      <IntermediaryStockModal
        open={showIntermediaryModal}
        onClose={() => { setShowIntermediaryModal(false); refreshAromaDifferences(); }}
        planData={data}
      />

      {/* Modal: Envio de e-mail */}
      <EmailReportModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        data={data}
        summaryHtml={summaryHtml}
      />
    </div>
  );
};