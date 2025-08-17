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
      const result = await response.json();

      if (result.success) {
        setPlanData(result.data || []);
      } else {
        setError(result.message || 'Erro ao carregar dados');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
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
        produtividadeEsperada = material.PPm / material.Caixas;
        const gramagem = parseFloat(material.Gramagem.replace(',', '.'));
        consumoMateriaPrima = item.PlanoCaixasFardos * material.Und * gramagem;

        if (item.BolsasProduzido) {
          const planoEmCaixas = item.PlanoCaixasFardos / (material.Caixas || 1);
          progressoProducao = (item.BolsasProduzido / planoEmCaixas) * 100;

          if (Math.abs(progressoProducao - 100) < 1) {
            progressoProducao = 100;
          }
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
    const totalConsumoKg = filteredData.reduce((sum, item) => {
      const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));
      
      if (materialRef && materialRef.Gramagem && item.BolsasProduzido !== undefined) {
        const gramagem = parseFloat(materialRef.Gramagem.toString().replace(',', '.'));
        const consumoKg = (item.BolsasProduzido * gramagem) / 1000;
        return sum + consumoKg;
      }
      return sum;
    }, 0);
    
    // Calcular Qtd Total Fofura baseado no consumo de matéria-prima
    const qtdTotalFofura = filteredData.reduce((sum, item) => {
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
    
    // Calcular Qtd Total Torcida baseado no consumo de matéria-prima
    const qtdTotalTorcida = filteredData.reduce((sum, item) => {
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
