import React, { useEffect, useMemo, useState } from 'react';
import html2canvas from 'html2canvas';
import { EnrichedPlanItem } from '../types/production';

interface RecipientAlias {
  id: string;
  alias: string;
}

interface ReportEmailProps {
  data: EnrichedPlanItem[];
  kpisSummary?: string;
}

export const ReportEmail: React.FC<ReportEmailProps> = ({ data, kpisSummary }) => {
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [recipients, setRecipients] = useState<RecipientAlias[]>([]);
  const [toIds, setToIds] = useState<string[]>([]);
  const [ccIds, setCcIds] = useState<string[]>([]);
  const [bccIds, setBccIds] = useState<string[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [newAlias, setNewAlias] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const tableData = useMemo(() => {
    return data.slice(0, 100).map((item) => ({
      Codigo: item.CodMaterialProducao,
      Material: item.MaterialProducao,
      Plano: item.PlanoCaixasFardos,
      Toneladas: item.Tons,
      AProduzir: typeof item.BolsasProduzido === 'number' ? Math.max(0, (item.PlanoCaixasFardos || 0) - (item.BolsasProduzido || 0)) : '-',
      Kpis: kpisSummary || '-',
      Progresso: typeof item.progressoProducao === 'number' ? `${Math.round(item.progressoProducao * 100)}%` : '-',
      TempoEst: item.produtividadeEsperada ? '-' : '-',
    }));
  }, [data, kpisSummary]);

  const loadRecipients = async () => {
    try {
      const res = await fetch('/api/email/recipients', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        setIsAuth(false);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setRecipients(json.data || []);
        setIsAuth(true);
      }
    } catch (e) {
      setIsAuth(false);
    }
  };

  useEffect(() => {
    loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: 'success', message: 'Autenticado com sucesso' });
        await loadRecipients();
      } else {
        setFeedback({ type: 'error', message: json.message || 'Falha de autenticação' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Erro ao autenticar' });
    }
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlias || !newEmail) {
      setFeedback({ type: 'error', message: 'Informe apelido e e-mail' });
      return;
    }
    try {
      const res = await fetch('/api/email/recipients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: newAlias, email: newEmail }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: 'success', message: 'Destinatário cadastrado com sucesso' });
        setNewAlias('');
        setNewEmail('');
        await loadRecipients();
      } else {
        setFeedback({ type: 'error', message: json.message || 'Falha ao cadastrar destinatário' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Erro ao cadastrar destinatário' });
    }
  };

  const toggleSelection = (list: string[], setList: (ids: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  const handleSend = async () => {
    if (!toIds.length) {
      setFeedback({ type: 'error', message: 'Selecione ao menos um destinatário (Para)' });
      return;
    }
    try {
      setLoading(true);
      // Usa a captura salva do Dashboard (localStorage). Se não existir, faz fallback capturando o <main> atual.
      let dataUrl = localStorage.getItem('report-dashboard-image') || '';
      if (!dataUrl) {
        const mainEl = document.querySelector('main') || document.getElementById('report-capture') || document.body;
        const rect = mainEl.getBoundingClientRect();
        const canvas = await html2canvas(document.body, {
          useCORS: true,
          backgroundColor: '#ffffff',
          scale: 1,
          x: Math.round(window.scrollX + rect.left),
          y: Math.round(window.scrollY + rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
        dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      }

      const res = await fetch('/api/email/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toIds,
          ccIds,
          bccIds,
          screenshotBase64: dataUrl,
          tableData,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: 'success', message: 'Relatório enviado com sucesso' });
      } else {
        setFeedback({ type: 'error', message: json.message || 'Falha ao enviar relatório' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Erro inesperado ao enviar relatório' });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuth) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-gray-800">Acesso ao envio de relatórios</h3>
        <p className="text-gray-600 text-sm mb-3">Faça login para enviar e-mails com relatórios.</p>
        {feedback && (
          <div className={`text-sm mb-2 ${feedback.type === 'error' ? 'text-red-600' : feedback.type === 'success' ? 'text-green-600' : 'text-gray-700'}`}>{feedback.message}</div>
        )}
        <form onSubmit={handleLogin} className="space-y-2">
          <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-gray-800">Envio de Relatório de Produção – SIGP</h3>
      <p className="text-gray-600 text-sm mb-3">Selecione os destinatários por apelido. E-mails nunca são exibidos.</p>
      {feedback && (
        <div className={`text-sm mb-2 ${feedback.type === 'error' ? 'text-red-600' : feedback.type === 'success' ? 'text-green-600' : 'text-gray-700'}`}>{feedback.message}</div>
      )}
      {/* Cadastro seguro de destinatários (apelido + e-mail). O e-mail não é exibido após cadastro. */}
      <div className="mb-4 p-3 border border-gray-200 rounded-md bg-gray-50">
        <div className="text-sm font-medium text-gray-700 mb-2">Cadastrar destinatário (seguro)</div>
        <form className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end" onSubmit={handleAddRecipient}>
          <div className="md:col-span-1">
            <label className="block text-xs text-gray-600 mb-1">Apelido</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Ex: Gerente Produção" value={newAlias} onChange={(e) => setNewAlias(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">E-mail</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="exemplo@empresa.com" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <div className="md:col-span-1">
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm">Cadastrar</button>
          </div>
        </form>
        <div className="text-xs text-gray-500 mt-2">Após cadastro, apenas o apelido aparece na lista. O e-mail fica criptografado no backend.</div>
      </div>
      {recipients.length === 0 && (
        <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md p-2 mb-3">
          Nenhum destinatário cadastrado. Use o formulário acima para adicionar apelidos.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">Para</div>
          <div className="space-y-2">
            {recipients.map(r => (
              <label key={`to-${r.id}`} className="flex items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={toIds.includes(r.id)} onChange={() => toggleSelection(toIds, setToIds, r.id)} />
                {r.alias}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">CC</div>
          <div className="space-y-2">
            {recipients.map(r => (
              <label key={`cc-${r.id}`} className="flex items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={ccIds.includes(r.id)} onChange={() => toggleSelection(ccIds, setCcIds, r.id)} />
                {r.alias}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">BCC</div>
          <div className="space-y-2">
            {recipients.map(r => (
              <label key={`bcc-${r.id}`} className="flex items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={bccIds.includes(r.id)} onChange={() => toggleSelection(bccIds, setBccIds, r.id)} />
                {r.alias}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <button disabled={loading || toIds.length === 0} onClick={handleSend} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm">
          {loading ? 'Enviando...' : 'Enviar relatório por e-mail'}
        </button>
        {toIds.length === 0 && (
          <div className="text-xs text-gray-500 mt-2">Selecione ao menos um destinatário em “Para”.</div>
        )}
      </div>
    </div>
  );
};