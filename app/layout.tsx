'use client';

// app/layout.tsx
// Root layout component

import './globals.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useState, useEffect } from 'react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    const handlePathChange = () => {
      const path = window.location.pathname;
      if (path === '/') setActiveNav('home');
      else if (path.startsWith('/orders')) setActiveNav('orders');
      else if (path.startsWith('/rules')) setActiveNav('rules');
    };

    handlePathChange();
    handleScroll();
    
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('popstate', handlePathChange);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('popstate', handlePathChange);
    };
  }, []);

  const navItems = [
    { key: 'home', label: '导入下单', href: '/' },
    { key: 'orders', label: '已导入运单', href: '/orders' },
    { key: 'rules', label: '解析规则', href: '/rules' },
  ];

  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50">
        <div className="min-h-screen flex flex-col">
          <header 
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-normal ${
              isScrolled 
                ? 'bg-white/95 backdrop-blur-sm shadow-card' 
                : 'bg-white shadow-sm'
            }`}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-3 group cursor-pointer">
                  <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center transition-transform duration-normal group-hover:scale-105">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-800">万能导入系统</h1>
                    <p className="text-xs text-gray-500">智能多格式批量下单</p>
                  </div>
                </div>
                <nav className="flex items-center gap-1">
                  {navItems.map((item) => (
                    <a
                      key={item.key}
                      href={item.href}
                      onClick={() => setActiveNav(item.key)}
                      className={`relative px-4 py-2 rounded-button font-medium transition-all duration-fast ${
                        activeNav === item.key
                          ? 'text-primary-600 bg-primary-50'
                          : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                      }`}
                    >
                      {item.label}
                      {activeNav === item.key && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-500 rounded-full" />
                      )}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-20 pb-8">
            {children}
          </main>
          <footer className="bg-white border-t border-gray-100 py-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
              <span className="text-primary-600 font-medium">万能导入系统</span> · 基于 Next.js + TypeScript + Neon Database
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
          toastClassName="toast-custom"
        />
      </body>
    </html>
  );
}