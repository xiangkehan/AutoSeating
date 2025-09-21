/**
 * 数据同步管理器模块 - 处理离线端与云端的数据同步
 */

// 数据同步功能实现
const syncData = async (event, userInfo, { db, createResponse }) => {
  try {
    const { table, data, token } = event;
    
    // 验证参数
    if (!table || !data || !Array.isArray(data)) {
      return createResponse(false, null, '缺少或无效的参数', 400);
    }
    
    // 检查用户权限
    if (!userInfo || !userInfo.admin_id) {
      return createResponse(false, null, '需要管理员权限', 401);
    }
    
    // 允许同步的数据表列表
    const allowedTables = ['students', 'classrooms', 'arrangement_sessions', 
      'wishes', 'seat_assignments', 'classes', 'system_logs'];
    
    if (!allowedTables.includes(table)) {
      return createResponse(false, null, `不允许同步的表: ${table}`, 403);
    }
    
    // 执行数据同步
    let syncedCount = 0;
    
    for (const item of data) {
      try {
        // 检查记录是否已存在
        const existingRecord = await db.collection(table).where({
          id: item.id
        }).get();
        
        if (existingRecord.data.length > 0) {
          // 更新现有记录
          await db.collection(table).doc(existingRecord.data[0]._id).update({
            data: item
          });
        } else {
          // 创建新记录
          await db.collection(table).add({
            data: item
          });
        }
        syncedCount++;
      } catch (err) {
        console.error(`同步单条记录失败 (${table}):`, err);
        // 继续处理下一条记录，不中断整个同步过程
      }
    }
    
    console.log(`成功同步 ${syncedCount}/${data.length} 条记录到表 ${table}`);
    
    return createResponse(
      true, 
      { syncedCount, totalCount: data.length, table }, 
      `成功同步 ${syncedCount} 条记录`
    );
  } catch (error) {
    console.error('同步数据时出错:', error);
    return createResponse(false, null, '同步数据失败: ' + error.message, 500);
  }
};

// 获取更新数据功能实现
const getUpdatedData = async (event, userInfo, { db, createResponse }) => {
  try {
    const { lastSyncTime, token } = event;
    
    // 验证用户权限
    if (!userInfo || !userInfo.admin_id) {
      return createResponse(false, null, '需要管理员权限', 401);
    }
    
    // 需要同步的数据表
    const tables = ['students', 'classrooms', 'arrangement_sessions', 
      'wishes', 'seat_assignments', 'classes', 'system_logs', 'admins'];
    
    const resultData = {};
    
    // 查询每个表的更新数据
    for (const table of tables) {
      try {
        let query = db.collection(table);
        
        // 如果提供了最后同步时间，则只获取更新的数据
        if (lastSyncTime) {
          query = query.where({
            update_time: db.command.gt(lastSyncTime)
          });
        } else {
          // 否则获取所有数据（首次同步）
          // 限制单次获取的记录数，防止数据量过大
          query = query.limit(500);
        }
        
        const result = await query.get();
        
        if (result.data.length > 0) {
          // 格式化数据，移除MongoDB的_id字段，使用业务主键
          resultData[table] = result.data.map(item => {
            const formattedItem = { ...item };
            delete formattedItem._id; // 移除MongoDB的_id
            return formattedItem;
          });
        }
      } catch (err) {
        console.error(`获取表 ${table} 数据失败:`, err);
        // 继续处理下一个表
        resultData[table] = [];
      }
    }
    
    // 记录同步日志
    await db.collection('sync_records').add({
      data: {
        admin_id: userInfo.admin_id,
        sync_type: 'download',
        last_sync_time: lastSyncTime,
        sync_time: db.serverDate(),
        table_counts: Object.entries(resultData)
          .map(([table, records]) => ({ table, count: records.length }))
      }
    });
    
    return createResponse(true, resultData, '获取更新数据成功');
  } catch (error) {
    console.error('获取更新数据时出错:', error);
    return createResponse(false, null, '获取更新数据失败: ' + error.message, 500);
  }
};

module.exports = {
  syncData,
  getUpdatedData
};