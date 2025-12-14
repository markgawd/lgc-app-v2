import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export function getLocalDate(): string {
  const now = new Date()
  // Force local timezone by using local methods
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Use this for date inputs to prevent timezone shifts
export function formatDateForInput(dateStr: string): string {
  // Ensure we're working with just the date, no time component
  return dateStr.split('T')[0]
}

export function calculateE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return Math.round(weight)
  return Math.round(weight * (36 / (37 - Math.min(reps, 12))))
}

export function calculateLGCScore(squat: number, bench: number, deadlift: number, waist: number): number {
  if (!waist || waist === 0) return 0
  const total = (squat || 0) + (bench || 0) + (deadlift || 0)
  if (total === 0) return 0
  return Math.round((total / waist) * 100) / 10
}
