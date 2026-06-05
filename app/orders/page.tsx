'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Search, Eye, Trash2, ChevronLeft, ChevronRight, FileText, Package } from 'lucide-react';
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">已导入运单列表</h2>
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="搜索收件人姓名..."
                value={filter.recipientName || ''}
                onChange={(e) => setFilter({ ...filter, recipientName: e.target.value || undefined })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <input
                type="date"
                value={filter.startDate || ''}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value || undefined })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <input
                type="date"
                value={filter.endDate || ''}
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value || undefined })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <button
              onClick={() => { setPage(1); loadOrders(); }}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              搜索
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">外部编码</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">收货门店</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">收件人</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">电话</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">物品数</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-b">导入时间</th>
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
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-12 h-12 text-gray-300" />
                      <p>暂无运单数据</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-800">{order.externalCode || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{order.storeName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{order.recipientName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{order.recipientPhone || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{order.items?.length || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-primary-600 hover:text-primary-700 p-1"
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
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              共 {total} 条，第 {page} / {totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                下一页
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-gray-800">运单详情</h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-sm text-gray-500">外部编码</label>
                  <p className="text-gray-800">{selectedOrder.externalCode || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">收货门店</label>
                  <p className="text-gray-800">{selectedOrder.storeName || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">收件人</label>
                  <p className="text-gray-800">{selectedOrder.recipientName || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">电话</label>
                  <p className="text-gray-800">{selectedOrder.recipientPhone || '-'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-gray-500">地址</label>
                  <p className="text-gray-800">{selectedOrder.recipientAddress || '-'}</p>
                </div>
              </div>
              
              <h4 className="font-medium text-gray-800 mb-3">物品明细 ({selectedOrder.items?.length || 0})</h4>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600">SKU编码</th>
                    <th className="px-3 py-2 text-left text-gray-600">物品名称</th>
                    <th className="px-3 py-2 text-left text-gray-600">数量</th>
                    <th className="px-3 py-2 text-left text-gray-600">规格</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-3 py-2">{item.skuCode}</td>
                      <td className="px-3 py-2">{item.skuName}</td>
                      <td className="px-3 py-2">{item.quantity}</td>
                      <td className="px-3 py-2">{item.spec || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
