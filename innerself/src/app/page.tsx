'use client';

import { useState, useEffect } from 'react';
import BrainDump from '@/components/BrainDump';
import LogView from '@/components/LogView';
import TasksView from '@/components/TasksView';
import LifeView from '@/components/LifeView';
import MirrorView from '@/components/MirrorView';
import ChatView from '@/components/ChatView';
import Onboarding from '@/components/Onboarding';
import SettingsPanel from '@/components/SettingsPanel';
import type { TabName } from '@/types';

const TAB_CONFIG: { id: TabName; label: string; icon: string }[] = [
  { id: 'dump', label: 'Dump', icon: '🧠' },
  { id: 'log', label: 'Log', icon: '📖' },
  { id: 'tasks', label: 'Tasks', icon: '✅' },
  { id: 'life', label: 'Life', icon: '🌟' },
  { id: 'mirror', label: 'Mirror', icon: '🪞' },
  { id: 'chat', label: 'Chat', icon: '💬' },
];

interface OnboardingStatus {
  completed: boolean;
  skipped: boolean;
  partial: boolean;
  answeredCount: number;
  totalQuestions: number;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabName>('dump');
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const res = await fetch('/api/onboarding');
      const data: OnboardingStatus = await res.json();
      setOnboardingStatus(data);

      // Show onboarding only if not completed AND not skipped
      if (!data.completed && !data.skipped && !data.partial) {
        setShowOnboarding(true);
      }
    } catch {
      setOnboardingStatus({
        completed: false,
        skipped: false,
        partial: false,
        answeredCount: 0,
        totalQuestions: 14,
      });
      setShowOnboarding(true);
    }
  };

  // Loading state
  if (onboardingStatus === null) {
    return (
      <div className="app-loading">
        <div className="app-loading-content">
          <h1 className="app-logo">Inner Self</h1>
          <div className="loading-spinner large" />
        </div>
      </div>
    );
  }

  // Onboarding
  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={() => {
          setShowOnboarding(false);
          setOnboardingStatus((prev) =>
            prev ? { ...prev, completed: true, skipped: false } : prev
          );
        }}
        onSkip={() => {
          setShowOnboarding(false);
          setOnboardingStatus((prev) =>
            prev ? { ...prev, skipped: true } : prev
          );
        }}
        startFromQuestion={onboardingStatus.answeredCount}
      />
    );
  }

  // Main App
  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">Inner Self</h1>
        <div className="header-right">
          <span className="app-tagline">Your Digital Witness</span>
          <button
            className="settings-gear"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="app-content">
        {activeTab === 'dump' && (
          <BrainDump onProcessingComplete={() => { }} />
        )}
        {activeTab === 'log' && <LogView />}
        {activeTab === 'tasks' && <TasksView />}
        {activeTab === 'life' && <LifeView />}
        {activeTab === 'mirror' && <MirrorView />}
        {activeTab === 'chat' && <ChatView />}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onResumeOnboarding={() => {
          setSettingsOpen(false);
          setShowOnboarding(true);
        }}
        onboardingStatus={onboardingStatus}
      />
    </div>
  );
}
