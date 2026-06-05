// lib/db.ts
// Database connection and operations using Neon

import { neon, neonConfig } from '@neondatabase/serverless';
import { Order, ParseRule, OrderQueryFilter, PaginatedResult } from './types';

neonConfig.fetchConnectionCache = true;

const sql = neon(process.env.DATABASE_URL!);

export async function createTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        external_code TEXT,
        store_name TEXT,
        recipient_name TEXT,
        recipient_phone TEXT,
        recipient_address TEXT,
        items JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS parse_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        file_type TEXT NOT NULL,
        field_mappings JSONB,
        sections JSONB,
        aggregation JSONB,
        matrix JSONB,
        card JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_orders_external_code ON orders(external_code);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_orders_recipient_name ON orders(recipient_name);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    `;
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

export async function saveOrder(order: Order): Promise<void> {
  try {
    await sql`
      INSERT INTO orders (
        id,
        external_code,
        store_name,
        recipient_name,
        recipient_phone,
        recipient_address,
        items,
        created_at
      ) VALUES (
        ${order.id},
        ${order.externalCode},
        ${order.storeName},
        ${order.recipientName},
        ${order.recipientPhone},
        ${order.recipientAddress},
        ${JSON.stringify(order.items)},
        ${order.createdAt}
      )
    `;
  } catch (error) {
    console.error('Error saving order:', error);
    throw error;
  }
}

export async function saveOrders(orders: Order[]): Promise<void> {
  try {
    for (const order of orders) {
      await saveOrder(order);
    }
  } catch (error) {
    console.error('Error saving orders:', error);
    throw error;
  }
}

export async function getOrders(filter: OrderQueryFilter, page: number, pageSize: number): Promise<PaginatedResult<Order>> {
  try {
    // 收集所有查询条件
    const conditions: any[] = [];
    
    if (filter.externalCode) {
      conditions.push(sql`external_code LIKE ${`%${filter.externalCode}%`}`);
    }
    
    if (filter.recipientName) {
      conditions.push(sql`recipient_name LIKE ${`%${filter.recipientName}%`}`);
    }
    
    if (filter.startDate) {
      conditions.push(sql`created_at >= ${filter.startDate}`);
    }
    
    if (filter.endDate) {
      conditions.push(sql`created_at <= ${filter.endDate}`);
    }
    
    // 拼接 WHERE 条件
    let whereClause = sql``;
    if (conditions.length > 0) {
      whereClause = conditions.reduce((acc, cur, idx) => 
        idx === 0 ? sql`${cur}` : sql`${acc} AND ${cur}`
      );
    }
    
    // 查询总数
    let countQuery = sql`SELECT COUNT(*) as count FROM orders`;
    if (conditions.length > 0) {
      countQuery = sql`${countQuery} WHERE ${whereClause}`;
    }
    const totalResult = await countQuery;
    const total = parseInt(totalResult.rows[0].count as string);
    
    // 查询数据列表
    let dataQuery = sql`SELECT * FROM orders`;
    if (conditions.length > 0) {
      dataQuery = sql`${dataQuery} WHERE ${whereClause}`;
    }
    dataQuery = sql`${dataQuery} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    
    const result = await dataQuery;
    
    const orders: Order[] = result.rows.map((row: any) => ({
      id: row.id,
      externalCode: row.external_code,
      storeName: row.store_name,
      recipientName: row.recipient_name,
      recipientPhone: row.recipient_phone,
      recipientAddress: row.recipient_address,
      items: JSON.parse(row.items),
      createdAt: new Date(row.created_at),
    }));
    
    return {
      items: orders,
      total,
      page,
      pageSize,
    };
  } catch (error) {
    console.error('Error getting orders:', error);
    throw error;
  }
}

export async function getOrderById(id: string): Promise<Order | null> {
  try {
    const result = await sql`SELECT * FROM orders WHERE id = ${id}`;
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      externalCode: row.external_code,
      storeName: row.store_name,
      recipientName: row.recipient_name,
      recipientPhone: row.recipient_phone,
      recipientAddress: row.recipient_address,
      items: JSON.parse(row.items),
      createdAt: new Date(row.created_at),
    };
  } catch (error) {
    console.error('Error getting order by id:', error);
    throw error;
  }
}

export async function deleteOrder(id: string): Promise<boolean> {
  try {
    const result = await sql`DELETE FROM orders WHERE id = ${id}`;
    return result.rowCount !== undefined && result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting order:', error);
    throw error;
  }
}

export async function saveParseRule(rule: ParseRule): Promise<void> {
  try {
    await sql`
      INSERT INTO parse_rules (
        id,
        name,
        description,
        file_type,
        field_mappings,
        sections,
        aggregation,
        matrix,
        card,
        created_at,
        updated_at
      ) VALUES (
        ${rule.id},
        ${rule.name},
        ${rule.description},
        ${rule.fileType},
        ${JSON.stringify(rule.fieldMappings)},
        ${JSON.stringify(rule.sections)},
        ${JSON.stringify(rule.aggregation)},
        ${JSON.stringify(rule.matrix)},
        ${JSON.stringify(rule.card)},
        ${rule.createdAt},
        ${rule.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        file_type = EXCLUDED.file_type,
        field_mappings = EXCLUDED.field_mappings,
        sections = EXCLUDED.sections,
        aggregation = EXCLUDED.aggregation,
        matrix = EXCLUDED.matrix,
        card = EXCLUDED.card,
        updated_at = EXCLUDED.updated_at
    `;
  } catch (error) {
    console.error('Error saving parse rule:', error);
    throw error;
  }
}

export async function getParseRules(): Promise<ParseRule[]> {
  try {
    const result = await sql`SELECT * FROM parse_rules ORDER BY created_at DESC`;
    
    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      fileType: row.file_type,
      fieldMappings: JSON.parse(row.field_mappings),
      sections: JSON.parse(row.sections),
      aggregation: JSON.parse(row.aggregation),
      matrix: JSON.parse(row.matrix),
      card: JSON.parse(row.card),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  } catch (error) {
    console.error('Error getting parse rules:', error);
    throw error;
  }
}

export async function getParseRuleById(id: string): Promise<ParseRule | null> {
  try {
    const result = await sql`SELECT * FROM parse_rules WHERE id = ${id}`;
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      fileType: row.file_type,
      fieldMappings: JSON.parse(row.field_mappings),
      sections: JSON.parse(row.sections),
      aggregation: JSON.parse(row.aggregation),
      matrix: JSON.parse(row.matrix),
      card: JSON.parse(row.card),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    console.error('Error getting parse rule by id:', error);
    throw error;
  }
}

export async function deleteParseRule(id: string): Promise<boolean> {
  try {
    const result = await sql`DELETE FROM parse_rules WHERE id = ${id}`;
    return result.rowCount !== undefined && result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting parse rule:', error);
    throw error;
  }
}

export async function checkDuplicateExternalCode(externalCode: string): Promise<boolean> {
  try {
    const result = await sql`SELECT 1 FROM orders WHERE external_code = ${externalCode}`;
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking duplicate external code:', error);
    throw error;
  }
}

export async function getExistingExternalCodes(): Promise<string[]> {
  try {
    const result = await sql`SELECT external_code FROM orders WHERE external_code IS NOT NULL`;
    return result.rows.map((row: any) => row.external_code);
  } catch (error) {
    console.error('Error getting existing external codes:', error);
    throw error;
  }
}