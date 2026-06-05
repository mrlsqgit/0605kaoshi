// lib/db.ts
// Database connection and operations using Neon
// Automatically falls back to mock database in development

import { Order, ParseRule, OrderQueryFilter, PaginatedResult } from './types';

let isMockMode = false;
let mockDb: any = null;

// Try to load Neon DB, fallback to mock if fails
async function initDatabase() {
  if (mockDb) {
    console.log('initDatabase: Database already initialized, mock mode:', isMockMode);
    return;
  }

  try {
    // Check if we should use mock mode based on environment
    const useMock = process.env.NODE_ENV === 'development' || 
                    !process.env.DATABASE_URL ||
                    process.env.USE_MOCK_DB === 'true';
    
    console.log('initDatabase: useMock:', useMock, 'NODE_ENV:', process.env.NODE_ENV, 'DATABASE_URL exists:', !!process.env.DATABASE_URL);
    
    if (useMock) {
      console.log('🧪 Using mock database for development');
      const mockModule = await import('./db-mock');
      // Properly map the mock module exports
      mockDb = {
        createTables: mockModule.createTables,
        saveOrder: mockModule.saveOrder,
        saveOrders: mockModule.saveOrders,
        getOrders: mockModule.getOrders,
        getOrderById: mockModule.getOrderById,
        deleteOrder: mockModule.deleteOrder,
        getExistingExternalCodes: mockModule.getExistingExternalCodes,
        saveParseRule: mockModule.saveParseRule,
        getParseRules: mockModule.getParseRules,
        getParseRuleById: mockModule.getParseRuleById,
        deleteParseRule: mockModule.deleteParseRule,
      };
      isMockMode = true;
      return;
    }

    // Try to initialize Neon
    const { neon, neonConfig } = await import('@neondatabase/serverless');
    neonConfig.fetchConnectionCache = true;
    const sql = neon(process.env.DATABASE_URL!);
    
    // Test the connection
    try {
      await sql`SELECT NOW()`;
      console.log('✅ Connected to real Neon database');
    } catch (connectionError) {
      console.error('❌ Failed to connect to Neon database:', connectionError);
      throw new Error('Database connection failed: ' + (connectionError as Error).message);
    }
    
    // Auto create tables if not exists - CRITICAL for production
    console.log('🔧 Creating database tables if not exists...');
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

      await sql`CREATE INDEX IF NOT EXISTS idx_orders_external_code ON orders(external_code);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_orders_recipient_name ON orders(recipient_name);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);`;
      console.log('✅ Database tables created/verified');
    } catch (tableError) {
      console.error('❌ Failed to create database tables:', tableError);
      throw new Error('Table creation failed: ' + (tableError as Error).message);
    }
    
    // Export real implementation
    mockDb = {
      createTables: async () => {
        // Tables are already created during initialization
        console.log('✅ Tables already created during initialization');
      },

      saveOrder: async (order: Order) => {
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
      },

      saveOrders: async (orders: Order[]) => {
        try {
          console.log('saveOrders: Starting to save', orders.length, 'orders');
          for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            console.log(`saveOrders: Saving order ${i + 1}/${orders.length}: id=${order.id}, externalCode=${order.externalCode}`);
            await mockDb.saveOrder(order);
          }
          console.log('saveOrders: Successfully saved all', orders.length, 'orders');
        } catch (error) {
          console.error('Error saving orders:', error);
          throw error;
        }
      },

      getOrders: async (filter: OrderQueryFilter, page: number, pageSize: number): Promise<PaginatedResult<Order>> => {
        try {
          // Handle no filter case separately for simplicity
          if (!filter.externalCode && !filter.recipientName && !filter.startDate && !filter.endDate) {
            // Simple query without filters
            const totalResult = await sql`SELECT COUNT(*) as count FROM orders` as Array<{ count: string }>;
            const total = parseInt(totalResult[0].count as string);
            
            const result = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}` as Array<Record<string, unknown>>;
            
            const parseJson = (value: any) => {
              if (typeof value === 'object') return value;
              if (typeof value === 'string') {
                try {
                  return JSON.parse(value);
                } catch {
                  return value;
                }
              }
              return value;
            };
            
            const orders: Order[] = result.map((row: any) => ({
              id: row.id,
              externalCode: row.external_code,
              storeName: row.store_name,
              recipientName: row.recipient_name,
              recipientPhone: row.recipient_phone,
              recipientAddress: row.recipient_address,
              items: parseJson(row.items),
              createdAt: new Date(row.created_at),
            }));
            
            return {
              items: orders,
              total,
              page,
              pageSize,
            };
          }
          
          // Build dynamic query with filters
          const conditions: string[] = [];
          const queryParams: any[] = [];
          
          if (filter.externalCode) {
            conditions.push('external_code LIKE $1');
            queryParams.push(`%${filter.externalCode}%`);
          }
          
          let paramIdx = queryParams.length;
          if (filter.recipientName) {
            conditions.push(`recipient_name LIKE $${++paramIdx}`);
            queryParams.push(`%${filter.recipientName}%`);
          }
          
          if (filter.startDate) {
            conditions.push(`created_at >= $${++paramIdx}`);
            queryParams.push(filter.startDate);
          }
          
          if (filter.endDate) {
            conditions.push(`created_at <= $${++paramIdx}`);
            queryParams.push(filter.endDate);
          }
          
          const whereClause = `WHERE ${conditions.join(' AND ')}`;
          
          // Use raw SQL query with parameter array
          const countQuery = `SELECT COUNT(*) as count FROM orders ${whereClause}`;
          const totalResult = await sql(countQuery, queryParams) as Array<{ count: string }>;
          const total = parseInt(totalResult[0].count as string);
          
          // Data query with pagination
          const dataQuery = `SELECT * FROM orders ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}`;
          const result = await sql(dataQuery, [...queryParams, pageSize, (page - 1) * pageSize]) as Array<Record<string, unknown>>;
          
          const parseJson = (value: any) => {
            if (typeof value === 'object') return value;
            if (typeof value === 'string') {
              try {
                return JSON.parse(value);
              } catch {
                return value;
              }
            }
            return value;
          };
          
          const orders: Order[] = result.map((row: any) => ({
            id: row.id,
            externalCode: row.external_code,
            storeName: row.store_name,
            recipientName: row.recipient_name,
            recipientPhone: row.recipient_phone,
            recipientAddress: row.recipient_address,
            items: parseJson(row.items),
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
      },

      getOrderById: async (id: string): Promise<Order | null> => {
        try {
          const result = await sql`SELECT * FROM orders WHERE id = ${id}` as Array<Record<string, unknown>>;
          
          if (result.length === 0) {
            return null;
          }
          
          const row = result[0];
          return {
            id: row.id as string,
            externalCode: row.external_code as string,
            storeName: row.store_name as string,
            recipientName: row.recipient_name as string,
            recipientPhone: row.recipient_phone as string,
            recipientAddress: row.recipient_address as string,
            items: JSON.parse(row.items as string),
            createdAt: new Date(row.created_at as string),
          };
        } catch (error) {
          console.error('Error getting order by id:', error);
          throw error;
        }
      },

      deleteOrder: async (id: string): Promise<boolean> => {
        try {
          const result = await sql`DELETE FROM orders WHERE id = ${id}` as { rowCount?: number };
          return result.rowCount !== undefined && result.rowCount > 0;
        } catch (error) {
          console.error('Error deleting order:', error);
          throw error;
        }
      },

      saveParseRule: async (rule: ParseRule): Promise<void> => {
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
      },

      getParseRules: async (): Promise<ParseRule[]> => {
        try {
          const result = await sql`SELECT * FROM parse_rules ORDER BY created_at DESC` as Array<Record<string, unknown>>;
          
          const parseJson = (value: any) => {
            if (typeof value === 'object') return value;
            if (typeof value === 'string') {
              try {
                return JSON.parse(value);
              } catch {
                return value;
              }
            }
            return value;
          };
          
          return result.map((row: any) => ({
            id: row.id as string,
            name: row.name as string,
            description: row.description as string,
            fileType: row.file_type as 'excel' | 'word' | 'pdf',
            fieldMappings: parseJson(row.field_mappings),
            sections: parseJson(row.sections),
            aggregation: parseJson(row.aggregation),
            matrix: parseJson(row.matrix),
            card: parseJson(row.card),
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string),
          }));
        } catch (error) {
          console.error('Error getting parse rules:', error);
          throw error;
        }
      },

      getParseRuleById: async (id: string): Promise<ParseRule | null> => {
        try {
          const result = await sql`SELECT * FROM parse_rules WHERE id = ${id}` as Array<Record<string, unknown>>;
          
          if (result.length === 0) {
            return null;
          }
          
          const row = result[0];
          
          const parseJson = (value: any) => {
            if (typeof value === 'object') return value;
            if (typeof value === 'string') {
              try {
                return JSON.parse(value);
              } catch {
                return value;
              }
            }
            return value;
          };
          
          return {
            id: row.id as string,
            name: row.name as string,
            description: row.description as string,
            fileType: row.file_type as 'excel' | 'word' | 'pdf',
            fieldMappings: parseJson(row.field_mappings),
            sections: parseJson(row.sections),
            aggregation: parseJson(row.aggregation),
            matrix: parseJson(row.matrix),
            card: parseJson(row.card),
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string),
          };
        } catch (error) {
          console.error('Error getting parse rule by id:', error);
          throw error;
        }
      },

      deleteParseRule: async (id: string): Promise<boolean> => {
        try {
          const result = await sql`DELETE FROM parse_rules WHERE id = ${id} RETURNING id` as Array<Record<string, unknown>>;
          return result.length > 0;
        } catch (error) {
          console.error('Error deleting parse rule:', error);
          throw error;
        }
      },

      checkDuplicateExternalCode: async (externalCode: string): Promise<boolean> => {
        try {
          const result = await sql`SELECT 1 FROM orders WHERE external_code = ${externalCode}` as Array<Record<string, unknown>>;
          return result.length > 0;
        } catch (error) {
          console.error('Error checking duplicate external code:', error);
          throw error;
        }
      },

      getExistingExternalCodes: async (): Promise<string[]> => {
        try {
          const result = await sql`SELECT external_code FROM orders WHERE external_code IS NOT NULL` as Array<Record<string, unknown>>;
          return result.map((row: any) => row.external_code as string);
        } catch (error) {
          console.error('Error getting existing external codes:', error);
          throw error;
        }
      }
    };
    
  } catch (error) {
    // In production, we should not fallback to mock - it indicates a real issue
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
      console.error('❌ Database initialization failed in production:', error);
      throw error; // Don't fallback in production
    }
    console.log('🧪 Falling back to mock database due to connection error:', error);
    mockDb = await import('./db-mock');
    isMockMode = true;
  }
}

// Export functions that delegate to the active implementation
// Database will be initialized lazily on first call
export async function createTables() {
  await initDatabase();
  return mockDb.createTables();
}

export async function saveOrder(order: Order) {
  await initDatabase();
  return mockDb.saveOrder(order);
}

export async function saveOrders(orders: Order[]) {
  await initDatabase();
  return mockDb.saveOrders(orders);
}

export async function getOrders(filter: OrderQueryFilter, page: number, pageSize: number) {
  await initDatabase();
  return mockDb.getOrders(filter, page, pageSize);
}

export async function getOrderById(id: string) {
  await initDatabase();
  return mockDb.getOrderById(id);
}

export async function deleteOrder(id: string) {
  await initDatabase();
  return mockDb.deleteOrder(id);
}

export async function saveParseRule(rule: ParseRule) {
  await initDatabase();
  return mockDb.saveParseRule(rule);
}

export async function getParseRules() {
  await initDatabase();
  return mockDb.getParseRules();
}

export async function getParseRuleById(id: string) {
  await initDatabase();
  return mockDb.getParseRuleById(id);
}

export async function deleteParseRule(id: string) {
  await initDatabase();
  return mockDb.deleteParseRule(id);
}

export async function checkDuplicateExternalCode(externalCode: string) {
  await initDatabase();
  return mockDb.checkDuplicateExternalCode(externalCode);
}

export async function getExistingExternalCodes() {
  await initDatabase();
  return mockDb.getExistingExternalCodes();
}

// Helper to check if we're in mock mode
export function isUsingMockDb() {
  return isMockMode;
}
