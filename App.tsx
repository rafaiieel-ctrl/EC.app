
import React, { useState, useEffect } from 'react';
import { TabID } from './types';
import Header from './components/Header';
import TodayView from './views/TodayView';
import QueueView from './views/QueueView';
import StudyView from './views/StudyView';
import AddQuestionView from './views/AddQuestionView';
import ImportView from './views/ImportView';
import DashboardView from './views/DashboardView';
import SettingsView from './views/SettingsView';
import ListView from './views/ListView';
import GoalsView from './views/GoalsView';
import MapView from './views/MapView';
import { useQuestionState } from './contexts/QuestionContext';
import * as srs from './services/srsService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabID>('today');
  const [contentKey, setContentKey] = useState(0);
  const questions = useQuestionState();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('app-theme') as 'light' | 'dark') || 'dark');
  
  const dueQuestions = React.useMemo(() => {
    const today = srs.todayISO();
    return questions.filter(q => q.nextReviewDate <= today);
  }, [questions]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  const handleTabChange = (newTab: TabID) => {
    if (newTab !== activeTab) {
      setActiveTab(newTab);
      setContentKey(prevKey => prevKey + 1);
    }
  };

  const renderView = () => {
    switch (activeTab) {
      case 'today': return <TodayView setActiveTab={handleTabChange} />;
      case 'queue': return <QueueView setActiveTab={handleTabChange} />;
      case 'study': return <StudyView dueQuestions={dueQuestions} />;
      case 'add': return <AddQuestionView setActiveTab={handleTabChange} />;
      case 'import': return <ImportView setActiveTab={handleTabChange} />;
      case 'dash': return <DashboardView />;
      case 'goals': return <GoalsView />;
      case 'map': return <MapView />;
      case 'settings': return <SettingsView />;
      case 'list': return <ListView />;
      default: return <TodayView setActiveTab={handleTabChange} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        theme={theme} 
        toggleTheme={toggleTheme}
        dueCount={dueQuestions.length}
      />
      <main key={contentKey} className="flex-grow w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 animate-fade-in">
        {renderView()}
      </main>
    </div>
  );
};

export default App;