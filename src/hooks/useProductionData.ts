import { useState, useCallback, useMemo, useEffect } from 'react';
import { PlanItem, EnrichedPlanItem } from '../types/production';
import { materialsData } from '../data/materials';

const API_BASE_URL = '/api';

interface Filters {
  codigo: string;
  material: string;
}

export const useProductionData = () => {
  const [planData, setPlanData] = useState<PlanItem[]>([]);
  const [filters, setFilters] = useState<Filters>({
    codigo: '',
    material: '',
  });
  const [loading, setLoading] = useState(false); // ✅ Adicionado estado loading
  const [error, setError] = useState<string | null>(null);

  // Carregar dados iniciais do MongoDB
  const loadPlanData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/producoes`);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`API /producoes falhou (${response.status}). ${text || 'Sem corpo na resposta.'}`);
      }
      const result = await response.json();

      if (result.success) {
        setPlanData(result.data || []);
      } else {
        setError(result.message || 'Erro ao carregar dados');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro de conexão com o servidor';
      setError(msg);
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlanData();
  }, [loadPlanData]);

  // Enriquecer dados com cálculos e referências
  const enrichedData = useMemo((): EnrichedPlanItem[] => {
    return planData.map(item => {
      const material = materialsData.find(m => m.Codigo === item.CodMaterialProducao);

      let produtividadeEsperada = 0;
      let consumoMateriaPrima = 0;
      let progressoProducao = 0;

      if (material) {
        // produtividadeEsperada: referência (PPm por caixa)
        produtividadeEsperada = material.PPm / material.Caixas;

        // Cálculo de consumo planejado em kg (para referência)
        const gramagem = parseFloat(String(material.Gramagem).replace(',', '.'));
        consumoMateriaPrima = item.PlanoCaixasFardos * material.Und * gramagem; // kg

        // Cálculo de progresso com base em toneladas (mesma regra usada no relatório)
        const plannedTons = (() => {
          if (item.Tons && item.Tons > 0) return item.Tons;
          const und = parseFloat(String(material.Und).replace(',', '.'));
          return (item.PlanoCaixasFardos * und * gramagem) / 1000; // kg -> tons
        })();

        const producedTons = (() => {
          const bolsas = item.BolsasProduzido ?? 0;
          return (bolsas * gramagem) / 1000; // kg -> tons
        })();

        progressoProducao = plannedTons > 0 ? (producedTons / plannedTons) * 100 : 0;
        // Clamp para evitar >100%
        if (progressoProducao > 100) progressoProducao = 100;
        if (Math.abs(progressoProducao - 100) < 0.01) {
          progressoProducao = 100;
        }
      }

      return {
        ...item,
        material,
        produtividadeEsperada,
        consumoMateriaPrima,
        progressoProducao,
        totalBolsasProduzido: item.BolsasProduzido ?? 0 // Usa o valor direto do backend
      };
    });
  }, [planData]);

  // Filtro corrigido: converte CodMaterialProducao para string para usar includes
  const filteredData = useMemo(() => {
    return enrichedData.filter(item => {
      const codigoMatch = !filters.codigo || String(item.CodMaterialProducao).includes(filters.codigo);
      const materialMatch = !filters.material || item.MaterialProducao.toLowerCase().includes(filters.material.toLowerCase());
      return codigoMatch && materialMatch;
    });
  }, [enrichedData, filters]);

  const updateFilters = useCallback((newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Envio do arquivo Excel para upload inicial (substitui dados)
  const updatePlanData = useCallback(async (file: File): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('excel', file);

      const response = await fetch(`${API_BASE_URL}/producoes`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`API /producoes (POST) falhou (${response.status}). ${text || 'Sem corpo na resposta.'}`);
      }
      const result = await response.json();

      if (result.success) {
        await loadPlanData();
      } else {
        throw new Error(result.message || 'Erro ao enviar arquivo');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [loadPlanData]);

  // Envio do arquivo Excel para atualizar produção (soma e atualiza só os informados)
  const updateProduction = useCallback(async (file: File): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('excel', file);

      const response = await fetch(`${API_BASE_URL}/producoes/atualizar`, {
        method: 'PUT',
        body: formData
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`API /producoes/atualizar (PUT) falhou (${response.status}). ${text || 'Sem corpo na resposta.'}`);
      }
      const result = await response.json();

      if (result.success) {
        await loadPlanData();
      } else {
        throw new Error(result.message || 'Erro ao atualizar produção');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar produção';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [loadPlanData]);

  const kpis = useMemo(() => {
    // Calcular consumo total baseado em BolsasProduzido (dados completos)
    const totalConsumoKg = planData.reduce((sum, item) => {
      const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));
      
      if (materialRef && materialRef.Gramagem && item.BolsasProduzido !== undefined) {
        const gramagem = parseFloat(materialRef.Gramagem.toString().replace(',', '.'));
        const consumoKg = (item.BolsasProduzido * gramagem) / 1000;
        return sum + consumoKg;
      }
      return sum;
    }, 0);
    
    // Calcular consumo filtrado por FOFURA baseado em BolsasProduzido (dados completos)
    const qtdTotalFofura = planData.reduce((sum, item) => {
      const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));
      
      if (
        item.BolsasProduzido !== undefined &&
        item.MaterialProducao.toUpperCase().includes('FOFURA') &&
        materialRef &&
        materialRef.Gramagem
      ) {
        const gramagem = parseFloat(materialRef.Gramagem.toString().replace(',', '.'));
        const consumoKg = (item.BolsasProduzido * gramagem) / 1000;
        return sum + consumoKg;
      }
      return sum;
    }, 0);
    
    // Calcular consumo filtrado por TORCIDA baseado em BolsasProduzido (dados completos)
    const qtdTotalTorcida = planData.reduce((sum, item) => {
      const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));
      
      if (
        item.BolsasProduzido !== undefined &&
        item.MaterialProducao.toUpperCase().includes('TORCIDA') &&
        materialRef &&
        materialRef.Gramagem
      ) {
        const gramagem = parseFloat(materialRef.Gramagem.toString().replace(',', '.'));
        const consumoKg = (item.BolsasProduzido * gramagem) / 1000;
        return sum + consumoKg;
      }
      return sum;
    }, 0);
    
    // Calcular TONELADAS por categoria - SOMA DIRETA de item.Tons
    const toneladasFofura = planData
      .filter(item => item.MaterialProducao && item.MaterialProducao.toUpperCase().includes('FOFURA'))
      .reduce((sum, item) => sum + (item.Tons || 0), 0);
    
    const toneladasTorcida = planData
      .filter(item => item.MaterialProducao && item.MaterialProducao.toUpperCase().includes('TORCIDA'))
      .reduce((sum, item) => sum + (item.Tons || 0), 0);
    
    // ✅ NOVO: Calcular consumo dinâmico baseado no filtro ativo
    const hasFilterFofura = filters.material.toUpperCase().includes('FOFURA');
    const hasFilterTorcida = filters.material.toUpperCase().includes('TORCIDA');
    
    // ✅ Declarar hasFilterActive
    const hasFilterActive = hasFilterFofura || hasFilterTorcida || filters.material.trim() !== '';
    
    // Calcular consumo dos dados filtrados (reativo ao filtro)
    const consumoFiltradoFofura = filteredData
      .filter(item => item.MaterialProducao.toUpperCase().includes('FOFURA'))
      .reduce((sum, item) => {
        const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));
        if (materialRef && materialRef.Gramagem && item.BolsasProduzido !== undefined) {
          const gramagem = parseFloat(materialRef.Gramagem.toString().replace(',', '.'));
          const consumoKg = (item.BolsasProduzido * gramagem) / 1000;
          return sum + consumoKg;
        }
        return sum;
      }, 0);
    
    const consumoFiltradoTorcida = filteredData
      .filter(item => item.MaterialProducao.toUpperCase().includes('TORCIDA'))
      .reduce((sum, item) => {
        const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));
        if (materialRef && materialRef.Gramagem && item.BolsasProduzido !== undefined) {
          const gramagem = parseFloat(materialRef.Gramagem.toString().replace(',', '.'));
          const consumoKg = (item.BolsasProduzido * gramagem) / 1000;
          return sum + consumoKg;
        }
        return sum;
      }, 0);
    
    // ✅ LÓGICA DINÂMICA: Escolher valor baseado no filtro ativo
    let dynamicConsumo = totalConsumoKg; // Padrão: total geral
    let filteredMaterial = '';
    
    if (hasFilterFofura) {
      dynamicConsumo = consumoFiltradoFofura;
      filteredMaterial = 'FOFURA';
    } else if (hasFilterTorcida) {
      dynamicConsumo = consumoFiltradoTorcida;
      filteredMaterial = 'TORCIDA';
    }

    const totalTons = filteredData.reduce((sum, item) => sum + item.Tons, 0);
    
    // Calcular média de progresso baseada na mesma lógica da tabela
    const mediaProgresso = filteredData.length > 0
      ? filteredData.reduce((sum, item) => {
          const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));
          
          if (
            materialRef &&
            materialRef.Caixas &&
            materialRef.Und &&
            item.PlanoCaixasFardos !== undefined &&
            item.BolsasProduzido !== undefined
          ) {
            // Mesmo cálculo da coluna Progresso na tabela
            const produzido = Math.max(
              Math.round(item.PlanoCaixasFardos / materialRef.Caixas) -
              Math.round(item.BolsasProduzido / (materialRef.Und * materialRef.Caixas)),
              0
            );
            const planoCaixas = Math.max(Math.round(item.PlanoCaixasFardos / materialRef.Caixas), 1);
            const progresso = Math.max(0, 100 - (produzido / planoCaixas) * 100);
            return sum + progresso;
          }
          return sum;
        }, 0) / filteredData.length
      : 0;

    return {
      totalConsumoKg: Math.round(totalConsumoKg * 1000) / 1000,
      qtdTotalFofura: Math.round(qtdTotalFofura * 1000) / 1000,
      qtdTotalTorcida: Math.round(qtdTotalTorcida * 1000) / 1000,
      totalTons: Math.round(totalTons * 100) / 100,
      toneladasFofura: Number(toneladasFofura.toFixed(2)),
      toneladasTorcida: Number(toneladasTorcida.toFixed(2)),
      dynamicConsumo: Math.round(dynamicConsumo * 1000) / 1000,
      hasFilterActive,
      filteredMaterial,
      mediaProgresso: Math.round(mediaProgresso * 10) / 10
    };
  }, [filteredData]);

  return {
    planData,
    filteredData,
    filters,
    kpis,
    loading,
    error,
    updateFilters,
    updatePlanData,
    updateProduction,
    loadPlanData
  };
};
