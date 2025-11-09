import React from 'react';
import { X, Mail } from 'lucide-react';
import { EnrichedPlanItem } from '../types/production';
import { ReportEmail } from './ReportEmail';

interface EmailReportModalProps {
  open: boolean;
  onClose: () => void;
  data: EnrichedPlanItem[];
  summaryHtml: string;
}

export const EmailReportModal: React.FC<EmailReportModalProps> = ({ open, onClose, data, summaryHtml }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4 sm:p-6">
      <div className="bg-white w-full max-w-[95vw] sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-[1000px] rounded-2xl shadow-2xl border border-gray-200 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-800">Enviar relatório por e-mail</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 overflow-y-auto flex-1">
          <ReportEmail data={data} summaryHtml={summaryHtml} />
        </div>
      </div>
    </div>
  );
};