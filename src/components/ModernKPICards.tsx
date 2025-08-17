import React from 'react';
import { Package, Truck, Scale, TrendingUp, Target, Clock, Zap, AlertTriangle } from 'lucide-react';
import { KPICards } from './KPICards';

interface ModernKPICardsProps {
  kpis: {
    totalConsumoKg: number;
    qtdTotalFofura: number;
    qtdTotalTorcida: number;
    totalTons: number;
    toneladasFofura: number;
    toneladasTorcida: number;
    dynamicConsumo: number;
    hasFilterActive: boolean;
    filteredMaterial: string;
    mediaProgresso: number;
  };
}

export const ModernKPICards: React.FC<ModernKPICardsProps> = ({ kpis }) => {
  const cards = [
    {
      title: 'Planejamento por Categoria',
      description: 'Toneladas por tipo de produto',
      values: [
        {
          label: 'Fofura',
          value: kpis.toneladasFofura.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }) + ' ton'
        },
        {
          label: 'Torcida',
          value: kpis.toneladasTorcida.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }) + ' ton'
        }
      ],
      icon: Truck,
      gradient: 'from-amber-500 to-amber-600',
      bgGradient: 'from-amber-50 to-amber-100',
      change: '+8%',
      changeType: 'positive' as const
    },
    {
      title: 'Qtd Total Fofura & Torcida',
      description: 'Consumo total em kg',
      values: [
        {
          label: 'Fofura',
          value: kpis.qtdTotalFofura.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }) + ' t'
        },
        {
          label: 'Torcida',
          value: kpis.qtdTotalTorcida.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }) + ' t'
        }
      ],
      icon: Truck,
      gradient: 'from-emerald-500 to-emerald-600',
      bgGradient: 'from-emerald-50 to-emerald-100',
      change: '+8%',
      changeType: 'positive' as const
    },
     {
        title: 'Produção Total',
        value: kpis.totalConsumoKg.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false
      }),
      unit: 't',
      icon: Scale,
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100',
      change: '+12%',
      changeType: 'positive' as const
    },
      {
      title: 'Progresso Médio',
      value: `${kpis.mediaProgresso.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`,
      unit: '%',
      icon: TrendingUp,
      gradient: 'from-purple-500 to-purple-600',
      bgGradient: 'from-purple-50 to-purple-100',
      change: kpis.mediaProgresso > 70 ? '+15%' : '-5%',
      changeType: kpis.mediaProgresso > 70 ? 'positive' as const : 'negative' as const
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.bgGradient} p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 sm:hover:-translate-y-2 border border-white/20`}
          >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 -mt-2 -mr-2 sm:-mt-4 sm:-mr-4 w-16 h-16 sm:w-24 sm:h-24 opacity-10">
              <div className={`w-full h-full rounded-full bg-gradient-to-br ${card.gradient}`}></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className={`p-2 sm:p-3 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className={`flex items-center space-x-1 text-xs font-semibold px-2 py-1 rounded-full ${
                  card.changeType === 'positive' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  <TrendingUp className={`w-3 h-3 ${card.changeType === 'negative' ? 'rotate-180' : ''}`} />
                  <span>{card.change}</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 leading-tight">{card.title}</p>
                {card.values ? (
                  <div className="space-y-2">
                    {card.description && (
                      <p className="text-xs text-gray-500">{card.description}</p>
                    )}
                    {card.values.map((valueItem, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-gray-600">{valueItem.label}:</span>
                        <span className="text-sm sm:text-lg font-bold text-gray-800 text-right">{valueItem.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-baseline space-x-1">
                    <p className="text-2xl sm:text-3xl font-bold text-gray-800">{card.value}</p>
                    {card.unit && <span className="text-base sm:text-lg font-semibold text-gray-600">{card.unit}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};