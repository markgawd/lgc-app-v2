'use client'

import { useState, useRef } from 'react'
import { supabase, calculateE1RM } from '@/lib/supabase'

interface ImportProps {
  userId: string
  onImport: () => void
}

interface ConflictInfo {
  date: string
  exercise: string
  existingE1RM: number
  newE1RM: number
  action: 'keep' | 'replace'
}

export default function Import({ userId, onImport }: ImportProps) {
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ workouts: any[], measurements: any[] } | null>(null)
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
    setConflicts([])
    addLog(`📂 Reading ${file.name}...`)

    try {
      const text = await file.text()
      const lines = text.trim().split('\n')
      const headers = parseCSVLine(lines[0])

      addLog(`Found ${lines.length - 1} rows`)

      // Detect file type and process
      if (headers.includes('Exercise Name')) {
        await processWorkouts(lines, headers)
      } else if (headers.includes('Measurement Type')) {
        await processMeasurements(lines, headers)
      } else {
        addLog('⚠️ Unknown file format')
        setImporting(false)
      }

    } catch (err) {
      console.error('Import error:', err)
      addLog(`❌ Error: ${err}`)
      setImporting(false)
    }
    
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const processWorkouts = async (lines: string[], headers: string[]) => {
    addLog('🏋️ Detected workout file')

    const dateIdx = headers.indexOf('Date')
    const exerciseIdx = headers.indexOf('Exercise Name')
    const setOrderIdx = headers.indexOf('Set Order')
    const weightIdx = headers.indexOf('Weight')
    const repsIdx = headers.indexOf('Reps')

    // Group by date + exercise
    const workoutMap: Map<string, any> = new Map()

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

      setProgress(Math.round((i / lines.length) * 30))
    }

    addLog(`📊 Found ${workoutMap.size} workout entries in CSV`)

    // Check for conflicts with existing data
    const entries = Array.from(workoutMap.values()).map(entry => ({
      ...entry,
      e1rm: calculateE1RM(entry.bestWeight, entry.bestReps)
    }))

    // Fetch existing workouts for this user
    const { data: existingWorkouts } = await supabase
      .from('workout_sets')
      .select('date, exercise, e1rm')
      .eq('user_id', userId)

    setProgress(50)

    // Find conflicts
    const conflictList: ConflictInfo[] = []
    const existingMap = new Map<string, number>()
    
    if (existingWorkouts) {
      for (const w of existingWorkouts) {
        existingMap.set(`${w.date}|${w.exercise}`, w.e1rm)
      }
    }

    for (const entry of entries) {
      const key = `${entry.date}|${entry.exercise}`
      const existingE1RM = existingMap.get(key)
      
      if (existingE1RM !== undefined) {
        conflictList.push({
          date: entry.date,
          exercise: entry.exercise,
          existingE1RM,
          newE1RM: entry.e1rm,
          action: entry.e1rm > existingE1RM ? 'replace' : 'keep'
        })
      }
    }

    setProgress(60)

    if (conflictList.length > 0) {
      // Show conflict summary
      const keepCount = conflictList.filter(c => c.action === 'keep').length
      const replaceCount = conflictList.filter(c => c.action === 'replace').length
      
      addLog(`⚠️ Found ${conflictList.length} overlapping entries`)
      addLog(`   → ${keepCount} existing records are better (will keep)`)
      addLog(`   → ${replaceCount} CSV records are better (will update)`)
      
      setConflicts(conflictList)
      setPendingImport({ workouts: entries, measurements: [] })
      setShowConflictModal(true)
      setImporting(false)
    } else {
      // No conflicts, import directly
      await executeWorkoutImport(entries)
    }
  }

  const executeWorkoutImport = async (entries: any[]) => {
    addLog(`💾 Saving workouts...`)
    
    // Fetch existing data to apply "keep best" logic
    const { data: existingWorkouts } = await supabase
      .from('workout_sets')
      .select('date, exercise, e1rm')
      .eq('user_id', userId)

    const existingMap = new Map<string, number>()
    if (existingWorkouts) {
      for (const w of existingWorkouts) {
        existingMap.set(`${w.date}|${w.exercise}`, w.e1rm)
      }
    }

    // Filter to only import entries that are NEW or BETTER
    const toImport = entries.filter(entry => {
      const key = `${entry.date}|${entry.exercise}`
      const existingE1RM = existingMap.get(key)
      
      if (existingE1RM === undefined) return true // New entry
      return entry.e1rm > existingE1RM // Better than existing
    })

    const skipped = entries.length - toImport.length
    if (skipped > 0) {
      addLog(`⏭️ Skipping ${skipped} entries (existing records are better)`)
    }

    let saved = 0
    for (let i = 0; i < toImport.length; i += 50) {
      const batch = toImport.slice(i, i + 50).map(entry => ({
        user_id: userId,
        date: entry.date,
        exercise: entry.exercise,
        exercise_name: entry.exercise_name,
        sets: entry.sets,
        best_weight: entry.bestWeight,
        best_reps: entry.bestReps,
        e1rm: entry.e1rm
      }))

      const { error } = await supabase
        .from('workout_sets')
        .upsert(batch, { onConflict: 'user_id,date,exercise' })

      if (error) {
        addLog(`⚠️ Batch error: ${error.message}`)
      } else {
        saved += batch.length
      }

      setProgress(70 + Math.round((i / toImport.length) * 30))
    }

    addLog(`✅ Imported ${saved} workout entries`)
    setImporting(false)
    setPendingImport(null)
    onImport()
  }

  const processMeasurements = async (lines: string[], headers: string[]) => {
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

    // For measurements, we merge rather than replace
    // This preserves any additional fields (sleep, notes) that might exist
    const entries = Array.from(measureMap.values())
    let saved = 0
    let merged = 0

    // Get existing check-ins
    const { data: existingCheckins } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)

    const existingMap = new Map<string, any>()
    if (existingCheckins) {
      for (const c of existingCheckins) {
        existingMap.set(c.date, c)
      }
    }

    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50).map(entry => {
        const existing = existingMap.get(entry.date)
        
        if (existing) {
          merged++
          // Merge: keep existing fields, only update weight/waist if CSV has them
          return {
            user_id: userId,
            date: entry.date,
            weight: entry.weight || existing.weight,
            waist: entry.waist || existing.waist,
            sleep_quality: existing.sleep_quality,
            notes: existing.notes,
            neck: existing.neck,
            hips: existing.hips
          }
        } else {
          return {
            user_id: userId,
            date: entry.date,
            weight: entry.weight || null,
            waist: entry.waist || null
          }
        }
      })

      const { error } = await supabase
        .from('daily_checkins')
        .upsert(batch, { onConflict: 'user_id,date' })

      if (!error) saved += batch.length

      setProgress(50 + Math.round((i / entries.length) * 50))
    }

    if (merged > 0) {
      addLog(`🔀 Merged ${merged} entries with existing data`)
    }
    addLog(`✅ Imported ${saved} check-in entries`)
    setImporting(false)
    onImport()
  }

  const handleConfirmImport = () => {
    setShowConflictModal(false)
    setImporting(true)
    if (pendingImport?.workouts.length) {
      executeWorkoutImport(pendingImport.workouts)
    }
  }

  const handleCancelImport = () => {
    setShowConflictModal(false)
    setPendingImport(null)
    setConflicts([])
    addLog('❌ Import cancelled')
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Import Data</h2>

      {/* Drop zone */}
      <div
        className="card p-8 border-2 border-dashed border-gray-600 text-center cursor-pointer hover:border-[#FF6B35] transition-colors"
        onClick={() => !importing && fileInputRef.current?.click()}
      >
        <div className="text-4xl mb-4">📤</div>
        <div className="text-lg font-medium mb-2">
          {importing ? 'Processing...' : 'Click to upload CSV'}
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
          disabled={importing}
        />
      </div>

      {/* Smart Import Info */}
      <div className="card p-4 mt-4 bg-[#1a2a1a] border border-green-900">
        <div className="text-sm font-medium text-green-400 mb-2">🛡️ Smart Import Protection</div>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• <strong>Keeps your best lifts</strong> - won't overwrite with weaker data</li>
          <li>• <strong>Merges check-ins</strong> - preserves notes and sleep data</li>
          <li>• <strong>Shows conflicts</strong> - you'll see what will change</li>
        </ul>
      </div>

      {/* Progress */}
      {importing && (
        <div className="card p-4 mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Processing...</span>
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

      {/* Conflict Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-2">⚠️ Overlapping Data Found</h3>
            <p className="text-sm text-gray-400 mb-4">
              Some entries in your CSV overlap with existing data. 
              We'll only update records where the CSV has a <strong>better e1RM</strong>.
            </p>

            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {conflicts.slice(0, 10).map((c, i) => (
                <div key={i} className={`p-2 rounded text-xs ${c.action === 'keep' ? 'bg-gray-800' : 'bg-green-900/30'}`}>
                  <div className="flex justify-between">
                    <span>{c.date} - {c.exercise}</span>
                    <span className={c.action === 'keep' ? 'text-gray-400' : 'text-green-400'}>
                      {c.action === 'keep' ? 'Keep existing' : 'Update →'}
                    </span>
                  </div>
                  <div className="text-gray-500">
                    Existing: {c.existingE1RM} e1RM → CSV: {c.newE1RM} e1RM
                  </div>
                </div>
              ))}
              {conflicts.length > 10 && (
                <div className="text-xs text-gray-500 text-center">
                  ...and {conflicts.length - 10} more
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={handleCancelImport} className="btn btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleConfirmImport} className="btn btn-primary flex-1">
                Continue Import
              </button>
            </div>
          </div>
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
