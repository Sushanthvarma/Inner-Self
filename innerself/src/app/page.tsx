'use client';

import { useState, useEffect } from 'react';
import BrainDump from '@/components/BrainDump';
import LogView from '@/components/LogView';
import TasksView from '@/components/TasksView';
import LifeView from '@/components/LifeView';
import MirrorView from '@/components/MirrorView';
import ChatView from '@/components/ChatView';
import Onboarding from '@/components/Onboarding';
import type { TabName } from '@/types';

const TAB_CONFIG: { id: TabName; label: string; icon: string }[] = [
  { id: 'dump', label: 'Dump', icon: '🧠' },
  { id: 'log', label: 'Log', icon: '📖' },
  { id: 'tasks', label: 'Tasks', icon: '✅' },
  { id: 'life', label: 'Life', icon: '🌟' },
  { id: 'mirror', label: 'Mirror', icon: '🪞' },
  { id: 'chat', label: 'Chat', icon: '💬' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabName>('dump');
  const [onboardingComplete, setOnboardingComplete] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const res = await fetch('/api/onboarding');
      const data = await res.json();
      setOnboardingComplete(data.completed);
    } catch {
      setOnboardingComplete(false);
    }
  };

  // Loading state
  if (onboardingComplete === null) {
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
  if (!onboardingComplete) {
    return (
      <Onboarding
        onComplete={() => setOnboardingComplete(true)}
      />
    );
  }

  // Main App
  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">Inner Self</h1>
        <span className="app-tagline">Your Digital Witness</span>
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
    </div>
  );
}
