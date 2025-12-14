'use client'

import { useState, useEffect } from 'react'
import { supabase, getLocalDate, calculateE1RM, calculateLGCScore } from '@/lib/supabase'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data)
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Loading...</div></div>
  
  if (!user) return <Auth onAuth={(u: any) => { setUser(u); loadProfile(u.id) }} />
  
  if (!profile?.onboarded) return <Onboarding userId={user.id} onComplete={() => loadProfile(user.id)} />

  return (
    <div className="pb-24">
      <header className="p-4 border-b border-gray-800 flex justify-between items-center">
        <div>
          <div className="font-bold text-[#FF6B35]">Lazy Gains Club</div>
          <div className="text-xs text-gray-500">{user.email}</div>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-gray-400">Sign Out</button>
      </header>

      {tab === 'dashboard' && <Dashboard userId={user.id} />}
      {tab === 'workout' && <Workout userId={user.id} onSave={() => setTab('dashboard')} />}
      {tab === 'checkin' && <Checkin userId={user.id} onSave={() => setTab('dashboard')} />}
      {tab === 'history' && <History userId={user.id} />}

      <div className="tab-bar">
        {['dashboard', 'workout', 'checkin', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`tab-item ${tab === t ? 'active' : ''}`}>
            <span className="text-xl">{t === 'dashboard' ? '📊' : t === 'workout' ? '🏋️' : t === 'checkin' ? '📝' : '📜'}</span>
            <span className="capitalize">{t}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============ AUTH ============
function Auth({ onAuth }: { onAuth: (user: any) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: err } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    if (data.user) {
      if (isSignUp) {
        await supabase.from('profiles').upsert({ id: data.user.id, email, onboarded: false })
      }
      onAuth(data.user)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-[#FF6B35] mb-6">Lazy Gains Club</h1>
        {error && <div className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        <button onClick={() => setIsSignUp(!isSignUp)} className="w-full mt-4 text-sm text-gray-400">
          {isSignUp ? 'Have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
      </div>
    </div>
  )
}

// ============ ONBOARDING ============
function Onboarding({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [sex, setSex] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [loading, setLoading] = useState(false)

  const handleComplete = async () => {
    setLoading(true)
    await supabase.from('profiles').update({
      full_name: name,
      birthday: birthday || null,
      sex: sex || null,
      height_inches: height ? parseInt(height) : null,
      current_weight: weight ? parseFloat(weight) : null,
      waist: waist ? parseFloat(waist) : null,
      onboarded: true,
      updated_at: new Date().toISOString()
    }).eq('id', userId)

    if (weight || waist) {
      await supabase.from('daily_checkins').upsert({
        user_id: userId,
        date: getLocalDate(),
        weight: weight ? parseFloat(weight) : null,
        waist: waist ? parseFloat(waist) : null
      }, { onConflict: 'user_id,date' })
    }

    onComplete()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-sm">
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className={`h-2 rounded-full ${step >= s ? 'w-8 bg-[#FF6B35]' : 'w-2 bg-gray-600'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-center">Welcome to LGC</h2>
            <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSex('male')} className={`py-3 rounded-lg ${sex === 'male' ? 'bg-[#FF6B35]' : 'bg-[#252525]'}`}>Male</button>
              <button onClick={() => setSex('female')} className={`py-3 rounded-lg ${sex === 'female' ? 'bg-[#FF6B35]' : 'bg-[#252525]'}`}>Female</button>
            </div>
            <input type="number" placeholder="Height (total inches, e.g. 70)" value={height} onChange={e => setHeight(e.target.value)} />
            <button onClick={() => setStep(2)} disabled={!name} className="btn btn-primary w-full">Next →</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-center">Current Measurements</h2>
            <input type="number" step="0.1" placeholder="Weight (lbs)" value={weight} onChange={e => setWeight(e.target.value)} />
            <div>
              <input type="number" step="0.1" placeholder="Waist (inches)" value={waist} onChange={e => setWaist(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Measure at navel, relaxed</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn btn-secondary flex-1">← Back</button>
              <button onClick={handleComplete} disabled={loading || !weight || !waist} className="btn btn-primary flex-1">
                {loading ? 'Saving...' : 'Start →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============ DASHBOARD ============
function Dashboard({ userId }: { userId: string }) {
  const [score, setScore] = useState(0)
  const [lifts, setLifts] = useState({ squat: 0, bench: 0, deadlift: 0 })
  const [waist, setWaist] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    // Get latest lifts from workout_sets
    const { data: workouts } = await supabase
      .from('workout_sets')
      .select('exercise, e1rm')
      .eq('user_id', userId)
      .in('exercise', ['squat', 'bench', 'deadlift'])
      .order('date', { ascending: false })

    const best = { squat: 0, bench: 0, deadlift: 0 }
    workouts?.forEach(w => {
      const key = w.exercise as 'squat' | 'bench' | 'deadlift'
      if (w.e1rm > best[key]) best[key] = w.e1rm
    })
    setLifts(best)

    // Get latest waist from daily_checkins
    const { data: checkins } = await supabase
      .from('daily_checkins')
      .select('waist')
      .eq('user_id', userId)
      .not('waist', 'is', null)
      .order('date', { ascending: false })
      .limit(1)

    const latestWaist = checkins?.[0]?.waist || 0
    setWaist(latestWaist)

    setScore(calculateLGCScore(best.squat, best.bench, best.deadlift, latestWaist))
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  const total = lifts.squat + lifts.bench + lifts.deadlift

  return (
    <div className="p-4 space-y-4">
      <div className="card text-center py-8">
        <div className="text-gray-400 text-sm">LGC Score</div>
        <div className="text-6xl font-bold text-[#FF6B35]">{score || '—'}</div>
        {total > 0 && waist > 0 && (
          <div className="text-gray-500 text-sm mt-2">{total} lb / {waist}" waist</div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-4">
          <div className="text-2xl font-bold">{lifts.squat || '—'}</div>
          <div className="text-xs text-gray-400">Squat</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-bold">{lifts.bench || '—'}</div>
          <div className="text-xs text-gray-400">Bench</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-bold">{lifts.deadlift || '—'}</div>
          <div className="text-xs text-gray-400">Deadlift</div>
        </div>
      </div>

      {(total === 0 || waist === 0) && (
        <div className="card p-4 text-center text-gray-400 text-sm">
          {total === 0 && waist === 0 ? 'Log a workout and check-in to see your score!' : 
           total === 0 ? 'Log a workout to calculate your score' : 'Log your waist measurement to calculate your score'}
        </div>
      )}
    </div>
  )
}

// ============ WORKOUT ============
function Workout({ userId, onSave }: { userId: string; onSave: () => void }) {
  const [date, setDate] = useState(getLocalDate())
  const [exercise, setExercise] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const e1rm = weight && reps ? calculateE1RM(parseFloat(weight), parseInt(reps)) : 0

  const handleSave = async () => {
    if (!exercise || !weight || !reps) return
    setSaving(true)
    setSuccess(false)

    const w = parseFloat(weight)
    const r = parseInt(reps)
    const calc = calculateE1RM(w, r)

    const { error } = await supabase.from('workout_sets').upsert({
      user_id: userId,
      date,
      exercise,
      exercise_name: exercise.charAt(0).toUpperCase() + exercise.slice(1),
      sets: [{ weight: w, reps: r, set_number: 1 }],
      best_weight: w,
      best_reps: r,
      e1rm: calc
    }, { onConflict: 'user_id,date,exercise' })

    setSaving(false)
    if (!error) {
      setSuccess(true)
      setWeight('')
      setReps('')
      setTimeout(() => onSave(), 1000)
    } else {
      alert('Error saving: ' + error.message)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Log Workout</h2>

      <div>
        <label className="text-sm text-gray-400 block mb-1">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      <div>
        <label className="text-sm text-gray-400 block mb-1">Exercise</label>
        <div className="grid grid-cols-3 gap-2">
          {['squat', 'bench', 'deadlift'].map(ex => (
            <button key={ex} onClick={() => setExercise(ex)}
              className={`py-3 rounded-lg capitalize ${exercise === ex ? 'bg-[#FF6B35]' : 'bg-[#252525]'}`}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {exercise && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Weight (lbs)</label>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="185" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Reps</label>
              <input type="number" value={reps} onChange={e => setReps(e.target.value)} placeholder="8" />
            </div>
          </div>

          {e1rm > 0 && (
            <div className="text-center py-3 bg-[#252525] rounded-lg">
              <span className="text-gray-400">Estimated 1RM: </span>
              <span className="text-2xl font-bold text-[#FF6B35]">{e1rm} lb</span>
            </div>
          )}

          <button onClick={handleSave} disabled={saving || !weight || !reps} className="btn btn-primary w-full">
            {saving ? 'Saving...' : 'Save Workout'}
          </button>

          {success && (
            <div className="text-center text-green-400 py-2">✓ Saved!</div>
          )}
        </>
      )}
    </div>
  )
}

// ============ CHECKIN ============
function Checkin({ userId, onSave }: { userId: string; onSave: () => void }) {
  const [date, setDate] = useState(getLocalDate())
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    if (!weight && !waist) return
    setSaving(true)
    setSuccess(false)

    const { error } = await supabase.from('daily_checkins').upsert({
      user_id: userId,
      date,
      weight: weight ? parseFloat(weight) : null,
      waist: waist ? parseFloat(waist) : null
    }, { onConflict: 'user_id,date' })

    setSaving(false)
    if (!error) {
      setSuccess(true)
      setTimeout(() => onSave(), 1000)
    } else {
      alert('Error: ' + error.message)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Daily Check-in</h2>

      <div>
        <label className="text-sm text-gray-400 block mb-1">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      <div>
        <label className="text-sm text-gray-400 block mb-1">Weight (lbs)</label>
        <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="175.5" />
      </div>

      <div>
        <label className="text-sm text-gray-400 block mb-1">Waist (inches)</label>
        <input type="number" step="0.1" value={waist} onChange={e => setWaist(e.target.value)} placeholder="32.0" />
        <p className="text-xs text-gray-500 mt-1">Measure at navel, relaxed</p>
      </div>

      <button onClick={handleSave} disabled={saving || (!weight && !waist)} className="btn btn-primary w-full">
        {saving ? 'Saving...' : 'Save Check-in'}
      </button>

      {success && <div className="text-center text-green-400 py-2">✓ Saved!</div>}
    </div>
  )
}

// ============ HISTORY ============
function History({ userId }: { userId: string }) {
  const [tab, setTab] = useState<'workouts' | 'checkins'>('workouts')
  const [workouts, setWorkouts] = useState<any[]>([])
  const [checkins, setCheckins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [userId])

  const loadHistory = async () => {
    const { data: w } = await supabase
      .from('workout_sets')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(50)

    const { data: c } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(50)

    setWorkouts(w || [])
    setCheckins(c || [])
    setLoading(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('workouts')} className={`flex-1 py-2 rounded-lg ${tab === 'workouts' ? 'bg-[#FF6B35]' : 'bg-[#252525]'}`}>Workouts</button>
        <button onClick={() => setTab('checkins')} className={`flex-1 py-2 rounded-lg ${tab === 'checkins' ? 'bg-[#FF6B35]' : 'bg-[#252525]'}`}>Check-ins</button>
      </div>

      {tab === 'workouts' && (
        <div className="space-y-2">
          {workouts.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No workouts yet</div>
          ) : workouts.map((w, i) => (
            <div key={i} className="card flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-400">{w.date}</div>
                <div className="capitalize">{w.exercise}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-[#FF6B35]">{w.e1rm}</div>
                <div className="text-xs text-gray-400">e1RM</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'checkins' && (
        <div className="space-y-2">
          {checkins.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No check-ins yet</div>
          ) : checkins.map((c, i) => (
            <div key={i} className="card flex justify-between items-center">
              <div className="text-sm text-gray-400">{c.date}</div>
              <div className="flex gap-4">
                {c.weight && <div>{c.weight} lb</div>}
                {c.waist && <div>{c.waist}"</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
