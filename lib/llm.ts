// lib/llm.ts
// LLM API wrapper for AI-assisted rule generation

import { ParseRule, FieldMapping, SectionRule, AggregationRule, MatrixRule, CardRule } from './types';

const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_API_URL = process.env.LLM_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function analyzeFileAndGenerateRule(
  fileName: string,
  fileContent: string,
  fileType: 'excel' | 'word' | 'pdf'
): Promise<ParseRule> {
  const systemPrompt = `
你是一个智能文件解析专家，擅长分析各种格式的出库单、配送单文件，并生成解析规则。

请分析以下文件内容，然后输出一套完整的解析规则JSON。

文件格式特征：
${fileType === 'excel' ? 'EXCEL格式：可能包含多个Sheet、合并单元格、矩阵结构、卡片式布局、干扰头部' : ''}
${fileType === 'word' ? 'WORD格式：纯文本段落，物品信息嵌在文本中，用分隔线划分记录' : ''}
${fileType === 'pdf' ? 'PDF格式：多页文档，可能包含多个独立订单，需识别页面边界' : ''}

需要提取的字段：
- externalCode: 外部编码（配送单号）
- storeName: 收货门店
- recipientName: 收件人姓名
- recipientPhone: 收件人电话
- recipientAddress: 收件人地址
- skuCode: SKU物品编码
- skuName: SKU物品名称
- quantity: SKU发货数量（必须为正数）
- spec: SKU规格型号
- remark: 备注

规则结构要求：
1. fieldMappings: 字段映射数组，每个映射包含：
   - source: 源字段名或位置描述
   - target: 目标字段名（上述字段之一）
   - type: direct/regex/jsonpath/composite
   - pattern: 如果是regex类型，填写正则表达式
   - defaultValue: 默认值
   - isStatic: 是否为静态值
   - staticValue: 静态值内容
   - aiConfidence: AI置信度(0-1)
   - aiSuggestion: 是否为AI建议

2. sections: 区域规则数组，每个区域包含：
   - id: 区域ID
   - name: 区域名称
   - type: header/body/footer/matrix/card
   - startRow/endRow: 行范围（从1开始）
   - startCol/endCol: 列范围（从1开始）
   - skipRows: 需要跳过的行号数组
   - skipCols: 需要跳过的列号数组
   - hasHeader: 是否有表头
   - headerRow: 表头行号

3. aggregation: 聚合规则（用于跨行合并）:
   - enabled: 是否启用
   - groupByField: 按哪个字段分组
   - aggregateFields: 需要聚合的字段数组
   - mergeStrategy: first/last/concat

4. matrix: 矩阵转置规则:
   - enabled: 是否启用
   - rowHeaders: 行表头列号数组
   - colHeaders: 列表头行号数组
   - dataStartRow: 数据起始行
   - dataStartCol: 数据起始列
   - valueSeparator: 复合单元格的值分隔符

5. card: 卡片式拆分规则:
   - enabled: 是否启用
   - startPattern: 卡片起始标识
   - endPattern: 卡片结束标识
   - cardSeparator: 卡片分隔符

请仔细分析文件内容，识别：
1. 哪些是干扰行（需要跳过）
2. 表头在第几行
3. 数据区域在哪里
4. 收货人信息在哪里（可能在尾部）
5. 是否需要跨行聚合
6. 是否需要矩阵转置
7. 是否是卡片式布局

输出格式：仅输出JSON，不要包含其他文字。
`;

  const userPrompt = `
分析以下文件内容，生成解析规则：

文件名：${fileName}

文件内容预览：
${fileContent.length > 5000 ? fileContent.substring(0, 5000) + '...[内容截断]' : fileContent}

请输出完整的解析规则JSON。
`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const ruleJson = data.choices[0].message.content;

    try {
      const rule = JSON.parse(ruleJson) as ParseRule;
      return {
        ...rule,
        id: `rule-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', ruleJson);
      return generateDefaultRule(fileName, fileType);
    }
  } catch (error) {
    console.error('LLM API call failed:', error);
    return generateDefaultRule(fileName, fileType);
  }
}

function generateDefaultRule(fileName: string, fileType: 'excel' | 'word' | 'pdf'): ParseRule {
  const defaultMappings: FieldMapping[] = [
    { source: '外部编码', target: 'externalCode', type: 'direct', aiConfidence: 0.5, aiSuggestion: true },
    { source: '收货门店', target: 'storeName', type: 'direct', aiConfidence: 0.5, aiSuggestion: true },
    { source: '收件人姓名', target: 'recipientName', type: 'direct', aiConfidence: 0.5, aiSuggestion: true },
    { source: '收件人电话', target: 'recipientPhone', type: 'direct', aiConfidence: 0.5, aiSuggestion: true },
    { source: '收件人地址', target: 'recipientAddress', type: 'direct', aiConfidence: 0.5, aiSuggestion: true },
    { source: 'SKU物品编码', target: 'skuCode', type: 'direct', aiConfidence: 0.5, aiSuggestion: true },
    { source: 'SKU物品名称', target: 'skuName', type: 'direct', aiConfidence: 0.5, aiSuggestion: true },
    { source: 'SKU发货数量', target: 'quantity', type: 'direct', aiConfidence: 0.5, aiSuggestion: true },
    { source: 'SKU规格型号', target: 'spec', type: 'direct', aiConfidence: 0.5, aiSuggestion: true },
    { source: '备注', target: 'remark', type: 'direct', aiConfidence: 0.5, aiSuggestion: true },
  ];

  const defaultSections: SectionRule[] = [
    {
      id: 'body',
      name: '数据区域',
      type: 'body',
      startRow: 2,
      endRow: 999,
      startCol: 1,
      endCol: 50,
      skipRows: [],
      skipCols: [],
      hasHeader: true,
      headerRow: 1,
    },
  ];

  const defaultAggregation: AggregationRule = {
    enabled: false,
    groupByField: 'externalCode',
    aggregateFields: ['storeName', 'recipientName', 'recipientPhone', 'recipientAddress'],
    mergeStrategy: 'first',
  };

  const defaultMatrix: MatrixRule = {
    enabled: false,
    rowHeaders: [],
    colHeaders: [],
    dataStartRow: 1,
    dataStartCol: 1,
    valueSeparator: '\n',
  };

  const defaultCard: CardRule = {
    enabled: false,
    startPattern: '',
    endPattern: '',
    cardSeparator: '',
  };

  return {
    id: `rule-${Date.now()}`,
    name: `规则 - ${fileName}`,
    description: `自动生成的解析规则，适用于 ${fileType} 格式`,
    fileType,
    fieldMappings: defaultMappings,
    sections: defaultSections,
    aggregation: defaultAggregation,
    matrix: defaultMatrix,
    card: defaultCard,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function validateAndRefineRule(rule: ParseRule, sampleData: string): Promise<ParseRule> {
  const systemPrompt = `
你是一个规则验证和优化专家。请检查以下解析规则是否合理，并根据样例数据给出优化建议。

规则验证标准：
1. 字段映射是否完整（externalCode/storeName/recipientName/recipientPhone/recipientAddress/skuCode/skuName/quantity）
2. 是否识别了必要的跳过行（标题、合计行等）
3. 聚合规则是否合理
4. 矩阵转置规则是否必要

请输出优化后的规则JSON，不要包含其他文字。
`;

  const userPrompt = `
规则：${JSON.stringify(rule)}

样例数据：${sampleData.substring(0, 2000)}

请检查并优化规则。
`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const ruleJson = data.choices[0].message.content;

    try {
      return JSON.parse(ruleJson) as ParseRule;
    } catch {
      return rule;
    }
  } catch {
    return rule;
  }
}