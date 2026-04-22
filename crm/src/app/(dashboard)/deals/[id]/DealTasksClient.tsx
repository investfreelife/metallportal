'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Plus, Clock, AlertTriangle } from 'lucide-react'

export interface Task {
  id: string
  title: string
  body?: string
  status: 'pending' | 'done'
  priority: 'urgent' | 'high' | 'normal' | 'low'
  due_at?: string
  created_at: string
  done_at?: string
}

function fmt(date: string) {
  return new Date(date).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'text-red-400',
  high:   'text-orange-400',
  normal: 'text-gray-400',
  low:    'text-gray-600',
}
const PRIORITY_LABELS: Record<string, string> = {
  urgent: '🔴 Срочно', high: '🟠 Высокий', normal: '⚪ Обычный', low: '⚫ Низкий'
}

export default function DealTasksClient({
  dealId,
  initialTasks,
}: {
  dealId: string
  initialTasks: Task[]
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks ?? [])
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', body: '', priority: 'normal', due_at: '' })
  const [adding, setAdding] = useState(false)

  const pending = tasks.filter(t => t.status === 'pending')
  const done = tasks.filter(t => t.status === 'done')

  const toggleDone = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === task.id
        ? { ...t, status: newStatus, done_at: newStatus === 'done' ? new Date().toISOString() : undefined }
        : t))
    }
  }

  const addTask = async () => {
    if (!newTask.title.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          title: newTask.title.trim(),
          body: newTask.body || undefined,
          priority: newTask.priority,
          due_at: newTask.due_at || undefined,
        }),
      })
      const data = await res.json()
      if (data.task) {
        setTasks(prev => [data.task, ...prev])
        setNewTask({ title: '', body: '', priority: 'normal', due_at: '' })
        setShowAdd(false)
      }
    } finally { setAdding(false) }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-semibold text-sm">Задачи менеджеру</h2>
          {pending.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-semibold rounded-full">
              {pending.length}
            </span>
          )}
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg border border-gray-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Задача
        </button>
      </div>

      {/* Add task form */}
      {showAdd && (
        <div className="px-5 py-4 border-b border-gray-800 bg-gray-800/30 space-y-2">
          <input
            value={newTask.title}
            onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Описание задачи..."
            autoFocus
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500"
          />
          <div className="flex gap-2">
            <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
              className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 text-xs focus:outline-none focus:border-amber-500">
              <option value="urgent">🔴 Срочно</option>
              <option value="high">🟠 Высокий</option>
              <option value="normal">⚪ Обычный</option>
              <option value="low">⚫ Низкий</option>
            </select>
            <input type="datetime-local" value={newTask.due_at}
              onChange={e => setNewTask(p => ({ ...p, due_at: e.target.value }))}
              className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 text-xs focus:outline-none focus:border-amber-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={addTask} disabled={adding}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
              {adding ? 'Добавляю...' : 'Добавить'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="divide-y divide-gray-800/60">
        {tasks.length === 0 && (
          <div className="py-10 text-center text-gray-600 text-sm">Нет задач</div>
        )}

        {/* Pending tasks */}
        {pending.map(task => (
          <div key={task.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-800/20 group">
            <button onClick={() => toggleDone(task)} className="mt-0.5 flex-shrink-0">
              <Circle className="w-4 h-4 text-gray-600 hover:text-amber-400 transition-colors" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm">{task.title}</p>
              {task.body && <p className="text-gray-500 text-xs mt-0.5">{task.body}</p>}
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs ${PRIORITY_STYLES[task.priority]}`}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
                {task.due_at && (
                  <span className={`flex items-center gap-1 text-xs ${
                    new Date(task.due_at) < new Date() ? 'text-red-400' : 'text-gray-500'
                  }`}>
                    {new Date(task.due_at) < new Date()
                      ? <AlertTriangle className="w-3 h-3" />
                      : <Clock className="w-3 h-3" />}
                    {fmt(task.due_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Done tasks */}
        {done.length > 0 && (
          <div className="px-5 py-2 bg-gray-800/10">
            <p className="text-gray-600 text-xs font-medium mb-1">Выполнено ({done.length})</p>
            {done.map(task => (
              <div key={task.id} className="flex items-center gap-3 py-1.5">
                <button onClick={() => toggleDone(task)} className="flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </button>
                <span className="text-gray-600 text-sm line-through">{task.title}</span>
                {task.done_at && <span className="text-gray-700 text-xs">{fmt(task.done_at)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
