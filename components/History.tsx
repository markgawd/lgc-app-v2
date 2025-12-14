'use client'

import { useState, useEffect } from 'react'
import { supabase, calculateLGCScore, formatDate, formatMonthYear } from '@/lib/supabase'

interface HistoryProps {
  userId: string
}

export default function History({ userId }: HistoryProps) {
  const [activeTab, setActiveTab] = useState<'score' | 'workouts' | 'checkins'>('score')
  const [loading, setLoading] = useState(true)
  const [lgcHistory, setLgcHistory] = useState<any[]>([])
  const [workouts, setWorkouts] = useState<any[]>([])
  const [checkins, setCheckins] = useState<any[]>([])

  useEffect(() => {
    loadHistory()
  }, [userId])

  const loadHistory = async () => {
    setLoading(true)

    try {
      // Get workouts
      const { data: workoutData } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(200)

      // Get check-ins
      const { data: checkinData } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(200)

      setWorkouts(workoutData || [])
      setCheckins(checkinData || [])

      // Calculate LGC score history
      const history = calculateLGCHistory(workoutData || [], checkinData || [])
      setLgcHistory(history)

    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateLGCHistory = (workouts: any[], checkins: any[]) => {
    const monthlyE1RMs: { [key: string]: { squat: number; bench: number; deadlift: number; waists: number[] } } = {}

    // Get best e1RM per lift per month
    workouts.forEach(w => {
      if (!['squat', 'bench', 'deadlift'].includes(w.exercise)) return

      const month = w.date.substring(0, 7)
      if (!monthlyE1RMs[month]) {
        monthlyE1RMs[month] = { squat: 0, bench: 0, deadlift: 0, waists: [] }
      }
      if (w.e1rm > monthlyE1RMs[month][w.exercise as 'squat' | 'bench' | 'deadlift']) {
        monthlyE1RMs[month][w.exercise as 'squat' | 'bench' | 'deadlift'] = w.e1rm
      }
    })

    // Get waist measurements per month
    checkins.forEach(c => {
      if (!c.waist) return
      const month = c.date.substring(0, 7)
      if (!monthlyE1RMs[month]) {
        monthlyE1RMs[month] = { squat: 0, bench: 0, deadlift: 0, waists: [] }
      }
      monthlyE1RMs[month].waists.push(c.waist)
    })

    // Carry forward e1RMs
    const sortedMonths = Object.keys(monthlyE1RMs).sort()
    let lastSquat = 0, lastBench = 0, lastDeadlift = 0

    sortedMonths.forEach(month => {
      if (monthlyE1RMs[month].squat > 0) lastSquat = monthlyE1RMs[month].squat
      else monthlyE1RMs[month].squat = lastSquat

      if (monthlyE1RMs[month].bench > 0) lastBench = monthlyE1RMs[month].bench
      else monthlyE1RMs[month].bench = lastBench

      if (monthlyE1RMs[month].deadlift > 0) lastDeadlift = monthlyE1RMs[month].deadlift
      else monthlyE1RMs[month].deadlift = lastDeadlift
    })

    // Calculate scores
    return Object.entries(monthlyE1RMs)
      .filter(([_, data]) => {
        const total = data.squat + data.bench + data.deadlift
        return total > 0 && data.waists.length > 0
      })
      .map(([month, data]) => {
        const avgWaist = data.waists.reduce((a, b) => a + b, 0) / data.waists.length
        return {
          date: month + '-01',
          squat: data.squat,
          bench: data.bench,
          deadlift: data.deadlift,
          waist: Math.round(avgWaist * 10) / 10,
          score: calculateLGCScore(data.squat, data.bench, data.deadlift, avgWaist)
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner"></div>
      </div>
    )
  }

  // Group workouts by date
  const workoutsByDate: { [key: string]: any[] } = {}
  workouts.forEach(w => {
    if (!workoutsByDate[w.date]) workoutsByDate[w.date] = []
    workoutsByDate[w.date].push(w)
  })

  return (
    <div className="p-4">
      {/* Tab buttons */}
      <div className="flex gap-2 mb-4">
        {(['score', 'workouts', 'checkins'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[#FF6B35] text-white'
                : 'bg-[#252525] text-gray-400'
            }`}
          >
            {tab === 'score' ? 'LGC Score' : tab === 'workouts' ? 'Workouts' : 'Check-ins'}
          </button>
        ))}
      </div>

      {/* LGC Score History */}
      {activeTab === 'score' && (
        <div>
          {lgcHistory.length > 0 ? (
            lgcHistory.map((h, i) => (
              <div key={i} className="card p-3 mb-2 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-400">{formatMonthYear(h.date)}</div>
                  <div className="text-sm">SQ:{h.squat} BP:{h.bench} DL:{h.deadlift}</div>
                  <div className="text-xs text-gray-500">{h.squat + h.bench + h.deadlift} lb / {h.waist}"</div>
                </div>
                <div className="text-2xl font-bold" style={{ color: '#FF6B35' }}>{h.score}</div>
              </div>
            ))
          ) : (
            <div className="card p-6 text-center text-gray-400">
              <div className="mb-2">No LGC Score history yet</div>
              <div className="text-sm">Log Big 3 lifts + waist measurements to calculate</div>
            </div>
          )}
        </div>
      )}

      {/* Workout History */}
      {activeTab === 'workouts' && (
        <div>
          {Object.keys(workoutsByDate).length > 0 ? (
            Object.entries(workoutsByDate).map(([date, lifts]) => (
              <div key={date} className="card p-3 mb-2">
                <div className="text-xs text-gray-400 mb-2">{formatDate(date)}</div>
                {lifts.map((w, i) => (
                  <div key={i} className={`flex justify-between items-center ${i > 0 ? 'mt-2 pt-2 border-t border-gray-700' : ''}`}>
                    <div className="text-sm">{w.exercise_name || w.exercise}</div>
                    <div className="text-right">
                      <span className="font-bold" style={{ color: '#FF6B35' }}>{w.e1rm}</span>
                      <span className="text-xs text-gray-400 ml-1">e1RM</span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="card p-6 text-center text-gray-400">
              No workouts logged yet
            </div>
          )}
        </div>
      )}

      {/* Check-in History */}
      {activeTab === 'checkins' && (
        <div>
          {checkins.length > 0 ? (
            checkins.map((c, i) => (
              <div key={i} className="card p-3 mb-2 flex justify-between items-center">
                <div className="text-sm text-gray-400">{formatDate(c.date)}</div>
                <div className="flex gap-4 text-sm">
                  {c.weight && <div>{c.weight} lb</div>}
                  {c.waist && <div>{c.waist}"</div>}
                </div>
              </div>
            ))
          ) : (
            <div className="card p-6 text-center text-gray-400">
              No check-ins logged yet
            </div>
          )}
        </div>
      )}
    </div>
  )
}
