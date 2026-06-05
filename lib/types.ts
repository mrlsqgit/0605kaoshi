// lib/types.ts
// Core type definitions for Universal Import System

export interface OrderItem {
  id: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  spec: string;
  remark: string;
}

export interface Order {
  id: string;
  externalCode: string;
  storeName: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  items: OrderItem[];
  createdAt: Date;
}

export interface ParsedOrder {
  id: string;
  externalCode: string;
  storeName: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  weight: number;
  pieces: number;
  temperature: string;
  spec: string;
  remark: string;
  rowIndex: number;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export type ExtractType = 'header' | 'body' | 'footer' | 'matrix' | 'card';

export interface FieldMapping {
  source: string;
  target: keyof ParsedOrder;
  type: 'direct' | 'regex' | 'jsonpath' | 'composite';
  pattern?: string;
  defaultValue?: string;
  isStatic?: boolean;
  staticValue?: string;
  aiConfidence?: number;
  aiSuggestion?: boolean;
}

export interface SectionRule {
  id: string;
  name: string;
  type: ExtractType;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  skipRows: number[];
  skipCols: number[];
  hasHeader: boolean;
  headerRow: number;
}

export interface AggregationRule {
  enabled: boolean;
  groupByField: keyof ParsedOrder;
  aggregateFields: (keyof ParsedOrder)[];
  mergeStrategy: 'first' | 'last' | 'concat';
}

export interface MatrixRule {
  enabled: boolean;
  rowHeaders: number[];
  colHeaders: number[];
  dataStartRow: number;
  dataStartCol: number;
  valueSeparator: string;
}

export interface CardRule {
  enabled: boolean;
  startPattern: string;
  endPattern: string;
  cardSeparator: string;
}

export interface ParseRule {
  id: string;
  name: string;
  description: string;
  fileType: 'excel' | 'word' | 'pdf';
  fieldMappings: FieldMapping[];
  sections: SectionRule[];
  aggregation: AggregationRule;
  matrix: MatrixRule;
  card: CardRule;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParseResult {
  success: boolean;
  orders: ParsedOrder[];
  errors: string[];
  warnings: string[];
  processedCount: number;
}

export interface AIResponse {
  success: boolean;
  rule: ParseRule;
  analysis: string;
  confidence: number;
}

export interface UploadProgress {
  percentage: number;
  current: number;
  total: number;
  status: 'uploading' | 'parsing' | 'analyzing' | 'complete' | 'error';
  message: string;
}

export interface RulePreview {
  order: ParsedOrder;
  isAIRecommended: boolean;
  confidence: number;
}

export interface OrderQueryFilter {
  externalCode?: string;
  recipientName?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}