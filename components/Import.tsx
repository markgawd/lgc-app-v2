'use client'

import { useState, useRef } from 'react'
import { supabase, calculateE1RM } from '@/lib/supabase'

interface ImportProps {
  userId: string
  onImport: () => void
}

export default function Import({ userId, onImport }: ImportProps) {
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addLog = (msg: string) => {
    setLog(prev => [...prev, msg])
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setProgress(0)
    setLog([])
    addLog(`📂 Reading ${file.name}...`)

    try {
      const text = await file.text()
      const lines = text.trim().split('\n')
      const headers = parseCSVLine(lines[0])

      addLog(`Found ${lines.length - 1} rows`)

      // Detect file type
      if (headers.includes('Exercise Name')) {
        await importWorkouts(lines, headers)
      } else if (headers.includes('Measurement Type')) {
        await importMeasurements(lines, headers)
      } else {
        addLog('⚠️ Unknown file format')
      }

      onImport()
    } catch (err) {
      console.error('Import error:', err)
      addLog(`❌ Error: ${err}`)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const importWorkouts = async (lines: string[], headers: string[]) => {
    addLog('🏋️ Detected workout file')

    const dateIdx = headers.indexOf('Date')
    const exerciseIdx = headers.indexOf('Exercise Name')
    const setOrderIdx = headers.indexOf('Set Order')
    const weightIdx = headers.indexOf('Weight')
    const repsIdx = headers.indexOf('Reps')
    const rpeIdx = headers.indexOf('RPE')

    // Group by date + exercise
    const workoutMap: Map<string, any> = new Map()
    let processed = 0

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      if (cols.length < 5) continue

      const dateStr = cols[dateIdx]?.split(' ')[0]
      const exerciseName = cols[exerciseIdx]
      const setOrder = cols[setOrderIdx]
      const weight = parseFloat(cols[weightIdx]) || 0
      const reps = parseInt(cols[repsIdx]) || 0

      // Skip warmups
      if (setOrder === 'W' || !weight || !reps) continue

      // Map exercise names to keys
      let exerciseKey = ''
      const nameLower = exerciseName.toLowerCase()
      if (nameLower.includes('squat') && !nameLower.includes('split')) exerciseKey = 'squat'
      else if (nameLower.includes('bench press') && !nameLower.includes('incline') && !nameLower.includes('close')) exerciseKey = 'bench'
      else if (nameLower.includes('deadlift') && !nameLower.includes('romanian') && !nameLower.includes('stiff')) exerciseKey = 'deadlift'
      else if (nameLower.includes('chin') || (nameLower.includes('pull') && nameLower.includes('up'))) exerciseKey = 'chinup'
      else if (nameLower.includes('row') && nameLower.includes('barbell')) exerciseKey = 'row'
      else if (nameLower.includes('overhead') || nameLower.includes('ohp') || nameLower.includes('shoulder press')) exerciseKey = 'ohp'

      if (!exerciseKey) continue

      const key = `${dateStr}|${exerciseKey}`
      if (!workoutMap.has(key)) {
        workoutMap.set(key, {
          date: dateStr,
          exercise: exerciseKey,
          exercise_name: exerciseName,
          bestWeight: 0,
          bestReps: 0,
          sets: []
        })
      }

      const entry = workoutMap.get(key)!
      entry.sets.push({ weight, reps, set_number: entry.sets.length + 1 })
      
      if (weight > entry.bestWeight || (weight === entry.bestWeight && reps > entry.bestReps)) {
        entry.bestWeight = weight
        entry.bestReps = reps
      }

      processed++
      setProgress(Math.round((i / lines.length) * 50))
    }

    addLog(`📊 Found ${workoutMap.size} unique workout entries`)

    // Save to database in batches
    const entries = Array.from(workoutMap.values())
    let saved = 0

    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50).map(entry => ({
        user_id: userId,
        date: entry.date,
        exercise: entry.exercise,
        exercise_name: entry.exercise_name,
        sets: entry.sets,
        best_weight: entry.bestWeight,
        best_reps: entry.bestReps,
        e1rm: calculateE1RM(entry.bestWeight, entry.bestReps)
      }))

      const { error } = await supabase
        .from('workout_sets')
        .upsert(batch, { onConflict: 'user_id,date,exercise' })

      if (error) {
        addLog(`⚠️ Batch error: ${error.message}`)
      } else {
        saved += batch.length
      }

      setProgress(50 + Math.round((i / entries.length) * 50))
    }

    addLog(`✅ Imported ${saved} workout entries`)
  }

  const importMeasurements = async (lines: string[], headers: string[]) => {
    addLog('📏 Detected measurement file')

    const dateIdx = headers.indexOf('Date')
    const typeIdx = headers.indexOf('Measurement Type')
    const valueIdx = headers.indexOf('Value')

    // Group by date
    const measureMap: Map<string, any> = new Map()

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      if (cols.length < 3) continue

      const dateStr = cols[dateIdx]?.split(' ')[0]
      const type = cols[typeIdx]?.toLowerCase()
      const value = parseFloat(cols[valueIdx])

      if (!dateStr || !value) continue

      if (!measureMap.has(dateStr)) {
        measureMap.set(dateStr, { date: dateStr })
      }

      const entry = measureMap.get(dateStr)!
      if (type.includes('weight')) entry.weight = value
      if (type.includes('waist')) entry.waist = value

      setProgress(Math.round((i / lines.length) * 50))
    }

    addLog(`📊 Found ${measureMap.size} measurement days`)

    // Save to database
    const entries = Array.from(measureMap.values())
    let saved = 0

    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50).map(entry => ({
        user_id: userId,
        date: entry.date,
        weight: entry.weight || null,
        waist: entry.waist || null
      }))

      const { error } = await supabase
        .from('daily_checkins')
        .upsert(batch, { onConflict: 'user_id,date' })

      if (!error) saved += batch.length

      setProgress(50 + Math.round((i / entries.length) * 50))
    }

    addLog(`✅ Imported ${saved} check-in entries`)
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Import Data</h2>

      {/* Drop zone */}
      <div
        className="card p-8 border-2 border-dashed border-gray-600 text-center cursor-pointer hover:border-[#FF6B35] transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="text-4xl mb-4">📤</div>
        <div className="text-lg font-medium mb-2">
          {importing ? 'Importing...' : 'Click to upload CSV'}
        </div>
        <div className="text-sm text-gray-400">
          Supports Strong app exports (workouts, weight, waist)
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {/* Progress */}
      {importing && (
        <div className="card p-4 mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Importing...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FF6B35] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="card p-4 mt-4 max-h-48 overflow-y-auto">
          <div className="text-sm font-medium mb-2">Import Log</div>
          {log.map((msg, i) => (
            <div key={i} className="text-xs text-gray-400 py-1 border-b border-gray-700 last:border-0">
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="card p-4 mt-4">
        <div className="text-sm font-medium mb-2">How to export from Strong app</div>
        <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside">
          <li>Open Strong app → Settings</li>
          <li>Tap "Export Workout Data"</li>
          <li>Choose CSV format</li>
          <li>Share/save the file</li>
          <li>Upload it here</li>
        </ol>
      </div>
    </div>
  )
}
