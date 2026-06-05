// app/api/analyze/route.ts
// LLM Analysis API for generating parse rules

import { NextRequest, NextResponse } from 'next/server';
import { analyzeFileAndGenerateRule } from '@/lib/llm';
import { parseExcel, parseWord, parsePdf } from '@/lib/parser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    let fileContent = '';
    let fileType: 'excel' | 'word' | 'pdf' = 'excel';
    
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const result = await parseExcel(file);
      fileContent = JSON.stringify(result);
      fileType = 'excel';
    } else if (fileExtension === 'docx') {
      fileContent = await parseWord(file);
      fileType = 'word';
    } else if (fileExtension === 'pdf') {
      fileContent = await parsePdf(file);
      fileType = 'pdf';
    } else {
      return NextResponse.json(
        { success: false, error: 'Unsupported file format' },
        { status: 400 }
      );
    }
    
    const rule = await analyzeFileAndGenerateRule(fileName, fileContent, fileType);
    
    return NextResponse.json({ success: true, data: rule });
  } catch (error: any) {
    console.error('Error analyzing file:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to analyze file' },
      { status: 500 }
    );
  }
}