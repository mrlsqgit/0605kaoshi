'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { Upload, FileText, Settings, Eye, Download, Trash2, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { ParsedOrder, ParseRule, UploadProgress } from '@/lib/types';
import { validateAllOrders } from '@/lib/parser';
import { getParseRules } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedRule, setSelectedRule] = useState<ParseRule | null>(null);
  const [rules, setRules] = useState<ParseRule[]>([]);
  const [parsedOrders, setParsedOrders] = useState<ParsedOrder[]>([]);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [generatedRule, setGeneratedRule] = useState<ParseRule | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'preview'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRuleGenerating, setIsRuleGenerating] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      }
    } catch (error) {
      toast.error('加载规则失败');
    }
  }, []);

  useState(() => {
    loadRules();
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setSelectedRule(null);
      setParsedOrders([]);
      setActiveTab('upload');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setUploadedFile(file);
      setSelectedRule(null);
      setParsedOrders([]);
      setActiveTab('upload');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleAnalyzeFile = async () => {
    if (!uploadedFile) return;

    setIsRuleGenerating(true);
    setProgress({
      percentage: 0,
      current: 0,
      total: 100,
      status: 'analyzing',
      message: 'AI正在分析文件结构...',
    });

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setGeneratedRule(data.data);
        setProgress({
          percentage: 100,
          current: 100,
          total: 100,
          status: 'complete',
          message: 'AI分析完成',
        });
        setShowRuleEditor(true);
      } else {
        toast.error(data.error || '分析失败');
      }
    } catch (error) {
      toast.error('分析失败');
    } finally {
      setIsRuleGenerating(false);
      setTimeout(() => setProgress(null), 2000);
    }
  };

  const handleExecuteParse = async () => {
    if (!uploadedFile || !selectedRule) return;

    setProgress({
      percentage: 0,
      current: 0,
      total: 100,
      status: 'parsing',
      message: '正在解析文件...',
    });

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('rule', JSON.stringify(selectedRule));

      const res = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        const validatedOrders = validateAllOrders(data.data.orders);
        setParsedOrders(validatedOrders);
        setProgress({
          percentage: 100,
          current: 100,
          total: 100,
          status: 'complete',
          message: '解析完成',
        });
        setActiveTab('preview');
      } else {
        toast.error(data.error || '解析失败');
      }
    } catch (error) {
      toast.error('解析失败');
    } finally {
      setTimeout(() => setProgress(null), 2000);
    }
  };

  const handleSaveRule = async () => {
    if (!generatedRule) return;

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatedRule),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('规则保存成功');
        await loadRules();
        setShowRuleEditor(false);
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const handleUpdateCell = (index: number, field: keyof ParsedOrder, value: string) => {
    const updated = [...parsedOrders];
    updated[index] = {
      ...updated[index],
      [field]: field === 'quantity' ? parseFloat(value) || 1 : value,
    };
    const validated = validateAllOrders(updated);
    setParsedOrders(validated);
  };

  const handleDeleteRow = (index: number) => {
    setParsedOrders(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddRow = () => {
    const newRow: ParsedOrder = {
      id: uuidv4(),
      externalCode: '',
      storeName: '',
      recipientName: '',
      recipientPhone: '',
      recipientAddress: '',
      skuCode: '',
      skuName: '',
      quantity: 1,
      spec: '',
      remark: '',
      rowIndex: parsedOrders.length + 1,
      errors: [],
    };
    setParsedOrders(prev => [...prev, newRow]);
  };

  const handleExport = () => {
    const worksheetData = parsedOrders.map(order => ({
      '外部编码': order.externalCode,
      '收货门店': order.storeName,
      '收件人姓名': order.recipientName,
      '收件人电话': order.recipientPhone,
      '收件人地址': order.recipientAddress,
      'SKU物品编码': order.skuCode,
      'SKU物品名称': order.skuName,
      'SKU发货数量': order.quantity,
      'SKU规格型号': order.spec,
      '备注': order.remark,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '运单数据');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `运单导出_${Date.now()}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmitOrders = async () => {
    const validOrders = parsedOrders.filter(o => o.errors.length === 0);
    
    if (validOrders.length === 0) {
      toast.error('没有可提交的有效运单');
      return;
    }

    setProgress({
      percentage: 0,
      current: 0,
      total: validOrders.length,
      status: 'uploading',
      message: '正在提交...',
    });

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: validOrders }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`成功提交 ${data.data.count} 条运单`);
        setParsedOrders([]);
        setUploadedFile(null);
        setSelectedRule(null);
        setActiveTab('upload');
      } else {
        toast.error(data.error || '提交失败');
      }
    } catch (error) {
      toast.error('提交失败');
    } finally {
      setProgress(null);
    }
  };

  const hasErrors = parsedOrders.some(o => o.errors.length > 0);
  const totalErrors = parsedOrders.reduce((sum, o) => sum + o.errors.length, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {progress && (
        <div className="bg-white rounded-xl shadow-sm p-4 border border-primary-100">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              progress.status === 'error' ? 'bg-red-100 text-red-600' :
              progress.status === 'complete' ? 'bg-green-100 text-green-600' :
              'bg-primary-100 text-primary-600'
            }`}>
              {progress.status === 'complete' ? <CheckCircle className="w-5 h-5" /> :
               progress.status === 'error' ? <AlertCircle className="w-5 h-5" /> :
               <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />}
            </div>
            <span className="text-gray-700">{progress.message}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="text-sm text-gray-500 mt-2">
            {progress.current} / {progress.total}
          </div>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">上传文件</h2>
            <p className="text-sm text-gray-500 mt-1">支持 Excel (.xlsx/.xls)、Word (.docx)、PDF 文件</p>
          </div>
          <div className="p-6">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                uploadedFile 
                  ? 'border-primary-500 bg-primary-50' 
                  : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.docx,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              {uploadedFile ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedFile(null);
                    }}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    更换文件
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">点击或拖拽文件到此处上传</p>
                    <p className="text-sm text-gray-500">支持 .xlsx, .xls, .docx, .pdf 格式</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">选择解析规则</label>
              <div className="flex gap-3">
                <select
                  value={selectedRule?.id || ''}
                  onChange={(e) => {
                    const rule = rules.find(r => r.id === e.target.value);
                    setSelectedRule(rule || null);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">请选择解析规则</option>
                  {rules.map(rule => (
                    <option key={rule.id} value={rule.id}>
                      {rule.name} ({rule.fileType})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAnalyzeFile}
                  disabled={!uploadedFile || isRuleGenerating}
                  className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Settings className="w-5 h-5" />
                  {isRuleGenerating ? '分析中...' : 'AI生成规则'}
                </button>
              </div>
            </div>

            {selectedRule && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-800">{selectedRule.name}</p>
                    <p className="text-sm text-blue-600">{selectedRule.description}</p>
                  </div>
                  <button
                    onClick={() => setSelectedRule(null)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    取消选择
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleExecuteParse}
                disabled={!uploadedFile || !selectedRule}
                className="px-8 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                开始解析
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preview' && parsedOrders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveTab('upload')}
                className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                ← 返回上传
              </button>
              <div className="h-4 w-px bg-gray-300" />
              <span className="text-sm text-gray-600">
                共 {parsedOrders.length} 条记录
                {hasErrors && <span className="text-red-500 ml-2">，{totalErrors} 个错误</span>}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                导出 Excel
              </button>
              <button
                onClick={handleAddRow}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                新增行
              </button>
              <button
                onClick={handleSubmitOrders}
                disabled={hasErrors}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                提交下单
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">行号</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">外部编码</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">收货门店</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">收件人姓名</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">收件人电话</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">收件人地址</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">SKU编码</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">SKU名称</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">数量</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">规格</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">备注</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedOrders.map((order, index) => (
                    <tr 
                      key={order.id} 
                      className={`border-b transition-colors ${order.errors.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <input
                          value={order.externalCode}
                          onChange={(e) => handleUpdateCell(index, 'externalCode', e.target.value)}
                          className="w-full px-2 py-1 border border-transparent hover:border-gray-300 rounded focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={order.storeName}
                          onChange={(e) => handleUpdateCell(index, 'storeName', e.target.value)}
                          className="w-full px-2 py-1 border border-transparent hover:border-gray-300 rounded focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={order.recipientName}
                          onChange={(e) => handleUpdateCell(index, 'recipientName', e.target.value)}
                          className="w-full px-2 py-1 border border-transparent hover:border-gray-300 rounded focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={order.recipientPhone}
                          onChange={(e) => handleUpdateCell(index, 'recipientPhone', e.target.value)}
                          className={`w-full px-2 py-1 border rounded focus:ring-1 ${
                            order.errors.some(e => e.field === 'recipientPhone') 
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                              : 'border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={order.recipientAddress}
                          onChange={(e) => handleUpdateCell(index, 'recipientAddress', e.target.value)}
                          className="w-full px-2 py-1 border border-transparent hover:border-gray-300 rounded focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={order.skuCode}
                          onChange={(e) => handleUpdateCell(index, 'skuCode', e.target.value)}
                          className={`w-full px-2 py-1 border rounded focus:ring-1 ${
                            order.errors.some(e => e.field === 'skuCode') 
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                              : 'border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={order.skuName}
                          onChange={(e) => handleUpdateCell(index, 'skuName', e.target.value)}
                          className={`w-full px-2 py-1 border rounded focus:ring-1 ${
                            order.errors.some(e => e.field === 'skuName') 
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                              : 'border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={order.quantity}
                          onChange={(e) => handleUpdateCell(index, 'quantity', e.target.value)}
                          className={`w-full px-2 py-1 border rounded focus:ring-1 ${
                            order.errors.some(e => e.field === 'quantity') 
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50' 
                              : 'border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={order.spec}
                          onChange={(e) => handleUpdateCell(index, 'spec', e.target.value)}
                          className="w-full px-2 py-1 border border-transparent hover:border-gray-300 rounded focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={order.remark}
                          onChange={(e) => handleUpdateCell(index, 'remark', e.target.value)}
                          className="w-full px-2 py-1 border border-transparent hover:border-gray-300 rounded focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteRow(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasErrors && (
              <div className="p-4 bg-red-50 border-t border-red-100">
                <h4 className="font-medium text-red-800 mb-2">错误列表</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {parsedOrders.map((order, index) => 
                    order.errors.map((error, errorIndex) => (
                      <p key={errorIndex} className="text-sm text-red-600">
                        第 {index + 1} 行 - {error.field}: {error.message}
                      </p>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showRuleEditor && generatedRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-gray-800">AI生成解析规则</h3>
              </div>
              <button
                onClick={() => setShowRuleEditor(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
                <input
                  value={generatedRule.name}
                  onChange={(e) => setGeneratedRule(prev => ({ ...prev!, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={generatedRule.description}
                  onChange={(e) => setGeneratedRule(prev => ({ ...prev!, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                />
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">字段映射（AI置信度标注）:</p>
                <div className="space-y-2">
                  {generatedRule.fieldMappings.slice(0, 5).map((mapping, index) => (
                    <div key={index} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500">{mapping.source}</span>
                      <span>→</span>
                      <span className="text-primary-600">{mapping.target}</span>
                      {mapping.aiSuggestion && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                          AI建议
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowRuleEditor(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveRule}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                保存规则
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}