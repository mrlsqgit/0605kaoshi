// app/layout.tsx
// Root layout component

import './globals.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50">
        <div className="min-h-screen flex flex-col">
          <header className="bg-white shadow-sm border-b border-primary-100">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-800">万能导入系统</h1>
                    <p className="text-xs text-gray-500">智能多格式批量下单系统 V2</p>
                  </div>
                </div>
                <nav className="flex items-center gap-4">
                  <a href="/" className="text-primary-600 font-medium">导入下单</a>
                  <a href="/orders" className="text-gray-600 hover:text-primary-600">已导入运单</a>
                  <a href="/rules" className="text-gray-600 hover:text-primary-600">解析规则</a>
                </nav>
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
            {children}
          </main>
          <footer className="bg-white border-t border-gray-100 py-4">
            <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
              万能导入系统 V2 · 基于 Next.js + TypeScript + Neon
            </div>
          </footer>
        </div>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </body>
    </html>
  );
}