// app/api/rules/route.ts
// Parse Rules API: GET all, POST create

import { NextRequest, NextResponse } from 'next/server';
import { saveParseRule, getParseRules } from '@/lib/db';
import { ParseRule } from '@/lib/types';

export async function GET() {
  try {
    const rules = await getParseRules();
    return NextResponse.json({ success: true, data: rules });
  } catch (error: any) {
    console.error('Error getting rules:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rule: ParseRule = body;
    
    rule.createdAt = new Date(rule.createdAt);
    rule.updatedAt = new Date(rule.updatedAt);
    
    await saveParseRule(rule);
    
    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error: any) {
    console.error('Error saving rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save rule' },
      { status: 500 }
    );
  }
}