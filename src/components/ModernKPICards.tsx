import React from 'react';
import { Package, Truck, Scale, TrendingUp, Target, Clock, Zap, AlertTriangle } from 'lucide-react';

interface ModernKPICardsProps {
  kpis: {
    totalConsumoKg: number;
    totalCaixas: number;
    totalTons: number;
    mediaProgresso: number;
  };
}

export const ModernKPICards: React.FC<ModernKPICardsProps> = ({ kpis }) => {
  const cards = [
    {
      title: 'Planejamento',
      value: kpis.totalTons.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
      }),
      unit: 't',
      icon: Scale,
      gradient: 'from-amber-500 to-amber-600',
      bgGradient: 'from-amber-50 to-amber-100',
      change: '+5%',
      changeType: 'positive' as const
    },
    {
      title: 'Caixas/Fardos',
      value: kpis.totalCaixas.toLocaleString('pt-BR'),
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.bgGradient} p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-white/20`}
          >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 opacity-10">
              <div className={`w-full h-full rounded-full bg-gradient-to-br ${card.gradient}`}></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
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
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <div className="flex items-baseline space-x-1">
                  <p className="text-3xl font-bold text-gray-800">{card.value}</p>
                  {card.unit && <span className="text-lg font-semibold text-gray-600">{card.unit}</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};