'use client'

interface TabBarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'workout', icon: '🏋️', label: 'Workout' },
    { id: 'checkin', icon: '📝', label: 'Check-in' },
    { id: 'import', icon: '📤', label: 'Import' },
    { id: 'history', icon: '📜', label: 'History' },
  ]

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
