import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Factory, Upload, RefreshCw, BarChart3, FileSpreadsheet, Zap } from 'lucide-react';
import { useProductionData } from './hooks/useProductionData';
import { ModernFileUpload } from './components/ModernFileUpload';
import { ProductionCharts } from './components/ProductionCharts';
import { ModernKPICards } from './components/ModernKPICards';
import { ModernProductionTable } from './components/ModernProductionTable';
import { Notification } from './components/Notification';
import { ReportEmail } from './components/ReportEmail';

function App() {
  const {
    filteredData,
    kpis,
    loading,
    error,
    updatePlanData,
    updateProduction,
    loadPlanData
  } = useProductionData();

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload'>('dashboard');
  const [uploadStates, setUploadStates] = useState({
    plan: { loading: false, success: false, error: '' },
    production: { loading: false, success: false, error: '' }
  });
  const kpisSummary = `Tons: ${kpis?.totalTons ?? 0} | Progresso médio: ${Math.round((kpis?.mediaProgresso ?? 0) * 100)}%`;

  // Captura em segundo plano da área principal do Dashboard e salva no localStorage
  const captureTimer = useRef<number | null>(null);
  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    const mainEl = document.querySelector('main');
    if (!mainEl) return;
    if (captureTimer.current) {
      window.clearTimeout(captureTimer.current);
    }
    captureTimer.current = window.setTimeout(async () => {
      try {
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        localStorage.setItem('report-dashboard-image', dataUrl);
      } catch (_) {
        // silencioso
      }
    }, 300);
    return () => {
      if (captureTimer.current) {
        window.clearTimeout(captureTimer.current);
        captureTimer.current = null;
      }
    };
  }, [activeTab, filteredData, kpis]);

  const handlePlanFileUpload = async (file: File) => {
    setUploadStates(prev => ({
      ...prev,
      plan: { loading: true, success: false, error: '' }
    }));

    try {
      setNotification({
        type: 'info',
        title: 'Processando arquivo',
        message: 'Analisando dados do plano de produção...'
      });

      await updatePlanData(file);

      setUploadStates(prev => ({
        ...prev,
        plan: { loading: false, success: true, error: '' }
      }));

      setNotification({
        type: 'success',
        title: 'Plano de produção atualizado',
        message: 'Dados foram importados com sucesso no MongoDB.'
      });
    } catch (error) {
      setUploadStates(prev => ({
        ...prev,
        plan: { loading: false, success: false, error: (error as Error).message }
      }));

      setNotification({
        type: 'error',
        title: 'Erro ao processar arquivo',
        message: (error as Error).message || 'Erro ao enviar arquivo para o servidor.'
      });
    }
  };

  const handleProductionUpdate = async (file: File) => {
    setUploadStates(prev => ({
      ...prev,
      production: { loading: true, success: false, error: '' }
    }));

    try {
      setNotification({
        type: 'info',
        title: 'Atualizando produção',
        message: 'Processando dados de produção realizada...'
      });

      await updateProduction(file);

      setUploadStates(prev => ({
        ...prev,
        production: { loading: false, success: true, error: '' }
      }));

      setNotification({
        type: 'success',
        title: 'Produção atualizada',
        message: 'Dados de produção foram atualizados com sucesso.'
      });
    } catch (error) {
      setUploadStates(prev => ({
        ...prev,
        production: { loading: false, success: false, error: (error as Error).message }
      }));

      setNotification({
        type: 'error',
        title: 'Erro na atualização',
        message: (error as Error).message || 'Erro ao atualizar dados no servidor.'
      });
    }
  };

  // Mostrar loading global se estiver carregando dados
  if (loading && filteredData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-700">Carregando dados...</h2>
          <p className="text-sm sm:text-base text-gray-500">Conectando ao MongoDB</p>
        </div>
      </div>
    );
  }

  // Mostrar erro de conexão se houver
  if (error && filteredData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Factory className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2">Erro de Conexão</h2>
          <p className="text-sm sm:text-base text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadPlanData}
            className="px-4 py-2 sm:px-6 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-sm sm:text-base"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }
  return (
    <div id="report-capture" className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
          <div className="flex flex-col sm:flex-row items-center justify-between py-4 sm:h-20 gap-4 sm:gap-0">
            <div className="flex items-center">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl mr-3 sm:mr-4">
                <Factory className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  Plano de Produção
                </h1>
                <p className="text-xs sm:text-sm text-gray-600">Sistema Interativo de Gestão de Produção</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
              {/* Update Production Button */}
              <button
                onClick={() => setActiveTab('upload')}
                className="flex items-center justify-center px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base w-full sm:w-auto min-h-[48px]"
              >
                <RefreshCw className="w-4 h-4 mr-2 flex-shrink-0" />
                Atualizar Produção
              </button>
              
              <nav className="flex space-x-1 sm:space-x-2 w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center px-6 py-3 rounded-xl transition-all duration-200 font-medium ${
                    activeTab === 'dashboard'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                  } text-sm sm:text-base min-h-[48px] flex-1 sm:flex-initial justify-center`}
                >
                  <BarChart3 className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline">Dashboard</span>
                  <span className="sm:hidden">Painel</span>
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`flex items-center px-6 py-3 rounded-xl transition-all duration-200 font-medium ${
                    activeTab === 'upload'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                  } text-sm sm:text-base min-h-[48px] flex-1 sm:flex-initial justify-center`}
                >
                  <Upload className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline">Carregar Dados</span>
                  <span className="sm:hidden">Upload</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Stats Bar */}
      {activeTab === 'dashboard' && (
        <div className="bg-white/60 backdrop-blur-sm border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-8">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs sm:text-sm font-medium text-gray-700">Sistema Online</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs sm:text-sm text-gray-600">Última atualização: {new Date().toLocaleTimeString('pt-BR')}</span>
                </div>
              </div>
              <button
                onClick={loadPlanData}
                disabled={loading}
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200 min-h-[44px] px-3 py-2 rounded-lg hover:bg-blue-50"
              >
                {loading ? 'Carregando...' : 'Atualizar dados'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-4 sm:py-8">
        {activeTab === 'dashboard' ? (
          <>
            {/* KPI Cards */}
            <ModernKPICards kpis={kpis} />

            {/* Production Charts */}
            <ProductionCharts data={filteredData} />

            {/* Production Table */}
            <ModernProductionTable data={filteredData} />
          </>
        ) : (
          <div className="space-y-6 sm:space-y-10">
            {/* Hero Section */}
            <div className="text-center py-4 sm:py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl mb-4 sm:mb-6">
                <FileSpreadsheet className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4">
                Gerenciar Dados de Produção
              </h2>
              <p className="text-base sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed px-4">
                Carregue arquivos Excel para atualizar o plano de produção ou registrar a produção realizada.
                O sistema processa automaticamente os dados e atualiza os indicadores em tempo real.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
              {/* Upload Plano de Produção */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-4 sm:p-8">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl mr-3">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  Plano de Produção
                </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8 leading-relaxed">
                Carregue um arquivo Excel com o plano de produção. O arquivo deve conter as colunas:
              </p>
              <ul className="list-disc list-inside text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
                <li><span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs sm:text-sm">CodMaterialProducao</span></li>
                <li><span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs sm:text-sm">MaterialProducao</span></li>
                <li><span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs sm:text-sm">PlanoCaixasFardos</span></li>
                <li><span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs sm:text-sm">Tons</span></li>
              </ul>
                
                <ModernFileUpload
                  onFileSelect={handlePlanFileUpload}
                  title="Carregar Plano"
                  description="Arquivo Excel (.xlsx) com plano de produção"
                  isLoading={uploadStates.plan.loading}
                  success={uploadStates.plan.success}
                  error={uploadStates.plan.error}
                />
              </div>

              {/* Upload Atualização de Produção */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-4 sm:p-8">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 flex items-center">
                  <div className="p-2 bg-gradient-to-r from-green-500 to-green-600 rounded-xl mr-3">
                    <RefreshCw className="w-5 h-5 text-white" />
                  </div>
                  Atualizar Produção
                </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8 leading-relaxed">
                  Carregue um arquivo Excel com dados de produção realizada. O arquivo deve conter as colunas:
                </p>
                <ul className="list-disc list-inside text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
                  <li><span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs sm:text-sm">CodMaterialSap</span></li>
                  <li><span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs sm:text-sm">TextoBreveMaterial</span></li>
                  <li><span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs sm:text-sm">Qtd_real_origem</span></li>
                  <li><span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs sm:text-sm">Data_de_criacao</span></li>
                </ul>

                <ModernFileUpload
                  onFileSelect={handleProductionUpdate}
                  title="Atualizar Produção"
                  description="Arquivo Excel (.xlsx) com dados de produção"
                  isLoading={uploadStates.production.loading}
                  success={uploadStates.production.success}
                  error={uploadStates.production.error}
                />
            </div>
          </div>

            {/* Instruções */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 sm:p-8">
              <h4 className="text-xl sm:text-2xl font-bold text-blue-800 mb-4 sm:mb-6 flex items-center">
                <div className="p-2 bg-blue-500 rounded-xl mr-3">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                Instruções de Uso
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 text-blue-700">
                <div>
                  <h5 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-blue-800">📊 Plano de Produção:</h5>
                  <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                    <li>Substitui completamente o plano atual no MongoDB</li>
                    <li>Relaciona com a tabela de materiais por código</li>
                    <li>Calcula KPIs automaticamente</li>
                    <li>Suporta formatos .xlsx e .xls</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-blue-800">🔄 Atualização de Produção:</h5>
                  <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                    <li>Atualiza apenas itens existentes no plano</li>
                    <li>Ignora materiais não planejados</li>
                    <li>Salva dados no MongoDB em tempo real</li>
                    <li>Mantém histórico de atualizações</li>
                  </ul>
                </div>
              </div>
            </div>
            {/* Envio de Relatório por E-mail */}
            <div className="mt-6">
              <ReportEmail data={filteredData} kpisSummary={kpisSummary} />
            </div>
          </div>
        )}
      </main>

      {/* Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 -right-16 sm:-top-40 sm:-right-32 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-16 sm:-bottom-40 sm:-left-32 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-br from-green-400/20 to-blue-400/20 rounded-full blur-3xl"></div>
      </div>

      {/* Notifications */}
      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}

export default App;