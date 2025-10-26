import React from 'react';
import { TabID } from '../types';
import { CalendarIcon, QueueListIcon, BrainIcon, PlusIcon, UploadIcon, ChartBarIcon, MoonIcon, SunIcon, CogIcon, ListBulletIcon, TrophyIcon, GraphIcon } from './icons';

interface HeaderProps {
  activeTab: TabID;
  setActiveTab: (tab: TabID) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  dueCount: number;
}

const tabs: { id: TabID; label: string; icon: React.ReactNode }[] = [
  { id: 'today', label: 'Hoje', icon: <CalendarIcon /> },
  { id: 'queue', label: 'Fila', icon: <QueueListIcon /> },
  { id: 'study', label: 'Estudar', icon: <BrainIcon /> },
  { id: 'add', label: 'Registrar', icon: <PlusIcon /> },
  { id: 'list', label: 'Listar', icon: <ListBulletIcon /> },
  { id: 'map', label: 'Mapa', icon: <GraphIcon /> },
  { id: 'import', label: 'Import/Export', icon: <UploadIcon /> },
  { id: 'dash', label: 'Dash', icon: <ChartBarIcon /> },
  { id: 'goals', label: 'Metas', icon: <TrophyIcon /> },
  { id: 'settings', label: 'Configurações', icon: <CogIcon /> },
];

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, theme, toggleTheme, dueCount }) => {
  const today = new Date();
  const dateLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <header className="sticky top-0 z-40 bg-bunker-50/80 dark:bg-bunker-950/80 backdrop-blur-lg border-b border-bunker-200 dark:border-bunker-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Revisão de Questões</h1>
            <p className="text-sm text-bunker-500 dark:text-bunker-400">Spaced Repetition para Concursos</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-bunker-500 dark:text-bunker-400 capitalize hidden md:block">{dateLabel}</p>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-bunker-500 dark:text-bunker-400 hover:bg-bunker-200 dark:hover:bg-bunker-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
            <nav className="flex space-x-2 border-b border-bunker-200 dark:border-bunker-800 -mb-px">
            {tabs.map(tab => (
                <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-all duration-150 border-b-2 rounded-t-lg
                    ${
                    activeTab === tab.id
                        ? 'border-sky-500 text-sky-500'
                        : 'border-transparent text-bunker-500 dark:text-bunker-400 hover:text-bunker-700 dark:hover:text-bunker-200 hover:border-bunker-300 dark:hover:border-bunker-700 hover:bg-bunker-200/50 dark:hover:bg-bunker-800/50 hover:-translate-y-px active:scale-95'
                    }`}
                >
                {tab.icon}
                <span>{tab.label}</span>
                {(tab.id === 'today' || tab.id === 'queue' || tab.id === 'study') && dueCount > 0 && (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${activeTab === tab.id ? 'bg-sky-500 text-white' : 'bg-bunker-200 dark:bg-bunker-700 text-bunker-600 dark:text-bunker-200'}`}>
                        {dueCount}
                    </span>
                )}
                </button>
            ))}
            </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;