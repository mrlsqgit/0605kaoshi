'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Plus, Edit2, Trash2, Copy, FileText, Settings, Eye, X, Check } from 'lucide-react';
import { ParseRule } from '@/lib/types';

export default function RulesPage() {
  const [rules, setRules] = useState<ParseRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRule, setSelectedRule] = useState<ParseRule | null>(null);
  const [editingRule, setEditingRule] = useState<ParseRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条规则吗？')) return;
    
    try {
      const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('规则删除成功');
        loadRules();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    }
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
    if (!editingRule) return;
    
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isCreating ? '规则创建成功' : '规则更新成功');
        setEditingRule(null);
        setIsCreating(false);
        loadRules();
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch {
      toast.error('保存失败');
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
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">解析规则管理</h2>
            <p className="text-sm text-gray-500 mt-1">管理文件解析规则，支持创建、编辑、复制和删除</p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            新建规则
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">规则名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">描述</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">文件类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">字段映射</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Settings className="w-12 h-12 text-gray-300" />
                      <p>暂无解析规则</p>
                      <p className="text-sm">点击上方"新建规则"按钮创建</p>
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
                          onClick={() => { setEditingRule({ ...rule }); setIsCreating(false); }}
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
                          onClick={() => handleDelete(rule.id)}
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

      {/* 详情弹窗 */}
      {selectedRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRule(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-gray-800">规则详情</h3>
              </div>
              <button onClick={() => setSelectedRule(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
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
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-gray-800">{isCreating ? '新建规则' : '编辑规则'}</h3>
              </div>
              <button onClick={() => { setEditingRule(null); setIsCreating(false); }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
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
                    rows={2}
                    placeholder="请输入规则描述"
                  />
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 mb-3">高级配置</h4>
                <div className="grid grid-cols-3 gap-4">
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
                      <span className="text-sm font-medium text-gray-700">聚合规则</span>
                    </label>
                    {editingRule.aggregation.enabled && (
                      <select
                        value={editingRule.aggregation.mergeStrategy}
                        onChange={e => setEditingRule({
                          ...editingRule,
                          aggregation: { ...editingRule.aggregation, mergeStrategy: e.target.value as 'first' | 'last' | 'concat' }
                        })}
                        className="w-full mt-2 px-3 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="first">保留第一个</option>
                        <option value="last">保留最后一个</option>
                        <option value="concat">合并</option>
                      </select>
                    )}
                  </div>
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
                      <span className="text-sm font-medium text-gray-700">矩阵转置</span>
                    </label>
                  </div>
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
                      <span className="text-sm font-medium text-gray-700">卡片拆分</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => { setEditingRule(null); setIsCreating(false); }}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!editingRule.name}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
