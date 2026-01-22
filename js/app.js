import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabaseクライアントの初期化
const supabase = createClient(
  'https://hspbssdalvqeboayvife.supabase.co',
  'sb_publishable_g2EI7qati9zcyUTCL4_L2w_XfZ2Egwt'
);

// 定数定義
const MAX_RECORDS = 10; // 最大保持レコード数

const defaultTasks = [
  { name: '鍵の施錠', checked: false, timestamp: '', deleted: false },
  { name: '窓の施錠', checked: false, timestamp: '', deleted: false },
  { name: '部屋の消灯', checked: false, timestamp: '', deleted: false }
];

createApp({
  data() {
    return {
      tasks: [],
      newTask: '',
      loading: false,
      error: null
    };
  },
  mounted() {
    this.loadTasks();
  },
  methods: {
    async loadTasks() {
      this.loading = true;
      this.error = null;
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('deleted', false)
          .order('checked', { ascending: true })
          .order('created_at', { ascending: true });

        if (error) throw error;

        // データがない場合はデフォルトタスクを挿入
        if (!data || data.length === 0) {
          await this.initializeDefaultTasks();
        } else {
          // 編集用のプロパティを追加
          this.tasks = data.map(task => ({
            ...task,
            editing: false,
            editingName: ''
          }));
        }
      } catch (err) {
        console.error('タスクの読み込みエラー:', err);
        this.error = 'タスクの読み込みに失敗しました';
      } finally {
        this.loading = false;
      }
    },
    async initializeDefaultTasks() {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .insert(defaultTasks)
          .select();

        if (error) throw error;
        // 編集用のプロパティを追加
        this.tasks = data.map(task => ({
          ...task,
          editing: false,
          editingName: ''
        }));
      } catch (err) {
        console.error('デフォルトタスクの初期化エラー:', err);
      }
    },
    async toggleTask(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;

      const newChecked = !task.checked;
      const newTimestamp = newChecked ? new Date().toLocaleString() : '';

      try {
        const { error } = await supabase
          .from('tasks')
          .update({ 
            checked: newChecked, 
            timestamp: newTimestamp 
          })
          .eq('id', task.id);

        if (error) throw error;

        // ローカルの状態を更新
        task.checked = newChecked;
        task.timestamp = newTimestamp;

        // リストを再読み込みして並び順を更新
        await this.loadTasks();
      } catch (err) {
        console.error('タスクの更新エラー:', err);
        this.error = 'タスクの更新に失敗しました';
      }
    },
    async addTask() {
      const name = this.newTask.trim();
      if (!name) return;

      try {
        // 最大レコード数チェックと古いレコード削除
        await this.cleanupOldRecords();

        const { data, error } = await supabase
          .from('tasks')
          .insert([{ name, checked: false, timestamp: '', deleted: false }])
          .select();

        if (error) throw error;

        this.newTask = '';
        // リストを再読み込みして並び順を更新
        await this.loadTasks();
      } catch (err) {
        console.error('タスクの追加エラー:', err);
        this.error = 'タスクの追加に失敗しました';
      }
    },
    async cleanupOldRecords() {
      try {
        // 全レコード数を取得
        const { data: allRecords, error: countError } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: true });

        if (countError) throw countError;

        // MAX_RECORDS件以上ある場合は古いレコードを削除
        if (allRecords && allRecords.length >= MAX_RECORDS) {
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

          const { error: deleteError } = await supabase
            .from('tasks')
            .delete()
            .eq('id', recordToDelete.id);

          if (deleteError) throw deleteError;

          console.log('古いレコードを削除しました:', recordToDelete);
        }
      } catch (err) {
        console.error('古いレコードの削除エラー:', err);
        throw err;
      }
    },
    async deleteTask(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;

      try {
        const { error } = await supabase
          .from('tasks')
          .update({ deleted: true })
          .eq('id', task.id);

        if (error) throw error;

        // ローカルの配列から削除して表示を更新
        this.tasks = this.tasks.filter(t => t.id !== taskId);
      } catch (err) {
        console.error('タスクの削除エラー:', err);
        this.error = 'タスクの削除に失敗しました';
      }
    },
    startEditing(task) {
      // 他の編集中のタスクをキャンセル
      this.tasks.forEach(t => {
        if (t.editing) {
          t.editing = false;
          t.editingName = '';
        }
      });
      
      // 編集モードに切り替え
      task.editing = true;
      task.editingName = task.name;
      
      // 次のティックで入力フィールドにフォーカス
      this.$nextTick(() => {
        const editInputs = this.$refs.editInput;
        if (editInputs && editInputs.length > 0) {
          editInputs[0].focus();
          editInputs[0].select();
        }
      });
    },
    async saveEdit(task) {
      const newName = task.editingName.trim();
      
      // 空の場合は編集をキャンセル
      if (!newName) {
        this.cancelEdit(task);
        return;
      }
      
      // 変更がない場合は編集モードを終了
      if (newName === task.name) {
        task.editing = false;
        task.editingName = '';
        return;
      }
      
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ name: newName })
          .eq('id', task.id);

        if (error) throw error;

        // ローカルの状態を更新
        task.name = newName;
        task.editing = false;
        task.editingName = '';
      } catch (err) {
        console.error('タスクの更新エラー:', err);
        this.error = 'タスクの更新に失敗しました';
        this.cancelEdit(task);
      }
    },
    cancelEdit(task) {
      task.editing = false;
      task.editingName = '';
    }
  }
}).mount('#app');
