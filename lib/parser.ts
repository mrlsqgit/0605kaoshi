// lib/parser.ts
// File parsing utilities for Excel, Word, and PDF files

import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { ParseRule, ParsedOrder, ValidationError } from './types';
import { v4 as uuidv4 } from 'uuid';

export async function parseExcel(file: File): Promise<{ sheets: string[][][]; sheetNames: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { 
    type: 'array',
    cellDates: false,
    cellNF: false,
    cellHTML: false,
    raw: true
  });
  
  const sheets: string[][][] = [];
  const sheetNames: string[] = [];
  
  workbook.SheetNames.forEach((name) => {
    const worksheet = workbook.Sheets[name];
    
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const rowCount = range.e.r + 1;
    const colCount = range.e.c + 1;
    
    const stringData: string[][] = [];
    
    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      const row: string[] = [];
      for (let colIdx = 0; colIdx < colCount; colIdx++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
        const cell = worksheet[cellAddress];
        
        if (!cell) {
          row.push('');
          continue;
        }
        
        if (cell.t === 'n') {
          const numValue = cell.v as number;
          if (Number.isInteger(numValue)) {
            row.push(String(numValue));
          } else {
            row.push(String(numValue));
          }
        } else {
          row.push(String(cell.v) || '');
        }
      }
      
      if (row.some(cell => cell.trim())) {
        stringData.push(row);
      }
    }
    
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
    const sheetName = content.sheetNames[sheetIndex];
    
    if (rule.matrix.enabled) {
      const matrixOrders = parseMatrixExcel(sheet, sheetName, rule);
      orders.push(...matrixOrders);
    } else if (rule.card.enabled) {
      const cardOrders = parseCardExcel(sheet, sheetName, rule);
      orders.push(...cardOrders);
    } else {
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
          order.externalCode = order.externalCode || sheetName;
          orders.push(order);
        }
      }
    }
  });
  
  return applyAggregation(orders, rule);
}

function parseMatrixExcel(sheet: string[][], sheetName: string, rule: ParseRule): ParsedOrder[] {
  const orders: ParsedOrder[] = [];
  const { rowHeaders, colHeaders, dataStartRow, dataStartCol, valueSeparator } = rule.matrix;
  
  const rowHeaderLabels: string[] = [];
  rowHeaders.forEach(rowIdx => {
    if (rowIdx - 1 >= 0 && rowIdx - 1 < sheet.length) {
      rowHeaderLabels.push(sheet[rowIdx - 1].join(valueSeparator));
    }
  });
  
  const colHeaderLabels: string[] = [];
  if (colHeaders.length > 0) {
    colHeaders.forEach(colIdx => {
      const values: string[] = [];
      for (let r = 0; r < sheet.length && r < dataStartRow - 1; r++) {
        if (sheet[r] && sheet[r][colIdx - 1]) {
          values.push(sheet[r][colIdx - 1]);
        }
      }
      colHeaderLabels.push(values.join(valueSeparator));
    });
  } else {
    const headerRow = dataStartRow - 2 >= 0 ? sheet[dataStartRow - 2] : [];
    for (let c = dataStartCol - 1; c < (sheet[0]?.length || 0); c++) {
      colHeaderLabels.push(headerRow[c] || `Column ${c + 1}`);
    }
  }
  
  for (let rowIdx = dataStartRow - 1; rowIdx < sheet.length; rowIdx++) {
    const row = sheet[rowIdx];
    if (!row || row.every(cell => cell.trim() === '')) continue;
    
    const rowLabel = row[0]?.trim() || '';
    if (!rowLabel) continue;
    
    for (let colIdx = dataStartCol - 1; colIdx < row.length; colIdx++) {
      const value = row[colIdx]?.trim();
      if (!value || parseFloat(value) <= 0) continue;
      
      const order: ParsedOrder = {
        id: uuidv4(),
        externalCode: sheetName,
        storeName: rowHeaderLabels.join(' ') || '',
        recipientName: '',
        recipientPhone: '',
        recipientAddress: '',
        skuCode: colHeaderLabels[colIdx - dataStartCol + 1] || `SKU_${colIdx + 1}`,
        skuName: colHeaderLabels[colIdx - dataStartCol + 1] || `Item_${colIdx + 1}`,
        quantity: parseFloat(value) || 1,
        spec: rowLabel,
        remark: '',
        rowIndex: rowIdx + 1,
        errors: [],
      };
      
      order.errors = validateOrderData(order);
      orders.push(order);
    }
  }
  
  return orders;
}

function parseCardExcel(sheet: string[][], sheetName: string, rule: ParseRule): ParsedOrder[] {
  const orders: ParsedOrder[] = [];
  const { startPattern, endPattern, cardSeparator } = rule.card;
  
  let currentCard: string[] = [];
  let inCard = false;
  
  for (let rowIdx = 0; rowIdx < sheet.length; rowIdx++) {
    const row = sheet[rowIdx];
    const rowText = row.join('|');
    
    if (startPattern && rowText.includes(startPattern)) {
      inCard = true;
      currentCard = [];
    }
    
    if (inCard) {
      currentCard.push(rowText);
    }
    
    if (endPattern && rowText.includes(endPattern)) {
      inCard = false;
      
      if (currentCard.length > 0) {
        const cardOrders = parseSingleCard(currentCard, sheetName, rule);
        orders.push(...cardOrders);
      }
      currentCard = [];
    }
  }
  
  if (currentCard.length > 0) {
    const cardOrders = parseSingleCard(currentCard, sheetName, rule);
    orders.push(...cardOrders);
  }
  
  return orders;
}

function parseSingleCard(cardLines: string[], sheetName: string, rule: ParseRule): ParsedOrder[] {
  const orders: ParsedOrder[] = [];
  
  const order: ParsedOrder = {
    id: uuidv4(),
    externalCode: sheetName,
    storeName: '',
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    skuCode: '',
    skuName: '',
    quantity: 1,
    spec: '',
    remark: '',
    rowIndex: 0,
    errors: [],
  };
  
  const items: { skuCode: string; skuName: string; quantity: number; spec: string }[] = [];
  
  cardLines.forEach(line => {
    const mapping = rule.fieldMappings.find(m => 
      line.includes(m.source) || (m.pattern && new RegExp(m.pattern).test(line))
    );
    
    if (mapping) {
      const value = extractValueFromLine(line, mapping);
      if (mapping.target === 'skuCode' || mapping.target === 'skuName') {
        items.push({ skuCode: '', skuName: '', quantity: 1, spec: '' });
        (items[items.length - 1] as any)[mapping.target] = value;
      } else {
        (order as any)[mapping.target] = value;
      }
    } else {
      const qtyMatch = line.match(/(\d+)\s*[件个]/);
      if (qtyMatch && items.length > 0) {
        items[items.length - 1].quantity = parseInt(qtyMatch[1]) || 1;
      }
      
      const specMatch = line.match(/规格[：:]\s*(.+)/);
      if (specMatch && items.length > 0) {
        items[items.length - 1].spec = specMatch[1].trim();
      }
    }
  });
  
  if (items.length > 0) {
    items.forEach((item, idx) => {
      const itemOrder = {
        ...order,
        id: `${order.id}-${idx}`,
        skuCode: item.skuCode || order.skuCode,
        skuName: item.skuName || order.skuName,
        quantity: item.quantity,
        spec: item.spec || order.spec,
        rowIndex: idx + 1,
      };
      itemOrder.errors = validateOrderData(itemOrder);
      orders.push(itemOrder);
    });
  } else if (order.skuCode || order.skuName) {
    order.errors = validateOrderData(order);
    orders.push(order);
  }
  
  return orders;
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
    let key = (order as any)[rule.aggregation.groupByField] || 'NO_GROUP';
    if (key === 'NO_GROUP') {
      key = `${order.storeName || 'NO_STORE'}_${order.externalCode || 'NO_CODE'}`;
    }
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(order);
  });
  
  const result: ParsedOrder[] = [];
  
  Object.values(groups).forEach(group => {
    if (group.length === 1) {
      result.push(group[0]);
      return;
    }
    
    const firstOrder = { ...group[0] };
    
    const sharedFields: (keyof ParsedOrder)[] = [
      'externalCode', 
      'storeName', 
      'recipientName', 
      'recipientPhone', 
      'recipientAddress',
      'remark'
    ];
    
    sharedFields.forEach(field => {
      const values = group.map(o => (o as any)[field]).filter(v => v && v.trim());
      const uniqueValues = Array.from(new Set(values));
      
      if (uniqueValues.length === 1) {
        (firstOrder as any)[field] = uniqueValues[0];
      } else if (uniqueValues.length > 1) {
        (firstOrder as any)[field] = uniqueValues.join(' / ');
      }
    });
    
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
        default:
          aggregatedValue = values[0] || '';
      }
      
      (firstOrder as any)[field] = aggregatedValue;
    });
    
    firstOrder.errors = validateOrderData(firstOrder);
    result.push(firstOrder);
  });
  
  return result;
}

export function validateAllOrders(orders: ParsedOrder[]): ParsedOrder[] {
  const result: ParsedOrder[] = [];
  
  for (let i = 0; i < orders.length; i += 100) {
    const batch = orders.slice(i, Math.min(i + 100, orders.length));
    const validatedBatch = batch.map(order => ({
      ...order,
      errors: validateOrderData(order),
    }));
    result.push(...validatedBatch);
  }
  
  return result;
}