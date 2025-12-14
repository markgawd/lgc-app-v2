'use client'

import { useState } from 'react'
import { supabase, getLocalDate, calculateE1RM } from '@/lib/supabase'

interface OnboardingProps {
  userId: string
  onComplete: () => void
}

export default function Onboarding({ userId, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Step 1: Basic info
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [sex, setSex] = useState<'male' | 'female' | ''>('')
  const [height, setHeight] = useState('')
  
  // Step 2: Measurements
  const [measureDate, setMeasureDate] = useState(getLocalDate())
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [neck, setNeck] = useState('')
  const [hips, setHips] = useState('')
  
  // Step 3: Historical lifts
  const [squatWeight, setSquatWeight] = useState('')
  const [squatReps, setSquatReps] = useState('')
  const [squatDate, setSquatDate] = useState(getLocalDate())
  
  const [benchWeight, setBenchWeight] = useState('')
  const [benchReps, setBenchReps] = useState('')
  const [benchDate, setBenchDate] = useState(getLocalDate())
  
  const [deadliftWeight, setDeadliftWeight] = useState('')
  const [deadliftReps, setDeadliftReps] = useState('')
  const [deadliftDate, setDeadliftDate] = useState(getLocalDate())

  const handleComplete = async () => {
    setLoading(true)
    setError('')

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          birthday: birthday || null,
          sex: sex || null,
          height_inches: height ? parseInt(height) : null,
          current_weight: weight ? parseFloat(weight) : null,
          waist: waist ? parseFloat(waist) : null,
          neck: neck ? parseFloat(neck) : null,
          hips: hips ? parseFloat(hips) : null,
          onboarded: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (profileError) throw profileError

      // Save initial check-in
      if (weight || waist) {
        await supabase.from('daily_checkins').upsert({
          user_id: userId,
          date: measureDate,
          weight: weight ? parseFloat(weight) : null,
          waist: waist ? parseFloat(waist) : null,
          neck: neck ? parseFloat(neck) : null,
          hips: hips ? parseFloat(hips) : null,
          notes: 'Initial measurement from onboarding'
        }, { onConflict: 'user_id,date' })
      }

      // Save historical lifts
      const lifts = [
        { key: 'squat', name: 'Squat (Barbell)', weight: squatWeight, reps: squatReps, date: squatDate },
        { key: 'bench', name: 'Bench Press (Barbell)', weight: benchWeight, reps: benchReps, date: benchDate },
        { key: 'deadlift', name: 'Deadlift (Barbell)', weight: deadliftWeight, reps: deadliftReps, date: deadliftDate }
      ]

      for (const lift of lifts) {
        if (lift.weight && lift.reps && lift.date) {
          const w = parseFloat(lift.weight)
          const r = parseInt(lift.reps)
          const e1rm = calculateE1RM(w, r)

          await supabase.from('workout_sets').upsert({
            user_id: userId,
            date: lift.date,
            exercise: lift.key,
            exercise_name: lift.name,
            sets: [{ weight: w, reps: r, set_number: 1 }],
            best_weight: w,
            best_reps: r,
            e1rm: e1rm
          }, { onConflict: 'user_id,date,exercise' })
        }
      }

      onComplete()
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="card w-full max-w-md p-6 my-8">
        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full ${step >= s ? 'bg-[#FF6B35]' : 'bg-gray-600'}`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-2 text-center">Welcome to LGC</h2>
            <p className="text-gray-400 text-sm text-center mb-6">Let's set up your profile</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Mark"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Birthday</label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Sex</label>
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value as any)}
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Height (total inches)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="e.g., 70 for 5'10&quot;"
                />
                <p className="text-xs text-gray-500 mt-1">We'll never ask again</p>
              </div>

              <button
                onClick={() => setStep(2)}
                className="btn btn-primary w-full mt-4"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Measurements */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-2 text-center">Current Measurements</h2>
            <p className="text-gray-400 text-sm text-center mb-6">We'll track changes over time</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Measurement Date</label>
                <input
                  type="date"
                  value={measureDate}
                  onChange={(e) => setMeasureDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Weight (lbs)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g., 175"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Waist (inches)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={waist}
                    onChange={(e) => setWaist(e.target.value)}
                    placeholder="e.g., 32"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Neck (inches)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={neck}
                    onChange={(e) => setNeck(e.target.value)}
                    placeholder="e.g., 15"
                  />
                </div>
                {sex === 'female' && (
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Hips (inches)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={hips}
                      onChange={(e) => setHips(e.target.value)}
                      placeholder="e.g., 38"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep(1)} className="btn btn-secondary flex-1">
                  ← Back
                </button>
                <button onClick={() => setStep(3)} className="btn btn-primary flex-1">
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Historical Lifts */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold mb-2 text-center">Your Recent Lifts</h2>
            <p className="text-gray-400 text-sm text-center mb-4">Skip any you haven't done</p>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
              {/* Squat */}
              <div className="p-3 bg-[#252525] rounded-lg">
                <div className="font-medium mb-2">🏋️ Squat (Barbell)</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">Weight</label>
                    <input
                      type="number"
                      value={squatWeight}
                      onChange={(e) => setSquatWeight(e.target.value)}
                      placeholder="lbs"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Reps</label>
                    <input
                      type="number"
                      value={squatReps}
                      onChange={(e) => setSquatReps(e.target.value)}
                      placeholder="reps"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">When?</label>
                    <input
                      type="date"
                      value={squatDate}
                      onChange={(e) => setSquatDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Bench */}
              <div className="p-3 bg-[#252525] rounded-lg">
                <div className="font-medium mb-2">🏋️ Bench Press</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">Weight</label>
                    <input
                      type="number"
                      value={benchWeight}
                      onChange={(e) => setBenchWeight(e.target.value)}
                      placeholder="lbs"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Reps</label>
                    <input
                      type="number"
                      value={benchReps}
                      onChange={(e) => setBenchReps(e.target.value)}
                      placeholder="reps"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">When?</label>
                    <input
                      type="date"
                      value={benchDate}
                      onChange={(e) => setBenchDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Deadlift */}
              <div className="p-3 bg-[#252525] rounded-lg">
                <div className="font-medium mb-2">🏋️ Deadlift</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">Weight</label>
                    <input
                      type="number"
                      value={deadliftWeight}
                      onChange={(e) => setDeadliftWeight(e.target.value)}
                      placeholder="lbs"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Reps</label>
                    <input
                      type="number"
                      value={deadliftReps}
                      onChange={(e) => setDeadliftReps(e.target.value)}
                      placeholder="reps"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">When?</label>
                    <input
                      type="date"
                      value={deadliftDate}
                      onChange={(e) => setDeadliftDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(2)} className="btn btn-secondary flex-1">
                ← Back
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="btn btn-primary flex-1"
              >
                {loading ? 'Saving...' : 'Start Tracking →'}
              </button>
            </div>

            <p className="text-gray-500 text-xs text-center mt-3">
              Don't know your lifts? Skip and log them after your next workout.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
