'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { ParsedOrder } from '@/lib/types';

interface VirtualTableProps {
  data: ParsedOrder[];
  onUpdateCell: (index: number, field: string, value: string) => void;
  onDeleteRow: (index: number) => void;
  onAddRow: () => void;
}

const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 20;
const BUFFER_ROWS = 5;

const columns: Array<{ key: string; label: string; width: number; editable: boolean }> = [
  { key: 'rowIndex', label: '行号', width: 60, editable: false },
  { key: 'externalCode', label: '外部编码', width: 120, editable: true },
  { key: 'storeName', label: '收货门店', width: 150, editable: true },
  { key: 'recipientName', label: '收件人姓名', width: 100, editable: true },
  { key: 'recipientPhone', label: '收件人电话', width: 120, editable: true },
  { key: 'recipientAddress', label: '收件人地址', width: 200, editable: true },
  { key: 'skuCode', label: 'SKU编码', width: 100, editable: true },
  { key: 'skuName', label: 'SKU名称', width: 150, editable: true },
  { key: 'quantity', label: '数量', width: 80, editable: true },
  { key: 'spec', label: '规格', width: 100, editable: true },
  { key: 'remark', label: '备注', width: 100, editable: true },
  { key: 'actions', label: '操作', width: 60, editable: false },
];

const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

type ColumnType = Array<{ key: string; label: string; width: number; editable: boolean }>;

function RowRenderer({
  order,
  columns,
  globalIndex,
  onUpdateCell,
  onDeleteRow,
}: {
  order: ParsedOrder;
  columns: ColumnType;
  globalIndex: number;
  onUpdateCell: (index: number, field: string, value: string) => void;
  onDeleteRow: (index: number) => void;
}) {
  const renderCell = (column: typeof columns[0]) => {
    if (column.key === 'rowIndex') {
      return <span className="text-sm text-gray-500">{globalIndex + 1}</span>;
    }

    if (column.key === 'actions') {
      return (
        <button
          onClick={() => onDeleteRow(globalIndex)}
          className="text-red-500 hover:text-red-700 p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      );
    }

    const field = column.key as keyof ParsedOrder;
    const value = order[field];
    const hasError = order.errors.some((e: { field: string }) => e.field === field);

    return (
      <input
        type={field === 'quantity' ? 'number' : 'text'}
        value={value as string | number}
        onChange={(e) => onUpdateCell(globalIndex, field, e.target.value)}
        className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 ${
          hasError
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50'
            : 'border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-primary-500'
        }`}
      />
    );
  };

  return (
    <div
      className={`flex border-b transition-colors ${
        order.errors.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'
      }`}
      style={{ width: totalWidth, height: ROW_HEIGHT }}
    >
      {columns.map((col) => (
        <div
          key={col.key}
          className="px-4 py-2 border-r last:border-r-0 flex items-center"
          style={{ width: col.width, minWidth: col.width }}
        >
          {renderCell(col)}
        </div>
      ))}
    </div>
  );
}

export default function VirtualTable({ data, onUpdateCell, onDeleteRow, onAddRow }: VirtualTableProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevScrollRef = useRef(0);
  const isScrollingRef = useRef(false);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
    
    isScrollingRef.current = true;
    if (prevScrollRef.current !== target.scrollTop) {
      prevScrollRef.current = target.scrollTop;
    }
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isScrollingRef.current) {
      timeout = setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    }
    return () => clearTimeout(timeout);
  }, [scrollTop]);

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endIndex = Math.min(startIndex + VISIBLE_ROWS + BUFFER_ROWS * 2, data.length);
  const visibleData = data.slice(startIndex, endIndex);

  const offsetTop = startIndex * ROW_HEIGHT;
  const containerHeight = VISIBLE_ROWS * ROW_HEIGHT;
  const totalHeight = data.length * ROW_HEIGHT;

  return (
    <div className="relative">
      <div 
        className="flex bg-gray-50 border-b sticky top-0 z-10"
        style={{ width: totalWidth, minWidth: '100%' }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className="px-4 py-3 text-left text-sm font-medium text-gray-600 border-r last:border-r-0 shrink-0"
            style={{ width: col.width, minWidth: col.width }}
          >
            {col.label}
          </div>
        ))}
      </div>

      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div 
          style={{ 
            height: totalHeight, 
            position: 'relative', 
            width: totalWidth,
            minWidth: totalWidth
          }}
        >
          <div 
            style={{ 
              position: 'absolute', 
              top: offsetTop,
              width: totalWidth
            }}
          >
            {visibleData.map((order, index) => (
              <RowRenderer
                key={order.id}
                order={order}
                columns={columns}
                globalIndex={startIndex + index}
                onUpdateCell={onUpdateCell}
                onDeleteRow={onDeleteRow}
              />
            ))}
          </div>
        </div>
      </div>

      {data.length === 0 && (
        <div className="flex items-center justify-center py-12 text-gray-500">
          暂无数据
        </div>
      )}

      {data.length > VISIBLE_ROWS && (
        <div className="flex items-center justify-center gap-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
          <span>显示 {startIndex + 1}-{Math.min(endIndex, data.length)} 条，共 {data.length} 条</span>
          <div className="flex gap-1">
            <button
              onClick={() => {
                if (containerRef.current) {
                  containerRef.current.scrollTop = 0;
                }
              }}
              className="px-3 py-1 text-primary-600 hover:bg-primary-50 rounded transition-colors"
            >
              首页
            </button>
            <button
              onClick={() => {
                if (containerRef.current) {
                  containerRef.current.scrollTop = Math.max(0, scrollTop - containerHeight);
                }
              }}
              className="px-3 py-1 text-primary-600 hover:bg-primary-50 rounded transition-colors"
            >
              上一页
            </button>
            <button
              onClick={() => {
                if (containerRef.current) {
                  containerRef.current.scrollTop = Math.min(totalHeight - containerHeight, scrollTop + containerHeight);
                }
              }}
              className="px-3 py-1 text-primary-600 hover:bg-primary-50 rounded transition-colors"
            >
              下一页
            </button>
            <button
              onClick={() => {
                if (containerRef.current) {
                  containerRef.current.scrollTop = totalHeight - containerHeight;
                }
              }}
              className="px-3 py-1 text-primary-600 hover:bg-primary-50 rounded transition-colors"
            >
              末页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
