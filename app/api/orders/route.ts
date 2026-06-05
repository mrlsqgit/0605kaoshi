// app/api/orders/route.ts
// Orders API: GET all, POST create

import { NextRequest, NextResponse } from 'next/server';
import { saveOrders, getOrders, getExistingExternalCodes } from '@/lib/db';
import { Order, OrderQueryFilter, ParsedOrder, OrderItem } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter: OrderQueryFilter = {};
    
    const externalCode = searchParams.get('externalCode');
    const recipientName = searchParams.get('recipientName');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (externalCode) filter.externalCode = externalCode;
    if (recipientName) filter.recipientName = recipientName;
    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;
    
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    
    const result = await getOrders(filter, page, pageSize);
    
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error getting orders:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedOrders: ParsedOrder[] = body.orders;
    
    if (!parsedOrders || parsedOrders.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No orders provided' },
        { status: 400 }
      );
    }
    
    const existingCodes = await getExistingExternalCodes();
    
    const orders: Order[] = parsedOrders.map(parsed => {
      const items: OrderItem[] = [{
        id: uuidv4(),
        skuCode: parsed.skuCode,
        skuName: parsed.skuName,
        quantity: parsed.quantity,
        spec: parsed.spec,
        remark: parsed.remark,
      }];
      
      return {
        id: parsed.id || uuidv4(),
        externalCode: parsed.externalCode,
        storeName: parsed.storeName,
        recipientName: parsed.recipientName,
        recipientPhone: parsed.recipientPhone,
        recipientAddress: parsed.recipientAddress,
        items,
        createdAt: new Date(),
      };
    });
    
    await saveOrders(orders);
    
    return NextResponse.json({
      success: true,
      data: {
        count: orders.length,
        duplicates: orders.filter(o => existingCodes.includes(o.externalCode)).length,
      },
    });
  } catch (error: any) {
    console.error('Error creating orders:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create orders' },
      { status: 500 }
    );
  }
}