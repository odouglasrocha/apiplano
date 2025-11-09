import React, { useState } from 'react';

// Removido: interface RecipientAlias
// Este tipo era usado no fluxo antigo de seleção por apelidos/IDs.
// Como o envio agora utiliza e-mails diretos (Para/CC/BCC), não há uso atual e foi removido para evitar o warning TS6196.

interface ReportEmailProps {
  summaryHtml?: string; // Bloco HTML com resumo consolidado (itens somados e totais)
}

export const ReportEmail: React.FC<ReportEmailProps> = ({ summaryHtml }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');

  // Tabela removida do e-mail conforme solicitado; não construiremos dados tabulares aqui.

  const parseEmails = (str: string): string[] => {
    return str
      .split(/[;,\n\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && /.+@.+\..+/.test(s));
  };

  const toEmails = parseEmails(toInput);
  const ccEmails = parseEmails(ccInput);
  const bccEmails = parseEmails(bccInput);

  const handleSend = async () => {
    if (!toEmails.length) {
      setFeedback({ type: 'error', message: 'Informe ao menos um e-mail no campo "Para"' });
      return;
    }
    try {
      setLoading(true);
      // Captura de tela removida conforme solicitado: enviaremos apenas os dados tabulares e o resumo HTML.

      const res = await fetch('/api/email/send', {
        method: 'POST',
        // sem autenticação: apenas envia
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmails,
          ccEmails,
          bccEmails,
          summaryHtml, // envia bloco adicional de resumo em HTML para o backend montar no corpo do e-mail
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

  // UI sem login: apenas campos de destinatários

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-gray-800">Envio de Relatório de Produção – Embalagem Torcida</h3>
      <p className="text-gray-600 text-sm mb-3">Informe os e-mails dos destinatários. Separe múltiplos e-mails por vírgula, ponto e vírgula ou quebra de linha.</p>
      {feedback && (
        <div className={`text-sm mb-2 ${feedback.type === 'error' ? 'text-red-600' : feedback.type === 'success' ? 'text-green-600' : 'text-gray-700'}`}>{feedback.message}</div>
      )}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Para</label>
          <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2} placeholder="exemplo@empresa.com, outro@empresa.com" value={toInput} onChange={(e) => setToInput(e.target.value)} />
          <div className="text-xs text-gray-500 mt-1">Separe e-mails por vírgula, ; ou quebra de linha.</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CC</label>
          <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2} placeholder="opcional" value={ccInput} onChange={(e) => setCcInput(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">BCC</label>
          <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2} placeholder="opcional" value={bccInput} onChange={(e) => setBccInput(e.target.value)} />
        </div>
      </div>
      <div className="mt-3">
        <button disabled={loading || toEmails.length === 0} onClick={handleSend} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm">
          {loading ? 'Enviando...' : 'Enviar relatório por e-mail'}
        </button>
        {toEmails.length === 0 && (
          <div className="text-xs text-gray-500 mt-2">Informe ao menos um e-mail em “Para”.</div>
        )}
      </div>
    </div>
  );
};