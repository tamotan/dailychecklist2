import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export class TaskDatabase {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * 削除されていないタスクを読み込む
   */
  async loadTasks() {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('deleted', false)
      .order('checked', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * タスクを挿入する
   */
  async insertTasks(tasks) {
    const { data, error } = await this.supabase
      .from('tasks')
      .insert(tasks)
      .select();

    if (error) throw error;
    return data;
  }

  /**
   * タスクを更新する
   */
  async updateTask(taskId, updates) {
    const { error } = await this.supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);

    if (error) throw error;
  }

  /**
   * タスクを論理削除する
   */
  async softDeleteTask(taskId) {
    const { error } = await this.supabase
      .from('tasks')
      .update({ deleted: true })
      .eq('id', taskId);

    if (error) throw error;
  }

  /**
   * タスクを物理削除する
   */
  async hardDeleteTask(taskId) {
    const { error } = await this.supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  }

  /**
   * 古いレコードを削除する
   */
  async cleanupOldRecords(maxRecords) {
    // 全レコード数を取得
    const { data: allRecords, error: countError } = await this.supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });

    if (countError) throw countError;

    // MAX_RECORDS件以上ある場合は古いレコードを削除
    if (allRecords && allRecords.length >= maxRecords) {
      // deleted=trueのレコードを優先的に削除
      const deletedRecords = allRecords.filter(r => r.deleted);
      
      let recordToDelete;
      if (deletedRecords.length > 0) {
        // deleted=trueの中で最も古いレコードを削除
        recordToDelete = deletedRecords[0];
      } else {
        // deleted=trueがない場合は最も古いレコードを削除
        recordToDelete = allRecords[0];
      }

      await this.hardDeleteTask(recordToDelete.id);
      console.log('古いレコードを削除しました:', recordToDelete);
    }
  }
}