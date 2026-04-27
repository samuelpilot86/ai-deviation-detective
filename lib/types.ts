export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export interface Deviation {
  deviation_id: string;
  timestamp: string;
  step: string;
  parameter: string;
  observed_value: string;
  acceptable_range: string;
  risk_level: RiskLevel;
  explanation: string;
  probable_root_causes: string[];
  recommended_action: string;
}

export interface AnalysisResult {
  batch_id: string;
  total_rows: number;
  steps: string[];
  deviation_count: number;
  deviations: Deviation[];
}
