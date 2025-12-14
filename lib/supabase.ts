import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database
export interface Profile {
  id: string
  email: string
  full_name?: string
  birthday?: string
  sex?: 'male' | 'female'
  height_inches?: number
  current_weight?: number
  waist?: number
  neck?: number
  hips?: number
  onboarded: boolean
  created_at: string
  updated_at: string
}

export interface DailyCheckin {
  id: string
  user_id: string
  date: string
  weight?: number
  waist?: number
  neck?: number
  hips?: number
  sleep_quality?: number
  notes?: string
  created_at: string
}

export interface WorkoutSet {
  id: string
  user_id: string
  date: string
  exercise: string
  exercise_name: string
  sets: Array<{ weight: number; reps: number; rpe?: number; set_number: number }>
  best_weight: number
  best_reps: number
  e1rm: number
  notes?: string
  created_at: string
}

// Utility functions
export function getLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calculateE1RM(weight: number, reps: number): number {
  if (reps === 1) return weight
  if (reps > 12) reps = 12
  return Math.round(weight * (36 / (37 - reps)))
}

export function calculateLGCScore(squat: number, bench: number, deadlift: number, waist: number): number {
  if (!waist || waist === 0) return 0
  const total = (squat || 0) + (bench || 0) + (deadlift || 0)
  return Math.round((total / waist) * 10 * 10) / 10
}

export function calculateAge(birthday: string): number {
  const today = new Date()
  const birth = new Date(birthday)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export function calculateBodyFat(
  sex: 'male' | 'female',
  waist: number,
  neck: number,
  height: number,
  hips?: number
): number | null {
  if (sex === 'male') {
    return Math.round((86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76) * 10) / 10
  } else if (sex === 'female' && hips) {
    return Math.round((163.205 * Math.log10(waist + hips - neck) - 97.684 * Math.log10(height) - 78.387) * 10) / 10
  }
  return null
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return 'Unknown'
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatMonthYear(dateStr: string): string {
  if (!dateStr) return 'Unknown'
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
