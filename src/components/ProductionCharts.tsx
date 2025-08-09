import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { EnrichedPlanItem } from '../types/production';

interface ProductionChartsProps {
  data: EnrichedPlanItem[];
}

// Conversão segura
const toSafeNumber = (value: any): number => (isNaN(Number(value)) ? 0 : Number(value));
const toSafeString = (value: any): string => (typeof value === 'string' ? value : '');

// Abreviação de texto
const truncateText = (text: string, maxLength: number): string => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '…' : text;
};

// Tooltip customizado
const CustomTooltip = ({ active, payload, label }: any) =>
  active && payload && payload.length ? (
    <div className="bg-white text-gray-800 p-3 rounded-lg shadow-md border border-gray-200 max-w-[220px]">
      <p className="font-semibold text-blue-600">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm">
          <span style={{ color: entry.color }}>●</span> {entry.name}:{' '}
          <span className="font-semibold">{entry.value?.toLocaleString('pt-BR')}</span>
        </p>
      ))}
    </div>
  ) : null;

export const ProductionCharts: React.FC<ProductionChartsProps> = ({ data }) => {
  // Sanitização
  const sanitizedData = Array.isArray(data)
    ? data.map(item => ({
        ...item,
        BolsasProduzido: toSafeNumber(item.BolsasProduzido),
        Tons: toSafeNumber(item.Tons),
        progressoProducao: toSafeNumber(item.progressoProducao),
        PlanoCaixasFardos: toSafeNumber(item.PlanoCaixasFardos),
        CodMaterialProducao: toSafeString(item.CodMaterialProducao),
        MaterialProducao: toSafeString(item.MaterialProducao),
        material: {
          ...item.material,
          Gramagem: toSafeString(item.material?.Gramagem || '0'),
          PPm: toSafeNumber(item.material?.PPm),
        },
      }))
    : [];

  // Gráfico de Barras - Top 10 Materiais
  const topMaterialsByTons = sanitizedData
    .slice()
    .sort((a, b) => b.Tons - a.Tons)
    .slice(0, 10)
    .map(item => ({
      material: truncateText(item.MaterialProducao, 15),
      materialFull: item.MaterialProducao,
      planejado: item.Tons,
      produzido:
        item.BolsasProduzido > 0
          ? (item.BolsasProduzido * parseFloat(item.material.Gramagem.replace(',', '.'))) / 1000
          : 0,
      codigo: item.CodMaterialProducao,
    }));

  // Gráfico de Pizza - Status de Produção
  const statusData = [
    { name: 'Não Iniciado', value: sanitizedData.filter(i => i.BolsasProduzido === 0).length, color: '#ef4444' },
    { name: 'Em Andamento', value: sanitizedData.filter(i => i.BolsasProduzido > 0 && i.progressoProducao < 100).length, color: '#f59e0b' },
    { name: 'Concluído', value: sanitizedData.filter(i => i.progressoProducao >= 100).length, color: '#10b981' },
  ];

  const totalItens = sanitizedData.length;

  // Gráfico de Linha - Progresso por Categoria
  const progressByCategory = sanitizedData.reduce(
    (acc, item) => {
      const category = item.MaterialProducao.split(' ')[1] || 'OUTROS';
      if (!acc[category]) acc[category] = { total: 0, progresso: 0, count: 0 };
      acc[category].total += item.Tons;
      acc[category].progresso += item.progressoProducao;
      acc[category].count += 1;
      return acc;
    },
    {} as Record<string, { total: number; progresso: number; count: number }>
  );

  const categoryData = Object.entries(progressByCategory).map(([category, d]) => ({
    categoria: truncateText(category, 12),
    toneladas: d.total,
    progressoMedio: d.count > 0 ? d.progresso / d.count : 0,
    itens: d.count,
  }));

  // Gráfico de Área - Capacidade vs Demanda
  const capacityData = sanitizedData
    .slice(0, 8)
    .map(item => ({
      material: truncateText(item.MaterialProducao, 12),
      capacidade: item.material.PPm,
      demanda: item.PlanoCaixasFardos,
      eficiencia: item.progressoProducao,
    }))
    .filter(d => typeof d.capacidade === 'number' && !isNaN(d.capacidade) && typeof d.demanda === 'number' && !isNaN(d.demanda));

  return (
    <div className="space-y-8 mb-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl mb-4 shadow-md">
          <TrendingUp className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Análise de Produção
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto text-sm">
          Report completo dos dados de planejamento e execução
        </p>
      </div>

      {sanitizedData.length === 0 ? (
        <p className="text-center text-gray-500">Nenhum dado disponível para exibição</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gráfico de Barras */}
          <div className="bg-gray-100 rounded-2xl shadow-xl border border-gray-200 p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topMaterialsByTons}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="material" tick={{ fontSize: 10, fill: '#4b5563' }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 10, fill: '#4b5563' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#374151' }} />
                <Bar dataKey="planejado" fill="url(#gradientPlanejado)" name="Planejado (T)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="produzido" fill="url(#gradientProduzido)" name="Produzido (T)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="gradientPlanejado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                  <linearGradient id="gradientProduzido" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Pizza */}
          <div className="bg-gray-100 rounded-2xl shadow-xl border border-gray-200 p-6 flex flex-col items-center relative">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Contagem central */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-2xl font-bold text-gray-800">{totalItens}</p>
              <p className="text-xs text-gray-500">SKÚS</p>
            </div>

            {/* Legenda customizada */}
            <div className="flex space-x-6 mt-4">
              {statusData.map((item, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-700 text-sm font-medium">{item.name}</span>
                  <span className="text-gray-500 text-xs">
                    ({((item.value / totalItens) * 100 || 0).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico de Linha */}
          <div className="bg-gray-100 rounded-2xl shadow-xl border border-gray-200 p-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="categoria" tick={{ fontSize: 10, fill: '#4b5563' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#4b5563' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#4b5563' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#374151' }} />
                <Bar yAxisId="left" dataKey="toneladas" fill="#8b5cf6" name="Toneladas" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="progressoMedio" stroke="#f59e0b" strokeWidth={3} name="Progresso Médio (%)" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Área */}
          <div className="bg-gray-100 rounded-2xl shadow-xl border border-gray-200 p-6">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={capacityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="material" tick={{ fontSize: 10, fill: '#4b5563' }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 10, fill: '#4b5563' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#374151' }} />
                <Area type="monotone" dataKey="capacidade" stroke="#f97316" fillOpacity={0.6} fill="#fdba74" name="Capacidade (PPm)" />
                <Area type="monotone" dataKey="demanda" stroke="#3b82f6" fillOpacity={0.6} fill="#93c5fd" name="Demanda (Caixas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
