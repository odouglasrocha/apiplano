import * as XLSX from 'xlsx';
import { PlanItem, ProductionUpdate } from '../types/production';

export const parseProductionPlanExcel = (file: File): Promise<PlanItem[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const planItems: PlanItem[] = jsonData.map((row: any) => ({
          CodMaterialProducao: String(row.CodMaterialProducao || row['Código Material'] || row.Codigo || ''),
          MaterialProducao: String(row.MaterialProducao || row.Material || row['Material Produção'] || ''),
          PlanoCaixasFardos: Number(row.PlanoCaixasFardos || row['Plano Caixas'] || row.Caixas || 0),
          Tons: Number(row.Tons || row.Toneladas || row.Peso || 0),
          BolsasProduzido: Number(row.BolsasProduzido || row.Produzido || 0) || undefined
        })).filter(item => item.CodMaterialProducao && item.MaterialProducao);
        
        resolve(planItems);
      } catch (error) {
        reject(new Error('Erro ao processar arquivo Excel. Verifique o formato.'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
};

export const parseProductionUpdateExcel = (file: File): Promise<ProductionUpdate[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const updates: ProductionUpdate[] = jsonData.map((row: any) => ({
          CodMaterialSap: String(row.CodMaterialSap || row['Código SAP'] || row.Codigo || ''),
          TextoBreveMaterial: String(row.TextoBreveMaterial || row.Material || row['Texto Breve'] || ''),
          Qtd_real_origem: Number(row.Qtd_real_origem || row.Quantidade || row.Produzido || 0),
          Unid_medida_basica: String(row.Unid_medida_basica || row.Unidade || 'UN'),
          Data_de_criacao: String(row.Data_de_criacao || row.Data || new Date().toLocaleDateString('pt-BR'))
        })).filter(item => item.CodMaterialSap && item.Qtd_real_origem > 0);
        
        resolve(updates);
      } catch (error) {
        reject(new Error('Erro ao processar arquivo de atualização. Verifique o formato.'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
};