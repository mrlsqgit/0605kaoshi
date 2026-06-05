'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Search, Eye, Trash2, ChevronLeft, ChevronRight, FileText, Package, Loader2 } from 'lucide-react';
import { Order, OrderQueryFilter } from '@/lib/types';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState<OrderQueryFilter>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.externalCode) params.set('externalCode', filter.externalCode);
      if (filter.recipientName) params.set('recipientName', filter.recipientName);
      if (filter.startDate) params.set('startDate', filter.startDate);
      if (filter.endDate) params.set('endDate', filter.endDate);
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data.items);
        setTotal(data.data.total);
      } else {
        toast.error(data.error || '加载失败');
      }
    } catch {
      toast.error('加载运单失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="card">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">已导入运单列表</h2>
          <p className="text-sm text-gray-500 mt-1">查看所有历史导入的运单记录</p>
        </div>
        
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索外部编码..."
                  value={filter.externalCode || ''}
                  onChange={(e) => setFilter({ ...filter, externalCode: e.target.value || undefined })}
                  className="input pl-10"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="搜索收件人姓名..."
                value={filter.recipientName || ''}
                onChange={(e) => setFilter({ ...filter, recipientName: e.target.value || undefined })}
                className="input"
              />
            </div>
            <div className="min-w-[120px]">
              <input
                type="date"
                value={filter.startDate || ''}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value || undefined })}
                className="input"
              />
            </div>
            <div className="min-w-[120px]">
              <input
                type="date"
                value={filter.endDate || ''}
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value || undefined })}
                className="input"
              />
            </div>
            <button
              onClick={() => { setPage(1); loadOrders(); }}
              className="btn btn-primary"
            >
              <Search className="w-4 h-4" />
              搜索
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-sm font-semibold text-gray-600 border-b">外部编码</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-gray-600 border-b">收货门店</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-gray-600 border-b">收件人</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-gray-600 border-b">电话</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-gray-600 border-b">物品数</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-gray-600 border-b">导入时间</th>
                <th className="px-5 py-3 text-left text-sm font-semibold text-gray-600 border-b">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                      <p className="text-gray-500">加载中...</p>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-300" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">暂无运单数据</p>
                        <p className="text-sm text-gray-500">请先导入运单文件</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order, index) => (
                  <tr 
                    key={order.id} 
                    className={`border-b hover:bg-gray-50 transition-all duration-fast ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="px-5 py-3 text-sm text-gray-800 font-medium">{order.externalCode || '-'}</td>
                    <td className="px-5 py-3 text-sm text-gray-800">{order.storeName || '-'}</td>
                    <td className="px-5 py-3 text-sm text-gray-800">{order.recipientName || '-'}</td>
                    <td className="px-5 py-3 text-sm text-gray-800">{order.recipientPhone || '-'}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary-100 text-primary-600 rounded-lg text-sm font-medium">
                        {order.items?.length || 0}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="w-8 h-8 flex items-center justify-center text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all"
                        title="查看详情"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{total}</span> 条记录，第 <span className="font-medium text-gray-700">{page}</span> / {totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-outline disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-outline disabled:opacity-40"
              >
                下一页
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">运单详情</h3>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="text-sm text-gray-500 block mb-1">外部编码</label>
                  <p className="text-gray-800 font-medium">{selectedOrder.externalCode || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="text-sm text-gray-500 block mb-1">收货门店</label>
                  <p className="text-gray-800 font-medium">{selectedOrder.storeName || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="text-sm text-gray-500 block mb-1">收件人</label>
                  <p className="text-gray-800 font-medium">{selectedOrder.recipientName || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="text-sm text-gray-500 block mb-1">电话</label>
                  <p className="text-gray-800 font-medium">{selectedOrder.recipientPhone || '-'}</p>
                </div>
                <div className="col-span-2 bg-gray-50 rounded-xl p-4">
                  <label className="text-sm text-gray-500 block mb-1">地址</label>
                  <p className="text-gray-800 font-medium">{selectedOrder.recipientAddress || '-'}</p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 mb-3">物品明细 ({selectedOrder.items?.length || 0})</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-600 font-medium rounded-tl-lg">SKU编码</th>
                        <th className="px-4 py-2 text-left text-gray-600 font-medium">物品名称</th>
                        <th className="px-4 py-2 text-left text-gray-600 font-medium">数量</th>
                        <th className="px-4 py-2 text-left text-gray-600 font-medium rounded-tr-lg">规格</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="px-4 py-3">{item.skuCode}</td>
                          <td className="px-4 py-3">{item.skuName}</td>
                          <td className="px-4 py-3 font-medium text-primary-600">{item.quantity}</td>
                          <td className="px-4 py-3">{item.spec || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
