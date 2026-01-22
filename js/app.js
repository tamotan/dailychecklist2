import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { TaskDatabase } from './database.js';

// データベースクライアントの初期化
const db = new TaskDatabase(
  'https://hspbssdalvqeboayvife.supabase.co',
  'sb_publishable_g2EI7qati9zcyUTCL4_L2w_XfZ2Egwt'
);

// 定数定義
const MAX_RECORDS = 10; // 最大保持レコード数

const defaultTasks = [
  { name: '日々の学習', checked: false, timestamp: '', deleted: false },
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
    // タイムスタンプをyyyy/mm/dd hh:mm形式に変換（秒を除外）
    formatTimestamp(timestamp) {
      if (!timestamp) return '';
      // yyyy/mm/dd hh:mm:ss から yyyy/mm/dd hh:mm に変換
      return timestamp.substring(0, 16);
    },
    // 現在時刻をyyyy/mm/dd hh:mm:ss形式で取得
    getCurrentTimestamp() {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
    },
    async loadTasks() {
      this.loading = true;
      this.error = null;
      try {
        const data = await db.loadTasks();

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
        const data = await db.insertTasks(defaultTasks);
        
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
      const newTimestamp = newChecked ? this.getCurrentTimestamp() : '';

      try {
        await db.updateTask(taskId, {
          checked: newChecked,
          timestamp: newTimestamp
        });

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

        // タイムスタンプを yyyy/mm/dd hh:mm:ss 形式で生成
        const timestamp = this.getCurrentTimestamp();

        await db.insertTasks([{
          name,
          checked: false,
          timestamp: timestamp,
          deleted: false
        }]);

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
        await db.cleanupOldRecords(MAX_RECORDS);
      } catch (err) {
        console.error('古いレコードの削除エラー:', err);
        throw err;
      }
    },
    async deleteTask(taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;

      try {
        await db.softDeleteTask(taskId);

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
        await db.updateTask(task.id, { name: newName });

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
