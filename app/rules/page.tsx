'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, Copy, FileText, Settings, Eye, X, Check, Sparkles, Upload, ChevronDown, ChevronUp, Grid3X3, List } from 'lucide-react';
import { ParseRule, FieldMapping, SectionRule, ExtractType } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const TARGET_FIELDS: { value: string; label: string; description: string }[] = [
  { value: 'externalCode', label: '外部编码', description: '配送单号' },
  { value: 'storeName', label: '收货门店', description: '门店名称' },
  { value: 'recipientName', label: '收件人姓名', description: '联系人姓名' },
  { value: 'recipientPhone', label: '收件人电话', description: '联系电话' },
  { value: 'recipientAddress', label: '收件人地址', description: '收货地址' },
  { value: 'skuCode', label: 'SKU编码', description: '商品编码' },
  { value: 'skuName', label: 'SKU名称', description: '商品名称' },
  { value: 'quantity', label: '数量', description: '发货数量' },
  { value: 'spec', label: '规格', description: '商品规格' },
  { value: 'remark', label: '备注', description: '备注信息' },
];

const MAPPING_TYPES = [
  { value: 'direct', label: '直接映射' },
  { value: 'regex', label: '正则提取' },
  { value: 'jsonpath', label: 'JSON路径' },
  { value: 'composite', label: '组合字段' },
];

const EXTRACT_TYPES: { value: ExtractType; label: string; description: string }[] = [
  { value: 'header', label: '头部区域', description: '文件开头的固定信息' },
  { value: 'body', label: '主体区域', description: '主要数据区域' },
  { value: 'footer', label: '尾部区域', description: '文件末尾的附加信息' },
  { value: 'matrix', label: '矩阵区域', description: '行列交叉的数据' },
  { value: 'card', label: '卡片区域', description: '卡片式布局数据' },
];

export default function RulesPage() {
  const [rules, setRules] = useState<ParseRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRule, setSelectedRule] = useState<ParseRule | null>(null);
  const [editingRule, setEditingRule] = useState<ParseRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showAIForm, setShowAIForm] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'mappings' | 'sections' | 'advanced'>('basic');
  const [expandedMapping, setExpandedMapping] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; ruleId: string | null }>({ isOpen: false, ruleId: null });

  const supportedExtensions = ['.xlsx', '.xls', '.docx', '.pdf'];

  const validateFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    
    // 过滤临时文件（Excel打开时创建的~$开头的文件）
    if (fileName.startsWith('~$')) {
      toast.error(`不能上传临时文件：${file.name}。请关闭正在编辑的Excel文件后再尝试上传。`);
      return false;
    }
    
    const isValid = supportedExtensions.some(ext => fileName.endsWith(ext));
    if (!isValid) {
      toast.error(`不支持的文件格式：${file.name}。仅支持 Excel (.xlsx/.xls)、Word (.docx)、PDF 文件。`);
    }
    return isValid;
  };

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      } else {
        toast.error(data.error || '加载失败');
      }
    } catch {
      toast.error('加载规则失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ isOpen: true, ruleId: id });
  };

  const handleDeleteConfirm = async () => {
    const { ruleId } = deleteConfirm;
    if (!ruleId) return;
    
    try {
      const res = await fetch(`/api/rules/${ruleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('规则删除成功');
        loadRules();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    } finally {
      setDeleteConfirm({ isOpen: false, ruleId: null });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, ruleId: null });
  };

  const handleCopy = async (rule: ParseRule) => {
    const newRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      name: `${rule.name} (副本)`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('规则复制成功');
        loadRules();
      } else {
        toast.error(data.error || '复制失败');
      }
    } catch {
      toast.error('复制失败');
    }
  };

  const handleSave = async () => {
    console.log('handleSave called');
    console.log('editingRule:', editingRule);
    if (!editingRule) {
      console.log('editingRule is null');
      return;
    }
    
    // 验证必填字段
    if (!editingRule.name.trim()) {
      console.log('name is empty');
      toast.error('请输入规则名称');
      return;
    }
    
    if (!editingRule.fileType) {
      console.log('fileType is empty');
      toast.error('请选择文件类型');
      return;
    }
    console.log('Validation passed, proceeding to save');
    
    
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Save rule failed:', res.status, errorText);
        toast.error(`保存失败 (${res.status})`);
        return;
      }
      
      const data = await res.json();
      if (data.success) {
        toast.success(isCreating ? '规则创建成功' : '规则更新成功');
        setEditingRule(null);
        setIsCreating(false);
        loadRules();
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch (error) {
      console.error('Save rule error:', error);
      toast.error('保存失败，请检查网络连接');
    }
  };

  const handleAIGenerate = async () => {
    if (!aiFile) {
      toast.error('请先选择文件');
      return;
    }

    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', aiFile);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        const rule = data.data;
        // 如果AI生成的规则没有名称，自动设置默认名称
        if (!rule.name || !rule.name.trim()) {
          rule.name = `规则 - ${aiFile?.name || '未知文件'}`;
        }
        setEditingRule(rule);
        setIsCreating(true);
        setShowAIForm(false);
        setAiFile(null);
        toast.success('AI规则生成成功，请确认后保存');
      } else {
        toast.error(data.error || 'AI生成失败');
      }
    } catch (error) {
      toast.error('AI生成失败，请检查LLM配置');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateNew = () => {
    const newRule: ParseRule = {
      id: `rule-${Date.now()}`,
      name: '',
      description: '',
      fileType: 'excel',
      fieldMappings: [],
      sections: [],
      aggregation: { enabled: false, groupByField: 'externalCode', aggregateFields: [], mergeStrategy: 'first' },
      matrix: { enabled: false, rowHeaders: [], colHeaders: [], dataStartRow: 1, dataStartCol: 1, valueSeparator: '\n' },
      card: { enabled: false, startPattern: '', endPattern: '', cardSeparator: '' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setEditingRule(newRule);
    setIsCreating(true);
    setActiveTab('basic');
  };

  const addFieldMapping = () => {
    if (!editingRule) return;
    const newMapping: FieldMapping = {
      source: '',
      target: 'externalCode',
      type: 'direct',
      aiConfidence: 1,
      aiSuggestion: false,
    };
    setEditingRule({
      ...editingRule,
      fieldMappings: [...editingRule.fieldMappings, newMapping],
    });
  };

  const updateFieldMapping = (index: number, updates: Partial<FieldMapping>) => {
    if (!editingRule) return;
    const newMappings = [...editingRule.fieldMappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    setEditingRule({ ...editingRule, fieldMappings: newMappings });
  };

  const removeFieldMapping = (index: number) => {
    if (!editingRule) return;
    const newMappings = editingRule.fieldMappings.filter((_, i) => i !== index);
    setEditingRule({ ...editingRule, fieldMappings: newMappings });
  };

  const addSection = () => {
    if (!editingRule) return;
    const newSection: SectionRule = {
      id: `section-${Date.now()}`,
      name: '',
      type: 'body',
      startRow: 1,
      endRow: 999,
      startCol: 1,
      endCol: 50,
      skipRows: [],
      skipCols: [],
      hasHeader: true,
      headerRow: 1,
    };
    setEditingRule({
      ...editingRule,
      sections: [...editingRule.sections, newSection],
    });
  };

  const updateSection = (index: number, updates: Partial<SectionRule>) => {
    if (!editingRule) return;
    const newSections = [...editingRule.sections];
    newSections[index] = { ...newSections[index], ...updates };
    setEditingRule({ ...editingRule, sections: newSections });
  };

  const removeSection = (index: number) => {
    if (!editingRule) return;
    const newSections = editingRule.sections.filter((_, i) => i !== index);
    setEditingRule({ ...editingRule, sections: newSections });
  };

  const tabs = [
    { id: 'basic' as const, label: '基本信息', icon: Settings },
    { id: 'mappings' as const, label: '字段映射', icon: Grid3X3 },
    { id: 'sections' as const, label: '区域配置', icon: List },
    { id: 'advanced' as const, label: '高级选项', icon: Settings },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">解析规则管理</h2>
            <p className="text-sm text-gray-500 mt-1">管理文件解析规则，支持创建、编辑、复制和AI辅助生成</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAIForm(true)}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 flex items-center gap-2 transition-all"
            >
              <Sparkles className="w-5 h-5" />
              AI生成规则
            </button>
            <button
              onClick={handleCreateNew}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              新建规则
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">规则名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">文件类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">字段映射</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">区域</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Settings className="w-12 h-12 text-gray-300" />
                      <p>暂无解析规则</p>
                      <p className="text-sm">点击上方按钮创建或使用AI生成规则</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{rule.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{rule.description || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        rule.fileType === 'excel' ? 'bg-green-100 text-green-700' :
                        rule.fileType === 'word' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {rule.fileType.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{rule.fieldMappings?.length || 0} 个</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{rule.sections?.length || 0} 个</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(rule.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedRule(rule)}
                          className="text-gray-400 hover:text-primary-600 p-1"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingRule({ ...rule }); setIsCreating(false); setActiveTab('basic'); }}
                          className="text-gray-400 hover:text-primary-600 p-1"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopy(rule)}
                          className="text-gray-400 hover:text-primary-600 p-1"
                          title="复制"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(rule.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI生成弹窗 */}
      {showAIForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAIForm(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-gray-800">AI辅助生成规则</h3>
              </div>
              <button onClick={() => setShowAIForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                上传一个出库单文件，AI将自动分析文件结构并生成解析规则。生成的规则需要您确认后才能保存使用。
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors cursor-pointer"
                onClick={() => document.getElementById('ai-file-input')?.click()}>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">{aiFile ? aiFile.name : '点击选择文件'}</p>
                <p className="text-sm text-gray-400 mt-1">支持 Excel (.xlsx, .xls)、Word (.docx)、PDF (.pdf)</p>
                <input
                  id="ai-file-input"
                  type="file"
                  accept=".xlsx,.xls,.docx,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && validateFile(file)) {
                      setAiFile(file);
                    } else {
                      setAiFile(null);
                    }
                  }}
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowAIForm(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAIGenerate}
                disabled={!aiFile || aiLoading}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 flex items-center gap-2"
              >
                {aiLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {aiLoading ? '分析中...' : 'AI生成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {selectedRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRule(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-gray-800">规则详情</h3>
              </div>
              <button onClick={() => setSelectedRule(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">规则名称</label>
                  <p className="text-gray-800 font-medium">{selectedRule.name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">文件类型</label>
                  <p className="text-gray-800">{selectedRule.fileType.toUpperCase()}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-gray-500">描述</label>
                  <p className="text-gray-800">{selectedRule.description || '-'}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-3">字段映射 ({selectedRule.fieldMappings?.length || 0})</h4>
                <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {selectedRule.fieldMappings?.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="pb-2">源字段</th>
                          <th className="pb-2">目标字段</th>
                          <th className="pb-2">类型</th>
                          <th className="pb-2">置信度</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRule.fieldMappings.map((m, i) => (
                          <tr key={i} className="border-t">
                            <td className="py-2">{m.source}</td>
                            <td className="py-2 text-primary-600">{m.target}</td>
                            <td className="py-2">{m.type}</td>
                            <td className="py-2">
                              {m.aiSuggestion && <span className="text-orange-500 text-xs">AI推荐</span>}
                              <span className="ml-2">{((m.aiConfidence ?? 0) * 100).toFixed(0)}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-gray-500 text-center py-4">暂无字段映射</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-3">区域配置 ({selectedRule.sections?.length || 0})</h4>
                <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {selectedRule.sections?.length > 0 ? (
                    <div className="space-y-2">
                      {selectedRule.sections.map((s, i) => (
                        <div key={i} className="bg-white rounded p-3 text-sm">
                          <div className="font-medium">{s.name} ({s.type})</div>
                          <div className="text-gray-500 mt-1">
                            行: {s.startRow}-{s.endRow}, 列: {s.startCol}-{s.endCol}
                            {s.skipRows?.length > 0 && <span className="ml-2">跳过行: {s.skipRows.join(', ')}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">暂无区域配置</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">聚合规则</h4>
                  <p className="text-sm text-gray-600">
                    {selectedRule.aggregation?.enabled ? `已启用 (${selectedRule.aggregation.mergeStrategy})` : '未启用'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">矩阵转置</h4>
                  <p className="text-sm text-gray-600">
                    {selectedRule.matrix?.enabled ? '已启用' : '未启用'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">卡片拆分</h4>
                  <p className="text-sm text-gray-600">
                    {selectedRule.card?.enabled ? '已启用' : '未启用'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setEditingRule(null); setIsCreating(false); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-gray-800">{isCreating ? '新建规则' : '编辑规则'}</h3>
              </div>
              <button onClick={() => { setEditingRule(null); setIsCreating(false); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab导航 */}
            <div className="flex border-b">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab内容 */}
            <div className="p-6 overflow-y-auto max-h-[65vh]">
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">规则名称 *</label>
                      <input
                        type="text"
                        value={editingRule.name}
                        onChange={e => setEditingRule({ ...editingRule, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="请输入规则名称"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">文件类型 *</label>
                      <select
                        value={editingRule.fileType}
                        onChange={e => setEditingRule({ ...editingRule, fileType: e.target.value as 'excel' | 'word' | 'pdf' })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="excel">Excel</option>
                        <option value="word">Word</option>
                        <option value="pdf">PDF</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                      <textarea
                        value={editingRule.description}
                        onChange={e => setEditingRule({ ...editingRule, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        rows={3}
                        placeholder="请输入规则描述，说明此规则适用的文件格式特征"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'mappings' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-800">字段映射</h4>
                      <p className="text-sm text-gray-500">定义如何从源文件提取数据字段</p>
                    </div>
                    <button
                      onClick={addFieldMapping}
                      className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      添加映射
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editingRule.fieldMappings.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Grid3X3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>暂无字段映射</p>
                        <p className="text-sm">点击上方按钮添加字段映射</p>
                      </div>
                    ) : (
                      editingRule.fieldMappings.map((mapping, index) => (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg overflow-hidden"
                        >
                          <div
                            className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
                            onClick={() => setExpandedMapping(expandedMapping === index ? null : index)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">
                                {index + 1}
                              </span>
                              <div>
                                <span className="font-medium text-gray-800">{mapping.source || '未设置源字段'}</span>
                                <span className="mx-2 text-gray-400">{'>'}</span>
                                <span className="text-primary-600">
                                  {TARGET_FIELDS.find(f => f.value === mapping.target)?.label || mapping.target}
                                </span>
                              </div>
                              {mapping.aiSuggestion && (
                                <span className="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded">AI推荐</span>
                              )}
                            </div>
                            {expandedMapping === index ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>

                          {expandedMapping === index && (
                            <div className="p-4 space-y-4 border-t bg-white">
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">源字段</label>
                                  <input
                                    type="text"
                                    value={mapping.source}
                                    onChange={e => updateFieldMapping(index, { source: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                    placeholder="源字段名或位置"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">目标字段</label>
                                  <select
                                    value={mapping.target}
                                    onChange={e => updateFieldMapping(index, { target: e.target.value as any })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                  >
                                    {TARGET_FIELDS.map(field => (
                                      <option key={field.value} value={field.value}>
                                        {field.label} - {field.description}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">映射类型</label>
                                  <select
                                    value={mapping.type}
                                    onChange={e => updateFieldMapping(index, { type: e.target.value as 'direct' | 'regex' | 'jsonpath' | 'composite' })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                  >
                                    {MAPPING_TYPES.map(type => (
                                      <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                {mapping.type === 'regex' && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">正则表达式</label>
                                    <input
                                      type="text"
                                      value={mapping.pattern || ''}
                                      onChange={e => updateFieldMapping(index, { pattern: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                      placeholder="例如: (\d+)"
                                    />
                                  </div>
                                )}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">默认值</label>
                                  <input
                                    type="text"
                                    value={mapping.defaultValue || ''}
                                    onChange={e => updateFieldMapping(index, { defaultValue: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                    placeholder="字段为空时使用的值"
                                  />
                                </div>
                                <div className="flex items-center justify-center">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={mapping.isStatic || false}
                                      onChange={e => updateFieldMapping(index, { isStatic: e.target.checked })}
                                      className="w-4 h-4 text-primary-600 rounded"
                                    />
                                    <span className="text-sm text-gray-700">静态值</span>
                                  </label>
                                </div>
                              </div>

                              {mapping.isStatic && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">静态值内容</label>
                                  <input
                                    type="text"
                                    value={mapping.staticValue || ''}
                                    onChange={e => updateFieldMapping(index, { staticValue: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                    placeholder="固定值内容"
                                  />
                                </div>
                              )}

                              <div className="flex justify-end">
                                <button
                                  onClick={() => removeFieldMapping(index)}
                                  className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  删除
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'sections' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-800">区域配置</h4>
                      <p className="text-sm text-gray-500">定义文件中的数据区域范围，支持头部跳过、尾部提取等</p>
                    </div>
                    <button
                      onClick={addSection}
                      className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      添加区域
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editingRule.sections.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <List className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>暂无区域配置</p>
                        <p className="text-sm">点击上方按钮添加数据区域</p>
                      </div>
                    ) : (
                      editingRule.sections.map((section, index) => (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg overflow-hidden"
                        >
                          <div
                            className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
                            onClick={() => setExpandedSection(expandedSection === index ? null : index)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">
                                {index + 1}
                              </span>
                              <div>
                                <span className="font-medium text-gray-800">{section.name || '未命名区域'}</span>
                                <span className="mx-2 text-gray-400">-</span>
                                <span className="text-gray-500 text-sm">
                                  {EXTRACT_TYPES.find(t => t.value === section.type)?.label || section.type}
                                </span>
                              </div>
                            </div>
                            {expandedSection === index ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>

                          {expandedSection === index && (
                            <div className="p-4 space-y-4 border-t bg-white">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">区域名称</label>
                                  <input
                                    type="text"
                                    value={section.name}
                                    onChange={e => updateSection(index, { name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                    placeholder="例如: 主体数据区"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">区域类型</label>
                                  <select
                                    value={section.type}
                                    onChange={e => updateSection(index, { type: e.target.value as ExtractType })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                  >
                                    {EXTRACT_TYPES.map(type => (
                                      <option key={type.value} value={type.value}>
                                        {type.label} - {type.description}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-4 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">起始行</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={section.startRow}
                                    onChange={e => updateSection(index, { startRow: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">结束行</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={section.endRow}
                                    onChange={e => updateSection(index, { endRow: parseInt(e.target.value) || 999 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">起始列</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={section.startCol}
                                    onChange={e => updateSection(index, { startCol: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">结束列</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={section.endCol}
                                    onChange={e => updateSection(index, { endCol: parseInt(e.target.value) || 50 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <div className="flex items-center justify-center">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={section.hasHeader}
                                      onChange={e => updateSection(index, { hasHeader: e.target.checked })}
                                      className="w-4 h-4 text-primary-600 rounded"
                                    />
                                    <span className="text-sm text-gray-700">包含表头</span>
                                  </label>
                                </div>
                                {section.hasHeader && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">表头行号</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={section.headerRow}
                                      onChange={e => updateSection(index, { headerRow: parseInt(e.target.value) || 1 })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                    />
                                  </div>
                                )}
                                <div />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">跳过行 (逗号分隔)</label>
                                  <input
                                    type="text"
                                    value={section.skipRows.join(',')}
                                    onChange={e => updateSection(index, { skipRows: e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                    placeholder="例如: 1,5,10"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">跳过列 (逗号分隔)</label>
                                  <input
                                    type="text"
                                    value={section.skipCols.join(',')}
                                    onChange={e => updateSection(index, { skipCols: e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                    placeholder="例如: 1,3"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end">
                                <button
                                  onClick={() => removeSection(index)}
                                  className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm flex items-center gap-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  删除
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'advanced' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium text-gray-800 mb-3">聚合规则</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingRule.aggregation.enabled}
                          onChange={e => setEditingRule({
                            ...editingRule,
                            aggregation: { ...editingRule.aggregation, enabled: e.target.checked }
                          })}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <span className="font-medium text-gray-700">启用聚合规则</span>
                      </label>
                      <p className="text-sm text-gray-500 mt-1">将多行数据按指定字段分组合并，适用于多门店出库单合并场景</p>

                      {editingRule.aggregation.enabled && (
                        <div className="mt-4 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">分组字段</label>
                            <select
                              value={editingRule.aggregation.groupByField}
                              onChange={e => setEditingRule({
                                ...editingRule,
                                aggregation: { ...editingRule.aggregation, groupByField: e.target.value as any }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                            >
                              {TARGET_FIELDS.map(field => (
                                <option key={field.value} value={field.value}>{field.label}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">合并策略</label>
                            <select
                              value={editingRule.aggregation.mergeStrategy}
                              onChange={e => setEditingRule({
                                ...editingRule,
                                aggregation: { ...editingRule.aggregation, mergeStrategy: e.target.value as 'first' | 'last' | 'concat' }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                            >
                              <option value="first">保留第一个值</option>
                              <option value="last">保留最后一个值</option>
                              <option value="concat">合并所有值</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">聚合字段</label>
                            <div className="flex flex-wrap gap-2">
                              {TARGET_FIELDS.map(field => (
                                <label
                                  key={field.value}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                                    editingRule.aggregation.aggregateFields.includes(field.value as any)
                                      ? 'bg-primary-100 text-primary-700'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={editingRule.aggregation.aggregateFields.includes(field.value as any)}
                                    onChange={(e) => {
                                      const fields = [...editingRule.aggregation.aggregateFields];
                                      if (e.target.checked) {
                                        fields.push(field.value as any);
                                      } else {
                                        fields.splice(fields.indexOf(field.value as any), 1);
                                      }
                                      setEditingRule({
                                        ...editingRule,
                                        aggregation: { ...editingRule.aggregation, aggregateFields: fields }
                                      });
                                    }}
                                    className="w-4 h-4 text-primary-600 rounded hidden"
                                  />
                                  {field.label}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-800 mb-3">矩阵转置</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingRule.matrix.enabled}
                          onChange={e => setEditingRule({
                            ...editingRule,
                            matrix: { ...editingRule.matrix, enabled: e.target.checked }
                          })}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <span className="font-medium text-gray-700">启用矩阵转置</span>
                      </label>
                      <p className="text-sm text-gray-500 mt-1">将行列交叉的数据转换为标准表格格式</p>

                      {editingRule.matrix.enabled && (
                        <div className="mt-4 grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">行表头列号</label>
                            <input
                              type="text"
                              value={editingRule.matrix.rowHeaders.join(',')}
                              onChange={e => setEditingRule({
                                ...editingRule,
                                matrix: { ...editingRule.matrix, rowHeaders: e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="例如: 1,2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">列表头行号</label>
                            <input
                              type="text"
                              value={editingRule.matrix.colHeaders.join(',')}
                              onChange={e => setEditingRule({
                                ...editingRule,
                                matrix: { ...editingRule.matrix, colHeaders: e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="例如: 1,2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">值分隔符</label>
                            <input
                              type="text"
                              value={editingRule.matrix.valueSeparator}
                              onChange={e => setEditingRule({
                                ...editingRule,
                                matrix: { ...editingRule.matrix, valueSeparator: e.target.value }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="例如: \n"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-800 mb-3">卡片拆分</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingRule.card.enabled}
                          onChange={e => setEditingRule({
                            ...editingRule,
                            card: { ...editingRule.card, enabled: e.target.checked }
                          })}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <span className="font-medium text-gray-700">启用卡片拆分</span>
                      </label>
                      <p className="text-sm text-gray-500 mt-1">按开始/结束标识拆分卡片式布局的数据</p>

                      {editingRule.card.enabled && (
                        <div className="mt-4 grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">开始标识</label>
                            <input
                              type="text"
                              value={editingRule.card.startPattern}
                              onChange={e => setEditingRule({
                                ...editingRule,
                                card: { ...editingRule.card, startPattern: e.target.value }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="例如: 出库单"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">结束标识</label>
                            <input
                              type="text"
                              value={editingRule.card.endPattern}
                              onChange={e => setEditingRule({
                                ...editingRule,
                                card: { ...editingRule.card, endPattern: e.target.value }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="例如: 合计"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">卡片分隔符</label>
                            <input
                              type="text"
                              value={editingRule.card.cardSeparator}
                              onChange={e => setEditingRule({
                                ...editingRule,
                                card: { ...editingRule.card, cardSeparator: e.target.value }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                              placeholder="例如: ===="
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => { setEditingRule(null); setIsCreating(false); }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('=== Save Button Clicked ===');
                  console.log('Event target:', e.target);
                  console.log('editingRule exists:', !!editingRule);
                  console.log('editingRule:', editingRule);
                  console.log('name:', editingRule?.name, 'name.trim():', editingRule?.name?.trim());
                  console.log('fileType:', editingRule?.fileType);
                  console.log('disabled condition:', !editingRule?.name || !editingRule?.fileType);
                  handleSave();
                }}
                disabled={!editingRule?.name || !editingRule?.fileType}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                保存规则
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="删除规则"
        message="确定要删除这条规则吗？此操作不可撤销。"
        type="danger"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}