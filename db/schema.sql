-- ==============================================
-- 智能多格式批量下单系统 - 数据库Schema
-- ==============================================

-- 订单表 - 存储运单数据
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

-- 解析规则表 - 存储文件解析规则配置
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

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_orders_external_code ON orders(external_code);
CREATE INDEX IF NOT EXISTS idx_orders_recipient_name ON orders(recipient_name);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_parse_rules_file_type ON parse_rules(file_type);

-- ==============================================
-- 表结构说明
-- ==============================================

-- orders 表字段说明:
--   id: 订单唯一标识 (UUID)
--   external_code: 外部系统订单编号，用于去重和聚合
--   store_name: 收货门店/机构名称
--   recipient_name: 收件人姓名
--   recipient_phone: 收件人联系方式
--   recipient_address: 收件人完整地址
--   items: SKU物品列表 (JSONB格式)
--   created_at: 创建时间

-- parse_rules 表字段说明:
--   id: 规则唯一标识 (UUID)
--   name: 规则名称
--   description: 规则描述
--   file_type: 适用文件类型 (excel/word/pdf)
--   field_mappings: 字段映射配置
--   sections: 文档区域配置
--   aggregation: 聚合规则配置
--   matrix: 矩阵模式配置
--   card: 卡片模式配置
--   created_at: 创建时间
--   updated_at: 更新时间
