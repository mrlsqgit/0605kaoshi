// lib/parser.ts
// File parsing utilities for Excel, Word, and PDF files

import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { ParseRule, ParsedOrder, ValidationError } from './types';
import { v4 as uuidv4 } from 'uuid';

export async function parseExcel(file: File): Promise<{ sheets: string[][][]; sheetNames: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  const sheets: string[][][] = [];
  const sheetNames: string[] = [];
  
  workbook.SheetNames.forEach((name) => {
    const worksheet = workbook.Sheets[name];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as unknown[][];
    
    const stringData: string[][] = jsonData.map((row) =>
      (row as unknown[]).map((cell) => {
        if (cell === null || cell === undefined) return '';
        return String(cell);
      })
    );
    
    sheets.push(stringData);
    sheetNames.push(name);
  });
  
  return { sheets, sheetNames };
}

export async function parseWord(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch {
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    return textDecoder.decode(arrayBuffer);
  }
}

export async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const pdfjs = await import('pdfjs-dist');
    await pdfjs.GlobalWorkerOptions.workerSrc;
    
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join('\n');
      text += `[Page ${i}]\n${pageText}\n\n`;
    }
    
    return text;
  } catch (error) {
    console.error('PDF parsing failed:', error);
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    return textDecoder.decode(arrayBuffer);
  }
}

export async function parseFile(file: File): Promise<{ type: string; content: string | { sheets: string[][][]; sheetNames: string[] } }> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const result = await parseExcel(file);
    return { type: 'excel', content: result };
  }
  
  if (fileName.endsWith('.docx')) {
    const text = await parseWord(file);
    return { type: 'word', content: text };
  }
  
  if (fileName.endsWith('.pdf')) {
    const text = await parsePdf(file);
    return { type: 'pdf', content: text };
  }
  
  throw new Error('Unsupported file format');
}

export function executeParseRule(rule: ParseRule, fileContent: any): ParsedOrder[] {
  const orders: ParsedOrder[] = [];
  
  if (rule.fileType === 'excel') {
    return parseExcelWithRule(rule, fileContent);
  }
  
  if (rule.fileType === 'word') {
    return parseWordWithRule(rule, fileContent);
  }
  
  if (rule.fileType === 'pdf') {
    return parsePdfWithRule(rule, fileContent);
  }
  
  return orders;
}

function parseExcelWithRule(rule: ParseRule, content: { sheets: string[][][]; sheetNames: string[] }): ParsedOrder[] {
  const orders: ParsedOrder[] = [];
  
  content.sheets.forEach((sheet, sheetIndex) => {
    const bodySection = rule.sections.find(s => s.type === 'body');
    if (!bodySection) return;
    
    const effectiveStartRow = Math.max(0, bodySection.startRow - 1);
    const effectiveEndRow = bodySection.endRow > 0 ? bodySection.endRow - 1 : sheet.length - 1;
    
    const headerRowIndex = bodySection.headerRow - 1;
    const headers: { [key: string]: number } = {};
    
    if (bodySection.hasHeader && headerRowIndex >= 0 && headerRowIndex < sheet.length) {
      sheet[headerRowIndex].forEach((cell, colIndex) => {
        if (cell) {
          headers[cell.trim()] = colIndex;
        }
      });
    }
    
    for (let rowIndex = effectiveStartRow; rowIndex <= effectiveEndRow; rowIndex++) {
      if (bodySection.skipRows.includes(rowIndex + 1)) continue;
      
      const row = sheet[rowIndex];
      if (!row || row.every(cell => cell.trim() === '')) continue;
      
      const order = createOrderFromRow(row, headers, rule.fieldMappings, rowIndex);
      if (order) {
        orders.push(order);
      }
    }
  });
  
  return applyAggregation(orders, rule);
}

function parseWordWithRule(rule: ParseRule, content: string): ParsedOrder[] {
  const orders: ParsedOrder[] = [];
  
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  let currentOrder: Partial<ParsedOrder> = {};
  let inItemSection = false;
  
  lines.forEach((line, index) => {
    if (line.includes('━━━') || line.includes('------')) {
      if (currentOrder.skuCode || currentOrder.skuName) {
        const order = validateOrder(currentOrder, index);
        if (order) orders.push(order);
      }
      currentOrder = {};
      inItemSection = false;
      return;
    }
    
    const mapping = rule.fieldMappings.find(m => 
      line.includes(m.source) || (m.pattern && new RegExp(m.pattern).test(line))
    );
    
    if (mapping) {
      const value = extractValueFromLine(line, mapping);
      (currentOrder as any)[mapping.target] = value;
      
      if (mapping.target === 'skuCode' || mapping.target === 'skuName') {
        inItemSection = true;
      }
    } else if (inItemSection && line.trim()) {
      const itemMatch = line.match(/(\d+)\.\s*([^\|]+)\|\s*([^\|]+)\|\s*([^\|]+)\|\s*([^\|]+)/);
      if (itemMatch) {
        currentOrder.skuCode = itemMatch[2]?.trim();
        currentOrder.skuName = itemMatch[3]?.trim();
        currentOrder.spec = itemMatch[4]?.trim();
        currentOrder.quantity = parseInt(itemMatch[5]?.trim()) || 1;
        
        const order = validateOrder(currentOrder, index);
        if (order) orders.push(order);
        currentOrder = { ...currentOrder, skuCode: undefined, skuName: undefined };
      }
    }
  });
  
  if (currentOrder.skuCode || currentOrder.skuName) {
    const order = validateOrder(currentOrder, lines.length);
    if (order) orders.push(order);
  }
  
  return orders;
}

function parsePdfWithRule(rule: ParseRule, content: string): ParsedOrder[] {
  const orders: ParsedOrder[] = [];
  
  const pages = content.split(/\[Page \d+\]/).filter(p => p.trim());
  
  pages.forEach((page, pageIndex) => {
    const lines = page.split('\n').filter(line => line.trim() !== '');
    
    const order: ParsedOrder = {
      id: uuidv4(),
      externalCode: '',
      storeName: '',
      recipientName: '',
      recipientPhone: '',
      recipientAddress: '',
      skuCode: '',
      skuName: '',
      quantity: 1,
      spec: '',
      remark: '',
      rowIndex: pageIndex,
      errors: [],
    };
    
    let inTable = false;
    const items: { skuCode: string; skuName: string; quantity: number; spec: string }[] = [];
    
    lines.forEach((line, lineIndex) => {
      if (line.includes('合计') || line.includes('签名')) {
        inTable = false;
        return;
      }
      
      if (line.includes('物品') || line.includes('商品')) {
        inTable = true;
        return;
      }
      
      const mapping = rule.fieldMappings.find(m => line.includes(m.source));
      if (mapping) {
        const value = extractValueFromLine(line, mapping);
        (order as any)[mapping.target] = value;
      }
      
      if (inTable && line.trim()) {
        const parts = line.split(/\s{2,}/).filter(p => p.trim());
        if (parts.length >= 3) {
          items.push({
            skuCode: parts[0]?.trim() || '',
            skuName: parts[1]?.trim() || '',
            spec: parts.slice(2, -1).join(' ') || '',
            quantity: parseInt(parts[parts.length - 1]) || 1,
          });
        }
      }
    });
    
    if (items.length > 0) {
      items.forEach((item, i) => {
        orders.push({
          ...order,
          id: `${order.id}-${i}`,
          skuCode: item.skuCode,
          skuName: item.skuName,
          spec: item.spec,
          quantity: item.quantity,
          rowIndex: pageIndex * 100 + i,
          errors: validateOrderData({ ...order, ...item }),
        });
      });
    } else if (order.skuCode || order.skuName) {
      order.errors = validateOrderData(order);
      orders.push(order);
    }
  });
  
  return orders;
}

function createOrderFromRow(row: string[], headers: { [key: string]: number }, mappings: any[], rowIndex: number): ParsedOrder | null {
  const order: ParsedOrder = {
    id: uuidv4(),
    externalCode: '',
    storeName: '',
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    skuCode: '',
    skuName: '',
    quantity: 1,
    spec: '',
    remark: '',
    rowIndex: rowIndex + 1,
    errors: [],
  };
  
  let hasData = false;
  
  mappings.forEach(mapping => {
    let value = '';
    
    if (mapping.isStatic && mapping.staticValue) {
      value = mapping.staticValue;
    } else {
      const colIndex = headers[mapping.source];
      if (colIndex !== undefined && row[colIndex]) {
        value = row[colIndex].trim();
      } else if (mapping.defaultValue) {
        value = mapping.defaultValue;
      }
    }
    
    if (mapping.type === 'regex' && mapping.pattern) {
      const match = row.join('|').match(new RegExp(mapping.pattern));
      if (match) {
        value = match[1] || value;
      }
    }
    
    if (mapping.target === 'quantity') {
      order.quantity = parseFloat(value) || 1;
    } else {
      (order as any)[mapping.target] = value;
    }
    
    if (value) hasData = true;
  });
  
  if (!hasData) return null;
  
  order.errors = validateOrderData(order);
  return order;
}

function extractValueFromLine(line: string, mapping: any): string {
  if (mapping.isStatic && mapping.staticValue) {
    return mapping.staticValue;
  }
  
  if (mapping.pattern) {
    const match = line.match(new RegExp(mapping.pattern));
    if (match) {
      return match[1] || '';
    }
  }
  
  const parts = line.split(mapping.source);
  if (parts.length > 1) {
    return parts[1].trim();
  }
  
  return '';
}

function validateOrderData(order: Partial<ParsedOrder>): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!order.skuCode || !order.skuCode.trim()) {
    errors.push({ field: 'skuCode', message: 'SKU物品编码不能为空' });
  }
  
  if (!order.skuName || !order.skuName.trim()) {
    errors.push({ field: 'skuName', message: 'SKU物品名称不能为空' });
  }
  
  if (!order.quantity || order.quantity <= 0) {
    errors.push({ field: 'quantity', message: 'SKU发货数量必须为正数' });
  }
  
  const hasGroupA = order.storeName && order.storeName.trim();
  const hasRecipientName = order.recipientName && order.recipientName.trim();
  const hasRecipientPhone = order.recipientPhone && order.recipientPhone.trim();
  const hasRecipientAddress = order.recipientAddress && order.recipientAddress.trim();
  const hasGroupB = hasRecipientName && hasRecipientPhone && hasRecipientAddress;
  
  if (!hasGroupA && !hasGroupB) {
    errors.push({ field: 'storeName', message: 'A组/B组至少填写一组（A组：收货门店；B组：收件人姓名+电话+地址）' });
  }
  
  if (hasRecipientName || hasRecipientPhone || hasRecipientAddress) {
    if (!hasRecipientName) {
      errors.push({ field: 'recipientName', message: 'B组模式下收件人姓名不能为空' });
    }
    if (!hasRecipientPhone) {
      errors.push({ field: 'recipientPhone', message: 'B组模式下收件人电话不能为空' });
    } else if (!/^1[3-9]\d{9}$/.test(order.recipientPhone!.replace(/\s/g, ''))) {
      errors.push({ field: 'recipientPhone', message: '收件人电话格式不正确（应为11位手机号）' });
    }
    if (!hasRecipientAddress) {
      errors.push({ field: 'recipientAddress', message: 'B组模式下收件人地址不能为空' });
    }
  }
  
  return errors;
}

function validateOrder(order: Partial<ParsedOrder>, rowIndex: number): ParsedOrder | null {
  const filledOrder: ParsedOrder = {
    id: order.id || uuidv4(),
    externalCode: order.externalCode || '',
    storeName: order.storeName || '',
    recipientName: order.recipientName || '',
    recipientPhone: order.recipientPhone || '',
    recipientAddress: order.recipientAddress || '',
    skuCode: order.skuCode || '',
    skuName: order.skuName || '',
    quantity: order.quantity || 1,
    spec: order.spec || '',
    remark: order.remark || '',
    rowIndex: rowIndex + 1,
    errors: [],
  };
  
  filledOrder.errors = validateOrderData(filledOrder);
  
  if (!filledOrder.skuCode && !filledOrder.skuName) return null;
  
  return filledOrder;
}

function applyAggregation(orders: ParsedOrder[], rule: ParseRule): ParsedOrder[] {
  if (!rule.aggregation.enabled || !rule.aggregation.groupByField) {
    return orders;
  }
  
  const groups: { [key: string]: ParsedOrder[] } = {};
  
  orders.forEach(order => {
    const key = (order as any)[rule.aggregation.groupByField] || 'NO_GROUP';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(order);
  });
  
  const result: ParsedOrder[] = [];
  
  Object.values(groups).forEach(group => {
    const firstOrder = group[0];
    
    rule.aggregation.aggregateFields.forEach(field => {
      const values = group.map(o => (o as any)[field]).filter(v => v);
      let aggregatedValue = '';
      
      switch (rule.aggregation.mergeStrategy) {
        case 'first':
          aggregatedValue = values[0] || '';
          break;
        case 'last':
          aggregatedValue = values[values.length - 1] || '';
          break;
        case 'concat':
          aggregatedValue = Array.from(new Set(values)).join(', ');
          break;
      }
      
      (firstOrder as any)[field] = aggregatedValue;
    });
    
    result.push(firstOrder);
  });
  
  return result;
}

export function validateAllOrders(orders: ParsedOrder[]): ParsedOrder[] {
  return orders.map(order => ({
    ...order,
    errors: validateOrderData(order),
  }));
}