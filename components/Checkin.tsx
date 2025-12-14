'use client'

import { useState } from 'react'
import { supabase, getLocalDate } from '@/lib/supabase'

interface CheckinProps {
  userId: string
  onSave: () => void
}

export default function Checkin({ userId, onSave }: CheckinProps) {
  const [date, setDate] = useState(getLocalDate())
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [sleepQuality, setSleepQuality] = useState('7')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    if (!weight && !waist) {
      alert('Please enter at least weight or waist measurement')
      return
    }

    setLoading(true)
    setSuccess(false)

    try {
      await supabase.from('daily_checkins').upsert({
        user_id: userId,
        date: date,
        weight: weight ? parseFloat(weight) : null,
        waist: waist ? parseFloat(waist) : null,
        sleep_quality: sleepQuality ? parseInt(sleepQuality) : null,
        notes: notes || null
      }, { onConflict: 'user_id,date' })

      // Also update profile with latest measurements
      const updates: any = {}
      if (weight) updates.current_weight = parseFloat(weight)
      if (waist) updates.waist = parseFloat(waist)
      
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId)
      }

      setSuccess(true)
      setWeight('')
      setWaist('')
      setNotes('')
      onSave()
    } catch (err) {
      console.error('Error saving check-in:', err)
      alert('Failed to save check-in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Daily Check-in</h2>

      <div className="card p-4">
        {/* Date */}
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-1 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setSuccess(false)
            }}
          />
        </div>

        {/* Weight & Waist */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Weight (lbs)</label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="175.5"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Waist (inches)</label>
            <input
              type="number"
              step="0.1"
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
              placeholder="32.0"
            />
          </div>
        </div>

        {/* Sleep Quality */}
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-1 block">
            Sleep Quality: {sleepQuality}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={sleepQuality}
            onChange={(e) => setSleepQuality(e.target.value)}
            className="w-full accent-[#FF6B35]"
            style={{ background: 'transparent' }}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Poor</span>
            <span>Great</span>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-1 block">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How are you feeling?"
            rows={2}
            className="resize-none"
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? 'Saving...' : 'Save Check-in'}
        </button>

        {/* Success message */}
        {success && (
          <div className="mt-4 p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-400 text-center text-sm">
            ✓ Check-in saved for {date}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="card p-4 mt-4">
        <div className="text-sm font-medium mb-2">💡 Tips for accurate tracking</div>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Weigh yourself first thing in the morning</li>
          <li>• Measure waist at the navel, relaxed</li>
          <li>• Log 5+ days per week for best insights</li>
        </ul>
      </div>
    </div>
  )
}
