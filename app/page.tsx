'use client'

import { useState, useEffect } from 'react'
import { supabase, Profile } from '@/lib/supabase'
import Auth from '@/components/Auth'
import Onboarding from '@/components/Onboarding'
import TabBar from '@/components/TabBar'
import Dashboard from '@/components/Dashboard'
import Workout from '@/components/Workout'
import Checkin from '@/components/Checkin'
import Import from '@/components/Import'
import History from '@/components/History'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        await supabase.from('profiles').insert({
          id: userId,
          email: user?.email,
          onboarded: false
        })
        setProfile({ id: userId, onboarded: false } as Profile)
      } else if (data) {
        setProfile(data)
      }
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (authUser: any) => {
    setUser(authUser)
    await loadProfile(authUser.id)
  }

  const handleOnboardingComplete = () => {
    setProfile(prev => prev ? { ...prev, onboarded: true } : null)
    setRefreshKey(k => k + 1)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const handleDataChange = () => {
    setRefreshKey(k => k + 1)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return <Auth onAuth={handleAuth} />
  }

  // Needs onboarding
  if (profile && !profile.onboarded) {
    return <Onboarding userId={user.id} onComplete={handleOnboardingComplete} />
  }

  // Main app
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-[#1a1a1a] p-4 flex justify-between items-center border-b border-[#252525]">
        <div>
          <h1 className="font-bold" style={{ color: '#FF6B35' }}>Lazy Gains Club</h1>
          <div className="text-xs text-gray-400">{user.email}</div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-400 hover:text-white"
        >
          Sign Out
        </button>
      </div>

      {/* Content */}
      <div className="pb-24">
        {activeTab === 'dashboard' && (
          <Dashboard key={refreshKey} userId={user.id} profile={profile} />
        )}
        {activeTab === 'workout' && (
          <Workout userId={user.id} onSave={handleDataChange} />
        )}
        {activeTab === 'checkin' && (
          <Checkin userId={user.id} onSave={handleDataChange} />
        )}
        {activeTab === 'import' && (
          <Import userId={user.id} onImport={handleDataChange} />
        )}
        {activeTab === 'history' && (
          <History key={refreshKey} userId={user.id} />
        )}
      </div>

      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
