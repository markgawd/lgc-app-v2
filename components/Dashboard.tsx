'use client'

import { useState, useEffect } from 'react'
import { supabase, calculateLGCScore, formatDate, Profile, WorkoutSet, DailyCheckin } from '@/lib/supabase'

interface DashboardProps {
  userId: string
  profile: Profile | null
}

export default function Dashboard({ userId, profile }: DashboardProps) {
  const [loading, setLoading] = useState(true)
  const [latestLifts, setLatestLifts] = useState<{ squat: number; bench: number; deadlift: number }>({ squat: 0, bench: 0, deadlift: 0 })
  const [latestWaist, setLatestWaist] = useState<number>(0)
  const [lgcScore, setLgcScore] = useState<number>(0)
  const [workoutsThisMonth, setWorkoutsThisMonth] = useState<number>(0)
  const [checkinStreak, setCheckinStreak] = useState<number>(0)
  const [recentWins, setRecentWins] = useState<string[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [userId])

  const loadDashboardData = async () => {
    setLoading(true)

    try {
      // Get latest e1RM for each lift
      const { data: workouts } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(100)

      const lifts = { squat: 0, bench: 0, deadlift: 0 }
      if (workouts) {
        for (const w of workouts) {
          if (w.exercise === 'squat' && w.e1rm > lifts.squat) lifts.squat = w.e1rm
          if (w.exercise === 'bench' && w.e1rm > lifts.bench) lifts.bench = w.e1rm
          if (w.exercise === 'deadlift' && w.e1rm > lifts.deadlift) lifts.deadlift = w.e1rm
        }

        // Count workouts this month
        const thisMonth = new Date().toISOString().slice(0, 7)
        const monthWorkouts = new Set(workouts.filter(w => w.date.startsWith(thisMonth)).map(w => w.date)).size
        setWorkoutsThisMonth(monthWorkouts)
      }
      setLatestLifts(lifts)

      // Get latest waist measurement
      const { data: checkins } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30)

      let waist = 0
      let streak = 0
      if (checkins) {
        // Find latest waist
        for (const c of checkins) {
          if (c.waist) {
            waist = c.waist
            break
          }
        }
        
        // Calculate 7-day streak
        const last7Days: string[] = []
        for (let i = 0; i < 7; i++) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          last7Days.push(d.toISOString().split('T')[0])
        }
        streak = checkins.filter(c => last7Days.includes(c.date)).length
      }
      setLatestWaist(waist)
      setCheckinStreak(streak)

      // Calculate LGC Score
      const score = calculateLGCScore(lifts.squat, lifts.bench, lifts.deadlift, waist)
      setLgcScore(score)

      // Generate wins
      const wins: string[] = []
      if (lifts.squat + lifts.bench + lifts.deadlift >= 1000) {
        wins.push('🏆 1,000 lb Club member!')
      }
      if (waist && waist < 33) {
        wins.push('📏 Waist under 33 inches')
      }
      if (streak >= 5) {
        wins.push('🔥 5+ check-ins this week')
      }
      if (score >= 300) {
        wins.push('💪 LGC Score over 300')
      }
      setRecentWins(wins)

    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner"></div>
      </div>
    )
  }

  const total = latestLifts.squat + latestLifts.bench + latestLifts.deadlift

  return (
    <div className="p-4">
      {/* Hero LGC Score */}
      <div className="card text-center py-6 mb-4">
        <div className="text-gray-400 text-sm mb-1">LGC Score</div>
        <div className="text-6xl font-bold" style={{ color: '#FF6B35' }}>
          {lgcScore || '—'}
        </div>
        <div className="text-gray-500 text-sm mt-2">
          {total > 0 && latestWaist > 0 ? (
            `${total} lb / ${latestWaist}" waist`
          ) : (
            'Log workouts & measurements to calculate'
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-white">{latestLifts.squat || '—'}</div>
          <div className="text-xs text-gray-400">Squat e1RM</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-white">{latestLifts.bench || '—'}</div>
          <div className="text-xs text-gray-400">Bench e1RM</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-white">{latestLifts.deadlift || '—'}</div>
          <div className="text-xs text-gray-400">Deadlift e1RM</div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card py-3 px-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-lg font-bold">{workoutsThisMonth}</div>
              <div className="text-xs text-gray-400">Workouts this month</div>
            </div>
            <div className="text-2xl">🏋️</div>
          </div>
        </div>
        <div className="card py-3 px-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-lg font-bold">{checkinStreak}/7</div>
              <div className="text-xs text-gray-400">Weekly check-ins</div>
            </div>
            <div className="text-2xl">{checkinStreak >= 5 ? '🔥' : '📝'}</div>
          </div>
        </div>
      </div>

      {/* Check-in Streak Progress */}
      <div className="card p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium">Weekly Check-in Goal</div>
          <div className="text-sm text-gray-400">{checkinStreak}/5 days</div>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-500"
            style={{ 
              width: `${Math.min(100, (checkinStreak / 5) * 100)}%`,
              backgroundColor: checkinStreak >= 5 ? '#10b981' : '#FF6B35'
            }}
          />
        </div>
        {checkinStreak >= 5 && (
          <div className="text-sm text-green-400 mt-2">✓ Goal achieved this week!</div>
        )}
      </div>

      {/* Recent Wins */}
      {recentWins.length > 0 && (
        <div className="card p-4">
          <div className="text-sm font-medium mb-3">Recent Wins</div>
          {recentWins.map((win, i) => (
            <div key={i} className="py-2 border-b border-gray-700 last:border-0 text-sm">
              {win}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {total === 0 && latestWaist === 0 && (
        <div className="card p-6 text-center">
          <div className="text-4xl mb-4">👋</div>
          <div className="text-lg font-medium mb-2">Welcome to LGC!</div>
          <div className="text-gray-400 text-sm">
            Log your first workout or check-in to see your LGC Score
          </div>
        </div>
      )}
    </div>
  )
}
