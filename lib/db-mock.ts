// lib/db-mock.ts
// Mock database implementation for local development
// This provides basic functionality without needing a real database

import { Order, ParseRule, OrderQueryFilter, PaginatedResult } from './types';

// In-memory storage for development
let mockOrders: Order[] = [];

// Default parse rules for development
let mockParseRules: ParseRule[] = [
  {
    id: 'default-excel-rule',
    name: '通用Excel解析规则',
    description: '适用于标准Excel表格的解析规则',
    fileType: 'excel',
    fieldMappings: [
      { source: '外部编码', target: 'externalCode', type: 'direct' },
      { source: '收货门店', target: 'storeName', type: 'direct' },
      { source: '收件人姓名', target: 'recipientName', type: 'direct' },
      { source: '收件人电话', target: 'recipientPhone', type: 'direct' },
      { source: '收件人地址', target: 'recipientAddress', type: 'direct' },
      { source: 'SKU物品编码', target: 'skuCode', type: 'direct' },
      { source: 'SKU物品名称', target: 'skuName', type: 'direct' },
      { source: 'SKU发货数量', target: 'quantity', type: 'direct' },
      { source: 'SKU规格型号', target: 'spec', type: 'direct' },
      { source: '备注', target: 'remark', type: 'direct' },
    ],
    sections: [
      {
        id: 'body-section',
        name: '数据区域',
        type: 'body',
        startRow: 2,
        endRow: 0,
        startCol: 1,
        endCol: 0,
        skipRows: [],
        skipCols: [],
        hasHeader: true,
        headerRow: 1,
      },
    ],
    aggregation: {
      enabled: true,
      groupByField: 'externalCode',
      aggregateFields: ['skuCode', 'skuName', 'quantity'],
      mergeStrategy: 'concat',
    },
    matrix: {
      enabled: false,
      rowHeaders: [],
      colHeaders: [],
      dataStartRow: 1,
      dataStartCol: 1,
      valueSeparator: '|',
    },
    card: {
      enabled: false,
      startPattern: '',
      endPattern: '',
      cardSeparator: '',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function createTables() {
  console.log('🧪 [Mock DB] createTables() - Skipping in local dev');
  // Do nothing for mock
}

export async function saveOrder(order: Order): Promise<void> {
  console.log('🧪 [Mock DB] saveOrder():', order.id);
  const existingIndex = mockOrders.findIndex(o => o.id === order.id);
  if (existingIndex >= 0) {
    mockOrders[existingIndex] = order;
  } else {
    mockOrders.push(order);
  }
}

export async function saveOrders(orders: Order[]): Promise<void> {
  console.log('🧪 [Mock DB] saveOrders():', orders.length, 'orders');
  for (const order of orders) {
    await saveOrder(order);
  }
}

export async function getOrders(filter: OrderQueryFilter, page: number, pageSize: number): Promise<PaginatedResult<Order>> {
  console.log('🧪 [Mock DB] getOrders():', { filter, page, pageSize });
  
  let filteredOrders = [...mockOrders];
  
  if (filter.externalCode) {
    const searchCode = filter.externalCode.toLowerCase();
    filteredOrders = filteredOrders.filter(o => 
      o.externalCode?.toLowerCase().includes(searchCode)
    );
  }
  
  if (filter.recipientName) {
    const searchName = filter.recipientName.toLowerCase();
    filteredOrders = filteredOrders.filter(o => 
      o.recipientName?.toLowerCase().includes(searchName)
    );
  }
  
  if (filter.startDate) {
    const startDate = new Date(filter.startDate);
    filteredOrders = filteredOrders.filter(o => 
      o.createdAt >= startDate
    );
  }
  
  if (filter.endDate) {
    const endDate = new Date(filter.endDate);
    filteredOrders = filteredOrders.filter(o => 
      o.createdAt <= endDate
    );
  }
  
  // Sort by date desc
  filteredOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  const total = filteredOrders.length;
  const start = (page - 1) * pageSize;
  const items = filteredOrders.slice(start, start + pageSize);
  
  return {
    items,
    total,
    page,
    pageSize,
  };
}

export async function getOrderById(id: string): Promise<Order | null> {
  console.log('🧪 [Mock DB] getOrderById():', id);
  return mockOrders.find(o => o.id === id) || null;
}

export async function deleteOrder(id: string): Promise<boolean> {
  console.log('🧪 [Mock DB] deleteOrder():', id);
  const initialLength = mockOrders.length;
  mockOrders = mockOrders.filter(o => o.id !== id);
  return mockOrders.length < initialLength;
}

export async function saveParseRule(rule: ParseRule): Promise<void> {
  console.log('🧪 [Mock DB] saveParseRule():', rule.id);
  const existingIndex = mockParseRules.findIndex(r => r.id === rule.id);
  if (existingIndex >= 0) {
    mockParseRules[existingIndex] = rule;
  } else {
    mockParseRules.push(rule);
  }
}

export async function getParseRules(): Promise<ParseRule[]> {
  console.log('🧪 [Mock DB] getParseRules():', mockParseRules.length, 'rules');
  return [...mockParseRules];
}

export async function getParseRuleById(id: string): Promise<ParseRule | null> {
  console.log('🧪 [Mock DB] getParseRuleById():', id);
  return mockParseRules.find(r => r.id === id) || null;
}

export async function deleteParseRule(id: string): Promise<boolean> {
  console.log('🧪 [Mock DB] deleteParseRule():', id);
  const initialLength = mockParseRules.length;
  mockParseRules = mockParseRules.filter(r => r.id !== id);
  return mockParseRules.length < initialLength;
}

export async function checkDuplicateExternalCode(externalCode: string): Promise<boolean> {
  console.log('🧪 [Mock DB] checkDuplicateExternalCode():', externalCode);
  return mockOrders.some(o => o.externalCode === externalCode);
}

export async function getExistingExternalCodes(): Promise<string[]> {
  console.log('🧪 [Mock DB] getExistingExternalCodes()');
  return mockOrders.map(o => o.externalCode).filter(Boolean) as string[];
}
