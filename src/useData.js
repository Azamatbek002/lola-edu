import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Camel case converter
const toCamel = (obj) => {
  if (Array.isArray(obj)) return obj.map(toCamel)
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        toCamel(v)
      ])
    )
  }
  return obj
}

const toSnake = (obj) => {
  if (Array.isArray(obj)) return obj.map(toSnake)
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.replace(/([A-Z])/g, '_$1').toLowerCase(),
        toSnake(v)
      ])
    )
  }
  return obj
}

export function useSupabase() {
  const [data, setData] = useState({
    users: [], branches: [], groups: [], courses: [],
    attendance: [], payments: [], expenses: [], leads: [],
    grades: [], salaries: [], notifications: [], smsLog: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const tables = [
        'users', 'branches', 'groups', 'courses',
        'attendance', 'payments', 'expenses', 'leads',
        'grades', 'salaries', 'notifications'
      ]
      const results = await Promise.all(
        tables.map(t => supabase.from(t).select('*'))
      )
      const smsResult = await supabase.from('sms_log').select('*')

      const newData = {}
      tables.forEach((t, i) => {
        const key = t === 'sms_log' ? 'smsLog' : t
        newData[t] = toCamel(results[i].data || [])
      })
      newData.smsLog = toCamel(smsResult.data || [])

      // Fix groups students field
      newData.groups = newData.groups.map(g => ({
        ...g,
        students: Array.isArray(g.students) ? g.students : JSON.parse(g.students || '[]')
      }))

      setData(newData)
    } catch (e) {
      console.error('Supabase load error:', e)
    }
    setLoading(false)
  }

  // Generic upsert
  async function upsert(table, item) {
    const snakeItem = toSnake(item)
    const { error } = await supabase.from(table).upsert(snakeItem)
    if (!error) await loadAll()
    return !error
  }

  // Generic delete
  async function remove(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (!error) await loadAll()
    return !error
  }

  // Specific setters that mirror useState API
  const setUsers = async (fn) => {
    const next = typeof fn === 'function' ? fn(data.users) : fn
    const added = next.find(u => !data.users.find(x => x.id === u.id))
    const changed = next.find(u => {
      const old = data.users.find(x => x.id === u.id)
      return old && JSON.stringify(old) !== JSON.stringify(u)
    })
    if (added) await upsert('users', added)
    if (changed) await upsert('users', changed)
    if (next.length < data.users.length) {
      const removed = data.users.find(u => !next.find(x => x.id === u.id))
      if (removed) await remove('users', removed.id)
    }
  }

  const setGroups = async (fn) => {
    const next = typeof fn === 'function' ? fn(data.groups) : fn
    const added = next.find(g => !data.groups.find(x => x.id === g.id))
    const changed = next.find(g => {
      const old = data.groups.find(x => x.id === g.id)
      return old && JSON.stringify(old) !== JSON.stringify(g)
    })
    if (added) await upsert('groups', added)
    if (changed) await upsert('groups', changed)
    if (next.length < data.groups.length) {
      const removed = data.groups.find(g => !next.find(x => x.id === g.id))
      if (removed) await remove('groups', removed.id)
    }
  }

  const makeSimpleSetter = (table, key) => async (fn) => {
    const current = data[key]
    const next = typeof fn === 'function' ? fn(current) : fn
    const added = next.find(i => !current.find(x => x.id === i.id))
    const changed = next.find(i => {
      const old = current.find(x => x.id === i.id)
      return old && JSON.stringify(old) !== JSON.stringify(i)
    })
    if (added) await upsert(table, added)
    if (changed) await upsert(table, changed)
    if (next.length < current.length) {
      const removed = current.find(i => !next.find(x => x.id === i.id))
      if (removed) await remove(table, removed.id)
    }
  }

  return {
    ...data,
    loading,
    reload: loadAll,
    setUsers,
    setGroups,
    setBranches: makeSimpleSetter('branches', 'branches'),
    setCourses: makeSimpleSetter('courses', 'courses'),
    setAttendance: makeSimpleSetter('attendance', 'attendance'),
    setPayments: makeSimpleSetter('payments', 'payments'),
    setExpenses: makeSimpleSetter('expenses', 'expenses'),
    setLeads: makeSimpleSetter('leads', 'leads'),
    setGrades: makeSimpleSetter('grades', 'grades'),
    setSalaries: makeSimpleSetter('salaries', 'salaries'),
    setNotifications: makeSimpleSetter('notifications', 'notifications'),
    setSmsLog: makeSimpleSetter('sms_log', 'smsLog'),
  }
}
