// app/api/parse/route.ts
// Parse execution API with performance optimizations

import { NextRequest, NextResponse } from 'next/server';
import { executeParseRule, parseExcel, parseWord, parsePdf } from '@/lib/parser';
import { ParseRule, ParsedOrder } from '@/lib/types';

const MAX_ORDERS_PER_BATCH = 500;
const TIMEOUT_MS = 60000;

export const runtime = 'nodejs';
export const maxDuration = 60;

async function parseFileWithTimeout(file: File, fileExtension: string): Promise<any> {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('File parsing timeout')), TIMEOUT_MS);
  });

  const parsePromise = (async () => {
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      return parseExcel(file);
    } else if (fileExtension === 'docx') {
      return parseWord(file);
    } else if (fileExtension === 'pdf') {
      return parsePdf(file);
    } else {
      throw new Error('Unsupported file format');
    }
  })();

  return Promise.race([parsePromise, timeoutPromise]);
}

function processOrdersInBatches(
  orders: ParsedOrder[],
  batchSize: number
): ParsedOrder[] {
  const results: ParsedOrder[] = [];
  
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    results.push(...batch);
  }
  
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const ruleJson = formData.get('rule') as string;
    
    if (!file || !ruleJson) {
      return NextResponse.json(
        { success: false, error: 'File and rule are required' },
        { status: 400 }
      );
    }
    
    const fileName = file.name;
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    console.log(`parse API: Processing file: ${fileName}, size: ${file.size} bytes`);
    
    if (!fileExtension || !['xlsx', 'xls', 'docx', 'pdf'].includes(fileExtension)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported file format' },
        { status: 400 }
      );
    }
    
    const rule = JSON.parse(ruleJson) as ParseRule;
    console.log(`parse API: Rule name: ${rule.name}, fileType: ${rule.fileType}`);
    
    const fileContent = await parseFileWithTimeout(file, fileExtension);
    console.log(`parse API: File content parsed successfully, type: ${typeof fileContent}`);
    
    const orders: ParsedOrder[] = executeParseRule(rule, fileContent);
    console.log(`parse API: Orders found: ${orders.length}`);
    
    const processedOrders = processOrdersInBatches(orders, MAX_ORDERS_PER_BATCH);
    
    return NextResponse.json({
      success: true,
      data: {
        orders: processedOrders,
        count: processedOrders.length,
      },
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Parse-Count': String(processedOrders.length),
        'X-Processing-Time': Date.now().toString(),
      },
    });
  } catch (error: any) {
    console.error('Error parsing file:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to parse file' },
      { status: error.message === 'File parsing timeout' ? 408 : 500 }
    );
  }
}