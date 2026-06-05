// app/api/rules/[id]/route.ts
// Single Rule API: GET, PUT, DELETE

import { NextResponse } from 'next/server';
import { getParseRuleById, saveParseRule, deleteParseRule } from '@/lib/db';
import { ParseRule } from '@/lib/types';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const rule = await getParseRuleById(params.id);
    
    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: rule });
  } catch (error: any) {
    console.error('Error getting rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get rule' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const rule: ParseRule = body;
    
    rule.id = params.id;
    rule.createdAt = new Date(rule.createdAt);
    rule.updatedAt = new Date();
    
    await saveParseRule(rule);
    
    return NextResponse.json({ success: true, data: rule });
  } catch (error: any) {
    console.error('Error updating rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteParseRule(params.id);
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete rule' },
      { status: 500 }
    );
  }
}