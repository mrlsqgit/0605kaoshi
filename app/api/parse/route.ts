// app/api/parse/route.ts
// Parse execution API

import { NextRequest, NextResponse } from 'next/server';
import { executeParseRule, parseExcel, parseWord, parsePdf } from '@/lib/parser';
import { ParseRule, ParsedOrder } from '@/lib/types';

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
    
    const rule = JSON.parse(ruleJson) as ParseRule;
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    let fileContent: any;
    
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      fileContent = await parseExcel(file);
    } else if (fileExtension === 'docx') {
      fileContent = await parseWord(file);
    } else if (fileExtension === 'pdf') {
      fileContent = await parsePdf(file);
    } else {
      return NextResponse.json(
        { success: false, error: 'Unsupported file format' },
        { status: 400 }
      );
    }
    
    const orders: ParsedOrder[] = executeParseRule(rule, fileContent);
    
    return NextResponse.json({
      success: true,
      data: {
        orders,
        count: orders.length,
      },
    });
  } catch (error: any) {
    console.error('Error parsing file:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to parse file' },
      { status: 500 }
    );
  }
}