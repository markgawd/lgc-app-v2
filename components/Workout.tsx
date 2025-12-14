'use client'

import { useState } from 'react'
import { supabase, getLocalDate, calculateE1RM } from '@/lib/supabase'

interface WorkoutProps {
  userId: string
  onSave: () => void
}

const WORKOUT_TYPES = {
  squat: {
    name: 'Squat Day',
    exercises: [
      { key: 'squat', name: 'Squat (Barbell)', sets: 3, reps: 10 },
      { key: 'chinup', name: 'Chin-up', sets: 3, reps: 8 }
    ]
  },
  bench: {
    name: 'Bench Day',
    exercises: [
      { key: 'bench', name: 'Bench Press (Barbell)', sets: 3, reps: 8 },
      { key: 'row', name: 'Pendlay Row (Barbell)', sets: 3, reps: 8 }
    ]
  },
  deadlift: {
    name: 'Deadlift Day',
    exercises: [
      { key: 'deadlift', name: 'Deadlift (Barbell)', sets: 2, reps: 6 },
      { key: 'ohp', name: 'Overhead Press (Barbell)', sets: 3, reps: 8 }
    ]
  }
}

interface ExerciseData {
  key: string
  name: string
  sets: Array<{ weight: string; reps: string; rpe: string }>
}

export default function Workout({ userId, onSave }: WorkoutProps) {
  const [date, setDate] = useState(getLocalDate())
  const [workoutType, setWorkoutType] = useState<'squat' | 'bench' | 'deadlift' | ''>('')
  const [exercises, setExercises] = useState<ExerciseData[]>([])
  const [loading, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleTypeChange = (type: 'squat' | 'bench' | 'deadlift') => {
    setWorkoutType(type)
    const template = WORKOUT_TYPES[type]
    setExercises(template.exercises.map(ex => ({
      key: ex.key,
      name: ex.name,
      sets: Array(ex.sets).fill(null).map(() => ({ weight: '', reps: '', rpe: '' }))
    })))
    setSuccess(false)
  }

  const updateSet = (exIndex: number, setIndex: number, field: 'weight' | 'reps' | 'rpe', value: string) => {
    const updated = [...exercises]
    updated[exIndex].sets[setIndex][field] = value
    setExercises(updated)
  }

  const handleSave = async () => {
    if (!workoutType || !date) return
    
    setSaving(true)
    setSuccess(false)

    try {
      for (const ex of exercises) {
        // Find best set (highest weight with reps)
        let bestWeight = 0
        let bestReps = 0
        const setsData: Array<{ weight: number; reps: number; rpe?: number; set_number: number }> = []

        ex.sets.forEach((set, i) => {
          if (set.weight && set.reps) {
            const w = parseFloat(set.weight)
            const r = parseInt(set.reps)
            setsData.push({
              weight: w,
              reps: r,
              rpe: set.rpe ? parseFloat(set.rpe) : undefined,
              set_number: i + 1
            })
            if (w > bestWeight || (w === bestWeight && r > bestReps)) {
              bestWeight = w
              bestReps = r
            }
          }
        })

        if (setsData.length > 0) {
          const e1rm = calculateE1RM(bestWeight, bestReps)

          await supabase.from('workout_sets').upsert({
            user_id: userId,
            date: date,
            exercise: ex.key,
            exercise_name: ex.name,
            sets: setsData,
            best_weight: bestWeight,
            best_reps: bestReps,
            e1rm: e1rm
          }, { onConflict: 'user_id,date,exercise' })
        }
      }

      setSuccess(true)
      onSave()
    } catch (err) {
      console.error('Error saving workout:', err)
      alert('Failed to save workout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Log Workout</h2>

      {/* Date picker */}
      <div className="mb-4">
        <label className="text-sm text-gray-400 mb-1 block">Workout Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Workout type selector */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {Object.entries(WORKOUT_TYPES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => handleTypeChange(key as any)}
            className={`py-3 px-2 rounded-lg text-sm font-medium transition-all ${
              workoutType === key 
                ? 'bg-[#FF6B35] text-white' 
                : 'bg-[#252525] text-gray-400 hover:bg-[#333]'
            }`}
          >
            {val.name}
          </button>
        ))}
      </div>

      {/* Exercise inputs */}
      {exercises.map((ex, exIndex) => (
        <div key={ex.key} className="card p-4 mb-4">
          <div className="font-medium mb-3">{ex.name}</div>
          
          <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 mb-2">
            <div>Set</div>
            <div>Weight (lb)</div>
            <div>Reps</div>
            <div>RPE</div>
          </div>

          {ex.sets.map((set, setIndex) => (
            <div key={setIndex} className="grid grid-cols-4 gap-2 mb-2">
              <div className="flex items-center justify-center text-gray-500">
                {setIndex + 1}
              </div>
              <input
                type="number"
                value={set.weight}
                onChange={(e) => updateSet(exIndex, setIndex, 'weight', e.target.value)}
                placeholder="185"
                className="text-sm"
              />
              <input
                type="number"
                value={set.reps}
                onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)}
                placeholder="8"
                className="text-sm"
              />
              <input
                type="number"
                step="0.5"
                value={set.rpe}
                onChange={(e) => updateSet(exIndex, setIndex, 'rpe', e.target.value)}
                placeholder="8.5"
                className="text-sm"
              />
            </div>
          ))}
        </div>
      ))}

      {/* Save button */}
      {workoutType && (
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? 'Saving...' : 'Save Workout'}
        </button>
      )}

      {/* Success message */}
      {success && (
        <div className="mt-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400 text-center">
          ✓ Workout saved!
        </div>
      )}

      {/* Instructions */}
      {!workoutType && (
        <div className="card p-6 text-center text-gray-400">
          <div className="text-4xl mb-4">🏋️</div>
          <div className="text-sm">Select a workout type above to start logging</div>
        </div>
      )}
    </div>
  )
}
