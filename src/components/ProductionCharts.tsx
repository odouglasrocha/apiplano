import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { EnrichedPlanItem } from '../types/production';
import { materialsData } from '../data/materials';

interface ProductionChartsProps {
  data: EnrichedPlanItem[];
}

// Cores para as categorias
const COLORS = {
  'Não Iniciado': '#CCCCCC',
  'Em Andamento': '#FFA500',
  'Concluído': '#4CAF50'
};

// Tooltip customizado
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white text-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 max-w-[200px]">
        <p className="font-semibold text-gray-700">{data.name}</p>
        <p className="text-sm">
          <span style={{ color: data.payload.color }}>●</span> {data.value.toFixed(1)}%
        </p>
        <p className="text-xs text-gray-500">{data.payload.count} itens</p>
      </div>
    );
  }
  return null;
};

// Componente para renderizar label customizado
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null; // Não mostrar labels para fatias muito pequenas
  
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central"
      className="text-xs font-semibold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export const ProductionCharts: React.FC<ProductionChartsProps> = ({ data }) => {
  // Função para calcular progresso usando a mesma lógica da tabela
  const calculateProgress = (item: EnrichedPlanItem) => {
    const materialRef = materialsData.find(m => m.Codigo === String(item.CodMaterialProducao));
    
    if (
      materialRef &&
      materialRef.Caixas &&
      materialRef.Und &&
      item.PlanoCaixasFardos !== undefined &&
      item.BolsasProduzido !== undefined
    ) {
      const produzido = Math.max(
        Math.round(item.PlanoCaixasFardos / materialRef.Caixas) -
        Math.round(item.BolsasProduzido / (materialRef.Und * materialRef.Caixas)),
        0
      );
      const planoCaixas = Math.max(Math.round(item.PlanoCaixasFardos / materialRef.Caixas), 1);
      const progresso = Math.max(0, 100 - (produzido / planoCaixas) * 100);
      
      return Math.round(progresso * 100) / 100;
    }
    
    return 0;
  };

  // Separar dados por material
  const fofuraData = data.filter(item => 
    item.MaterialProducao.toUpperCase().includes('FOFURA')
  );
  
  const torcidaData = data.filter(item => 
    item.MaterialProducao.toUpperCase().includes('TORCIDA')
  );

  // Função para calcular status de um conjunto de dados
  const calculateStatusData = (materialData: EnrichedPlanItem[], materialName: string) => {
    if (materialData.length === 0) {
      return [
        { name: 'Não Iniciado', value: 0, count: 0, color: COLORS['Não Iniciado'] },
        { name: 'Em Andamento', value: 0, count: 0, color: COLORS['Em Andamento'] },
        { name: 'Concluído', value: 0, count: 0, color: COLORS['Concluído'] }
      ];
    }

    const statusCounts = {
      'Não Iniciado': 0,
      'Em Andamento': 0,
      'Concluído': 0
    };

    materialData.forEach(item => {
      const progress = calculateProgress(item);
      
      if (progress === 0) {
        statusCounts['Não Iniciado']++;
      } else if (progress >= 100) {
        statusCounts['Concluído']++;
      } else {
        statusCounts['Em Andamento']++;
      }
    });

    const total = materialData.length;
    
    return [
      {
        name: 'Não Iniciado',
        value: (statusCounts['Não Iniciado'] / total) * 100,
        count: statusCounts['Não Iniciado'],
        color: COLORS['Não Iniciado']
      },
      {
        name: 'Em Andamento',
        value: (statusCounts['Em Andamento'] / total) * 100,
        count: statusCounts['Em Andamento'],
        color: COLORS['Em Andamento']
      },
      {
        name: 'Concluído',
        value: (statusCounts['Concluído'] / total) * 100,
        count: statusCounts['Concluído'],
        color: COLORS['Concluído']
      }
    ].filter(item => item.value > 0); // Remover fatias com 0%
  };

  const fofuraStatusData = calculateStatusData(fofuraData, 'Fofura');
  const torcidaStatusData = calculateStatusData(torcidaData, 'Torcida');

  // Componente para um gráfico individual
  const MaterialPieChart = ({ 
    data: chartData, 
    title, 
    totalItems 
  }: { 
    data: any[], 
    title: string, 
    totalItems: number 
  }) => (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6 flex flex-col">
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 text-center">
        {title}
      </h3>
      
      <div className="flex-1 relative">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              innerRadius={40}
              fill="#8884d8"
              dataKey="value"
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Número central */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">{totalItems}</p>
          <p className="text-xs text-gray-500">Itens</p>
        </div>
      </div>
      
      {/* Legenda customizada */}
      <div className="mt-4 space-y-2">
        {chartData.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <div 
                className="w-4 h-4 rounded-full shadow-sm" 
                style={{ backgroundColor: item.color }}
              ></div>
              <span className="text-sm font-medium text-gray-700">{item.name}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-gray-800">
                {item.value.toFixed(1)}%
              </span>
              <p className="text-xs text-gray-500">{item.count} itens</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8 mb-6 sm:mb-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl mb-3 sm:mb-4 shadow-lg">
          <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
          Status de Produção por Material
        </h2>
        <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto px-4">
          Acompanhamento do progresso de produção separado por categoria de material
        </p>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-8 sm:py-12 px-4">
          <p className="text-sm sm:text-base text-gray-500">
            Nenhum dado disponível para exibição
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Gráfico Fofura */}
          <MaterialPieChart 
            data={fofuraStatusData}
            title="FOFURA"
            totalItems={fofuraData.length}
          />
          
          {/* Gráfico Torcida */}
          <MaterialPieChart 
            data={torcidaStatusData}
            title="TORCIDA"
            totalItems={torcidaData.length}
          />
        </div>
      )}

      {/* Resumo Geral */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-4 sm:p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
          Resumo Geral
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(COLORS).map(([status, color]) => {
            const fofuraCount = fofuraStatusData.find(item => item.name === status)?.count || 0;
            const torcidaCount = torcidaStatusData.find(item => item.name === status)?.count || 0;
            const total = fofuraCount + torcidaCount;
            const percentage = data.length > 0 ? (total / data.length) * 100 : 0;
            
            return (
              <div key={status} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-2 mb-2">
                  <div 
                    className="w-4 h-4 rounded-full shadow-sm" 
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="text-sm font-semibold text-gray-700">{status}</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{total}</p>
                <p className="text-xs text-gray-500">
                  {percentage.toFixed(1)}% do total
                </p>
                <div className="mt-2 text-xs text-gray-600">
                  <div>Fofura: {fofuraCount}</div>
                  <div>Torcida: {torcidaCount}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};