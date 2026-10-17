export interface B2BCompany {
  id: number;
  name: string;
  categoryId: string;
  region: string;
  verified: boolean;
  rating: number;
  dealsCount: number;
}

export const GLOBEX_DOMAINS = ['https://globlex.pro', 'https://globlex.shop', 'https://globex.perfops.tech'] as const;
