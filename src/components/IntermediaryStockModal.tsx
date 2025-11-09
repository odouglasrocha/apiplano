import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { EnrichedPlanItem } from '../types/production';
import { materialsData } from '../data/materials';

interface IntermediaryStockModalProps {
  open: boolean;
  onClose: () => void;
  planData: EnrichedPlanItem[];
}

// Função utilitária robusta para converter strings com vírgula/ponto em número
const parseNumber = (value: string | number | undefined): number => {
  if (value === undefined) return 0;
  if (typeof value === 'number') return value;
  const raw = String(value).trim();
  // Se tem vírgula e não tem ponto, vírgula é decimal
  if (raw.includes(',') && !raw.includes('.')) {
    const normalized = raw.replace(/\./g, '').replace(/,/g, '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }
  // Se tem ponto como decimal
  const num = parseFloat(raw);
  return isNaN(num) ? 0 : num;
};

// Obtém o peso por pacote (em kg) a partir do materialsData
const getPacoteKg = (): number => {
  // Todos os materiais atuais possuem "Pacote": "10,000" => 10 kg
  // Mantemos flexível caso mude futuramente
  const anyMaterial = materialsData[0];
  const pacote = parseNumber(anyMaterial?.Pacote);
  return pacote; // já está em kg
};

// Obtém a gramagem em KG por bolsa para um item, com fallbacks robustos
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

// Mapeamento dos aromas com seus filtros no MaterialProducao
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

// Valores iniciais sugeridos pelo usuário
const INITIAL_QTD: Record<string, number> = {
  BACON: 0,
  CEBOLA: 0,
  CHURRASCO: 0,
  COSTELA: 0,
  MEXICANA: 0,
  QUEIJO: 0,
  CAMARAO: 0,
  VINAGRETE: 0,
  PAO_DE_ALHO: 0,
};

export const IntermediaryStockModal: React.FC<IntermediaryStockModalProps> = ({ open, onClose, planData }) => {
  const [quantidades, setQuantidades] = useState<Record<string, number>>(INITIAL_QTD);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const pacoteKg = getPacoteKg(); // 10 kg por pacote atualmente

  // Carrega valores salvos da base test.intermediario ao abrir o modal
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const resp = await fetch('/api/intermediario');
        const json = await resp.json();
        if (json?.success && Array.isArray(json.data)) {
          const map: Record<string, number> = { ...INITIAL_QTD };
          for (const item of json.data) {
            const key = String(item?.aromaKey || '').toUpperCase();
            const val = Number(item?.qtdPacotes || 0);
            if (key in map) map[key] = val;
          }
          setQuantidades(map);
        }
      } catch (_) {
        // silencioso
      }
    };
    if (open) loadSaved();
  }, [open]);

  // Cálculos por aroma: Tons (intermediário), Falta no Plano (planejado - produzido em tons), Diferença
  const linhas = useMemo(() => {
    return AROMAS.map((aroma) => {
      const qtdPacotes = quantidades[aroma.key] || 0;
      const tonsIntermediario = (qtdPacotes * pacoteKg) / 1000; // 10 kg => 0,01 t por pacote

      // Ajuste: somar SOMENTE os Tons (planejados) por aroma
      // Regra: considerar SOMENTE itens cujo nome contenha "TORCIDA" (excluir FOFURA e quaisquer outros)
      const filteredItems = planData.filter((item) => {
        const nameRaw = (item.MaterialProducao || '').toUpperCase();
        const name = nameRaw.replace(/\s+/g, ' ').trim();
        // Garante que contenha a marca TORCIDA e o sabor correto do aroma (não precisa iniciar com TORCIDA)
        return aroma.predicate(name) && name.includes('TORCIDA');
      });
      const plannedTons = filteredItems.reduce((sum, item) => sum + (item.Tons || 0), 0);

      // Produzido em TONS = BolsasProduzido * Gramagem(kg) -> tons (/1000)
      // Observação: materialsData.Gramagem vem como string decimal em KG (ex.: "0,060" = 0.060 kg)
      const producedTons = filteredItems.reduce((sum, item) => {
        const gramagemKg = getGramagemKgForItem(item); // kg por bolsa
        const bolsas = item.totalBolsasProduzido ?? item.BolsasProduzido ?? 0;
        const tons = (bolsas * gramagemKg) / 1000; // kg -> tons
        return sum + tons;
      }, 0);

      // Falta em Plano = Planejado (Tons) - Produzido (Tons)
      const faltaPlanoTons = plannedTons - producedTons;

      // Diferença: Tons (mezanino) - Falta em Plano
      // Interpretação: se > 0, há cobertura suficiente; se < 0, falta cobertura
      const diferenca = tonsIntermediario - faltaPlanoTons;

      return {
        key: aroma.key,
        label: aroma.label,
        qtdPacotes,
        tonsIntermediario,
        faltaPlanoTons,
        diferenca,
        included: filteredItems.map(fi => ({ name: fi.MaterialProducao, tons: fi.Tons || 0 })),
        plannedTons,
        producedTons,
      };
    });
  }, [planData, pacoteKg, quantidades]);

  const totalMezaninoTons = useMemo(
    () => linhas.reduce((sum, l) => sum + l.tonsIntermediario, 0),
    [linhas]
  );

  const handleChange = async (key: string, value: string) => {
    const num = parseFloat(value.replace(',', '.'));
    const safe = isNaN(num) || num < 0 ? 0 : num;
    // Atualiza UI imediatamente
    setQuantidades((prev) => ({ ...prev, [key]: safe }));
    // Auto-salva no backend (substitui valor anterior)
    try {
      await fetch(`/api/intermediario/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qtdPacotes: safe })
      });
    } catch (_) {
      // silencioso: em caso de falha, mantemos UI e podemos re-tentar manualmente se necessário
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4 sm:p-6">
      <div className="bg-white w-full max-w-[95vw] sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-[1100px] rounded-2xl shadow-2xl border border-gray-200 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Estoque Intermediário • Aroma</h2>
            <p className="text-sm text-gray-500">Digite a quantidade de pacotes; os tons são calculados com base em data/materials → Pacote</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Table */}
        <div className="px-4 sm:px-6 py-4 overflow-x-auto overflow-y-auto flex-1">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Aroma</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Quant. Pacote</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tons</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Falta em Plano</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map((linha) => (
                <React.Fragment key={linha.key}>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800 flex items-center gap-2">
                    {linha.label}
                    <button
                      className="ml-2 text-xs text-blue-600 hover:underline"
                      onClick={() => setExpandedKey(expandedKey === linha.key ? null : linha.key)}
                    >
                      {expandedKey === linha.key ? 'Ocultar itens' : 'Mostrar itens'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      inputMode="numeric"
                      className="w-24 sm:w-28 md:w-32 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={linha.qtdPacotes}
                      onChange={(e) => handleChange(linha.key, e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {linha.tonsIntermediario.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {linha.faltaPlanoTons.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${linha.diferenca >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {linha.diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                  </td>
                </tr>
                {expandedKey === linha.key && (
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="px-6 py-3">
                      <div className="text-xs text-gray-700">
                        <div className="font-semibold mb-1">Itens somados no plano:</div>
                        {linha.included.length === 0 ? (
                          <div>Nenhum item TORCIDA para este aroma foi encontrado no plano.</div>
                        ) : (
                          <ul className="list-disc ml-4">
                            {linha.included.map((inc, idx) => (
                              <li key={idx}>
                                {inc.name} — Tons: {inc.tons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-2">
                          <span className="font-semibold">Resumo:</span>{' '}
                          Planejado: {linha.plannedTons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}t ·{' '}
                          Produzido: {linha.producedTons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}t ·{' '}
                          Falta: {linha.faltaPlanoTons.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}t
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t flex items-center justify-between">
          <div className="text-sm text-gray-600">
            TOTAL MEZANINO EM TONS
          </div>
          <div className="text-lg font-bold text-blue-700">
            {totalMezaninoTons.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
          </div>
        </div>
      </div>
    </div>
  );
};