export interface Material {
  Codigo: string;
  Material: string;
  Gramagem: string;
  Und: number;
  Caixas: number;
  PPm: number;
}

export interface PlanItem {
  CodMaterialProducao: string;
  MaterialProducao: string;
  PlanoCaixasFardos: number;
  Tons: number;
  BolsasProduzido?: number;
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductionUpdate {
  CodMaterialSap: string;
  TextoBreveMaterial: string;
  Qtd_real_origem: number;
  Unid_medida_basica: string;
  Data_de_criacao: string;
}

export interface EnrichedPlanItem extends PlanItem {
  material?: Material;
  produtividadeEsperada?: number;
  consumoMateriaPrima?: number;
  progressoProducao?: number;
  totalBolsasProduzido: number;
}