import { createTables } from './lib/db';

async function initDatabase() {
  console.log('正在初始化数据库...');
  try {
    await createTables();
    console.log('数据库表创建成功！');
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();
