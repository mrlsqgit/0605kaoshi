'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Upload, FileText, Settings, Download, Trash2, Plus, AlertCircle, CheckCircle, Eye, ArrowLeft, Loader2 } from 'lucide-react';
import { ParsedOrder, ParseRule, UploadProgress } from '@/lib/types';
import { validateAllOrders } from '@/lib/parser';
import { getParseRules, getExistingExternalCodes } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import VirtualTable from '@/components/VirtualTable';

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
  const [existingCodes, setExistingCodes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    loadRules();
  }, [loadRules]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setUploadedFile(file);
      setSelectedRule(null);
      setParsedOrders([]);
      setActiveTab('upload');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && validateFile(file)) {
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

    const startTime = Date.now();
    
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
        
        const batchCodes = validatedOrders.map(o => o.externalCode).filter(Boolean);
        const duplicateInBatch = new Set<string>();
        const codeCountMap = new Map<string, number>();
        
        batchCodes.forEach((code, idx) => {
          const prevIdx = codeCountMap.get(code);
          if (prevIdx !== undefined) {
            duplicateInBatch.add(code);
          }
          codeCountMap.set(code, idx);
        });

        const ordersWithDuplicateCheck = validatedOrders.map((order, orderIdx) => {
          const newErrors = [...order.errors];
          
          if (order.externalCode && duplicateInBatch.has(order.externalCode)) {
            const firstOccurrence = codeCountMap.get(order.externalCode)!;
            if (firstOccurrence !== orderIdx) {
              newErrors.push({ field: 'externalCode', message: `批次内重复（与第${firstOccurrence + 1}行重复）` });
            }
          }
          
          return { ...order, errors: newErrors };
        });

        setParsedOrders(ordersWithDuplicateCheck);
        
        const endTime = Date.now();
        const elapsedTime = (endTime - startTime) / 1000;
        
        setProgress({
          percentage: 100,
          current: 100,
          total: 100,
          status: 'complete',
          message: `解析完成，共 ${ordersWithDuplicateCheck.length} 条，耗时 ${elapsedTime.toFixed(2)} 秒`,
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

  const handleUpdateCell = (index: number, field: string, value: string) => {
    const updated = [...parsedOrders];
    updated[index] = {
      ...updated[index],
      [field as keyof ParsedOrder]: field === 'quantity' ? parseFloat(value) || 1 : value,
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
      weight: 0,
      pieces: 1,
      temperature: '',
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
      '重量': order.weight,
      '件数': order.pieces,
      '温层': order.temperature,
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
    const invalidOrders = parsedOrders.filter(o => o.errors.length > 0);
    
    if (validOrders.length === 0) {
      toast.error('没有可提交的有效运单，请先修正错误');
      return;
    }

    if (invalidOrders.length > 0) {
      toast.error(`${invalidOrders.length} 条记录存在错误，请先修正后再提交`, {
        position: 'top-center',
        autoClose: 4000,
      });
      return;
    }

    setIsSubmitting(true);
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
        for (let i = 1; i <= validOrders.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 30));
          setProgress(prev => prev ? {
            ...prev,
            current: i,
            percentage: Math.round((i / validOrders.length) * 100),
            message: `正在提交 ${i} / ${validOrders.length} 条...`,
          } : null);
        }
        
        // 更新进度为完成状态
        setProgress(prev => prev ? {
          ...prev,
          percentage: 100,
          current: validOrders.length,
          status: 'complete',
          message: '提交完成',
        } : null);

        // 显示提交结果汇总
        const successCount = data.data.count || validOrders.length;
        const failedCount = validOrders.length - successCount;
        const duplicateCount = data.data.duplicates || 0;
        
        toast.success(
          <div className="text-left">
            <p className="font-semibold">提交结果汇总</p>
            <p className="text-sm mt-1">
              <span className="text-green-600">成功：{successCount} 条</span>
              {failedCount > 0 && <span className="mx-2">|</span>}
              {failedCount > 0 && <span className="text-red-600">失败：{failedCount} 条</span>}
              {duplicateCount > 0 && (
                <>
                  <span className="mx-2">|</span>
                  <span className="text-yellow-600">重复跳过：{duplicateCount} 条</span>
                </>
              )}
            </p>
          </div>,
          {
            position: 'top-center',
            autoClose: 5000,
          }
        );

        setParsedOrders([]);
        setUploadedFile(null);
        setSelectedRule(null);
        setActiveTab('upload');
      } else {
        setProgress(prev => prev ? {
          ...prev,
          status: 'error',
          message: '提交失败',
        } : null);
        toast.error(data.error || '提交失败');
      }
    } catch (error) {
      setProgress(prev => prev ? {
        ...prev,
        status: 'error',
        message: '提交失败',
      } : null);
      toast.error('提交失败');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setProgress(null), 3000);
    }
  };

  const hasErrors = parsedOrders.some(o => o.errors.length > 0);
  const totalErrors = parsedOrders.reduce((sum, o) => sum + o.errors.length, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {progress && (
        <div className="card p-5 animate-slideUp">
          <div className="flex items-center gap-4 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-normal ${
              progress.status === 'error' ? 'bg-red-100 text-red-600' :
              progress.status === 'complete' ? 'bg-green-100 text-green-600' :
              'bg-primary-100 text-primary-600'
            }`}>
              {progress.status === 'complete' ? (
                <CheckCircle className="w-5 h-5" />
              ) : progress.status === 'error' ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">{progress.message}</p>
              <p className="text-sm text-gray-500">{progress.current} / {progress.total}</p>
            </div>
          </div>
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full opacity-50 animate-pulse"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="card animate-slideUp">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800">上传文件</h2>
            <p className="text-sm text-gray-500 mt-1">支持 Excel (.xlsx/.xls)、Word (.docx)、PDF 文件</p>
          </div>
          <div className="p-6">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-normal ${
                uploadedFile 
                  ? 'border-primary-500 bg-primary-50' 
                  : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50 hover:scale-[1.01]'
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
                <div className="flex flex-col items-center gap-3 animate-bounceSoft">
                  <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center shadow-md">
                    <FileText className="w-8 h-8 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedFile(null);
                    }}
                    className="px-4 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-button text-sm font-medium transition-all"
                  >
                    更换文件
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">点击或拖拽文件到此处上传</p>
                    <p className="text-sm text-gray-500">支持 .xlsx, .xls, .docx, .pdf 格式</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">选择解析规则</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedRule?.id || ''}
                  onChange={(e) => {
                    const rule = rules.find(r => r.id === e.target.value);
                    setSelectedRule(rule || null);
                  }}
                  className="flex-1 input"
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
                  className="btn btn-primary"
                >
                  <Settings className="w-5 h-5" />
                  {isRuleGenerating ? '分析中...' : 'AI生成规则'}
                </button>
              </div>
            </div>

            {selectedRule && (
              <div className="mt-4 p-4 bg-primary-50 rounded-xl border border-primary-100 animate-slideLeft">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-primary-800">{selectedRule.name}</p>
                    <p className="text-sm text-primary-600">{selectedRule.description}</p>
                  </div>
                  <button
                    onClick={() => setSelectedRule(null)}
                    className="px-3 py-1 text-primary-600 hover:text-primary-700 hover:bg-primary-100 rounded-button text-sm font-medium transition-all"
                  >
                    取消选择
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleExecuteParse}
                disabled={!uploadedFile || !selectedRule}
                className="btn btn-primary text-base px-8"
              >
                开始解析
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preview' && parsedOrders.length === 0 && (
        <div className="card animate-slideUp">
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">没有可预览的数据</h3>
            <p className="text-gray-500 mb-6">运单已提交或尚未解析，请返回上传页面重新导入</p>
            <button
              onClick={() => setActiveTab('upload')}
              className="btn btn-primary"
            >
              返回上传
            </button>
          </div>
        </div>
      )}

      {activeTab === 'preview' && parsedOrders.length > 0 && (
        <div className="space-y-4 animate-slideUp">
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-3 py-1.5 rounded-button flex items-center gap-1 transition-all font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  返回上传
                </button>
                <div className="h-4 w-px bg-gray-200" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    共 {parsedOrders.length} 条记录
                  </span>
                  {hasErrors && (
                    <span className="inline-flex items-center gap-1 text-sm text-red-600 bg-red-50 px-2 py-1 rounded-full">
                      <AlertCircle className="w-4 h-4" />
                      {totalErrors} 个错误
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="btn btn-secondary"
                >
                  <Download className="w-4 h-4" />
                  导出 Excel
                </button>
                <button
                  onClick={handleAddRow}
                  className="btn btn-outline"
                >
                  <Plus className="w-4 h-4" />
                  新增行
                </button>
                <button
                  onClick={handleSubmitOrders}
                  disabled={hasErrors || isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    '提交下单'
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <VirtualTable
              data={parsedOrders}
              onUpdateCell={handleUpdateCell}
              onDeleteRow={handleDeleteRow}
              onAddRow={handleAddRow}
            />
            {hasErrors && (
              <div className="p-4 bg-red-50 border-t border-red-100">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <h4 className="font-semibold text-red-800">错误列表</h4>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {parsedOrders.map((order, index) => 
                    order.errors.map((error, errorIndex) => (
                      <p key={errorIndex} className="text-sm text-red-600 bg-white px-3 py-2 rounded-lg border border-red-100">
                        <span className="font-medium">第 {index + 1} 行</span> - {error.field}: {error.message}
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-slideUp">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">AI生成解析规则</h3>
              </div>
              <button
                onClick={() => setShowRuleEditor(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">规则名称</label>
                <input
                  value={generatedRule.name}
                  onChange={(e) => setGeneratedRule(prev => ({ ...prev!, name: e.target.value }))}
                  className="input"
                  placeholder="请输入规则名称"
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">描述</label>
                <textarea
                  value={generatedRule.description}
                  onChange={(e) => setGeneratedRule(prev => ({ ...prev!, description: e.target.value }))}
                  className="input"
                  rows={3}
                  placeholder="请输入规则描述"
                />
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-primary-500 rounded-full" />
                  <p className="text-sm font-medium text-gray-700">字段映射（AI置信度标注）</p>
                </div>
                <div className="space-y-3">
                  {generatedRule.fieldMappings.slice(0, 5).map((mapping, index) => (
                    <div key={index} className="flex items-center gap-3 text-sm bg-white px-3 py-2 rounded-lg border border-gray-100">
                      <span className="text-gray-500 font-medium w-24 truncate">{mapping.source}</span>
                      <span className="text-gray-300">→</span>
                      <span className="text-primary-600 font-medium">{mapping.target}</span>
                      {mapping.aiSuggestion && (
                        <span className="ml-auto text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                          AI建议
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowRuleEditor(false)}
                className="btn btn-outline"
              >
                取消
              </button>
              <button
                onClick={handleSaveRule}
                className="btn btn-primary"
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