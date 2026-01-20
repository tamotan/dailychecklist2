import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabaseクライアントの初期化
const supabase = createClient(
  'https://hspbssdalvqeboayvife.supabase.co',
  'sb_publishable_g2EI7qati9zcyUTCL4_L2w_XfZ2Egwt'
);

const defaultTasks = [
  { name: '鍵の施錠', checked: false, timestamp: '' },
  { name: '窓の施錠', checked: false, timestamp: '' },
  { name: '部屋の消灯', checked: false, timestamp: '' }
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
          .order('created_at', { ascending: true });

        if (error) throw error;

        // データがない場合はデフォルトタスクを挿入
        if (!data || data.length === 0) {
          await this.initializeDefaultTasks();
        } else {
          this.tasks = data;
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
        this.tasks = data;
      } catch (err) {
        console.error('デフォルトタスクの初期化エラー:', err);
      }
    },
    async toggleTask(index) {
      const task = this.tasks[index];
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
      } catch (err) {
        console.error('タスクの更新エラー:', err);
        this.error = 'タスクの更新に失敗しました';
      }
    },
    async addTask() {
      const name = this.newTask.trim();
      if (!name) return;

      try {
        const { data, error } = await supabase
          .from('tasks')
          .insert([{ name, checked: false, timestamp: '' }])
          .select();

        if (error) throw error;

        this.tasks.push(data[0]);
        this.newTask = '';
      } catch (err) {
        console.error('タスクの追加エラー:', err);
        this.error = 'タスクの追加に失敗しました';
      }
    },
    async deleteTask(index) {
      const task = this.tasks[index];
      if (!task) return;

      try {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', task.id);

        if (error) throw error;

        this.tasks.splice(index, 1);
      } catch (err) {
        console.error('タスクの削除エラー:', err);
        this.error = 'タスクの削除に失敗しました';
      }
    },
    async uncheckAll() {
      try {
        // すべてのタスクIDを取得
        const taskIds = this.tasks.map(task => task.id);

        const { error } = await supabase
          .from('tasks')
          .update({ checked: false, timestamp: '' })
          .in('id', taskIds);

        if (error) throw error;

        // ローカルの状態を更新
        this.tasks = this.tasks.map(task => ({
          ...task,
          checked: false,
          timestamp: ''
        }));
      } catch (err) {
        console.error('一括チェック解除エラー:', err);
        this.error = '一括チェック解除に失敗しました';
      }
    }
  }
}).mount('#app');
