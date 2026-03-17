export type UploadOut = {
  id: string;
  report_key: string;
  version_no: number;
  original_filename: string;
  uploaded_at: string;
  notes?: string | null;
  region_id?: string | null;
  country_id?: string | null;
  model_id?: string | null;
  company_id?: string | null;
  report_year?: number | null;
  report_month?: number | null;
};

export type ReportNodeOut = {
  id: string;
  upload_id: string;
  code: string;
  level: number;
  parent_code?: string | null;
  description?: string | null;
  value?: string | number | null;
  sheet_name: string;
  cell_ref: string;
  created_at: string;
};

export type TreeNode = {
  id: string;
  code: string;
  description?: string | null;
  value?: string | number | null;
  sheet_name: string;
  cell_ref: string;
  level: number;
  children: TreeNode[];
};

export type MappingOut = {
  id: string;
  model_id?: string | null;
  model_name?: string | null;
  name: string;
  version: number;
  is_active: boolean;
  uploaded_at: string;
  uploaded_by?: string | null;
  notes?: string | null;
  item_count?: number | null;
};

export type MappingItemOut = {
  id: string;
  mapping_id: string;
  code: string;
  description?: string | null;
  sheet_name: string;
  cell_ref: string;
  level: number;
  parent_code?: string | null;
  created_at: string;
};

