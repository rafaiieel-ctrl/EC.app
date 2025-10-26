
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppSettings, Goal } from '../types';

const LS_SETTINGS_KEY = 'revApp_settings_v1';

const defaultSettings: AppSettings = {
  questionsPerPage: 10,
  enableTimer: true,
  studyTimerDuration: 25,
  srsIntervals: [0.5, 1, 7, 14, 30],
  goals: [
    { id: 'global_review', type: 'review', target: 10, filter: { type: 'all', value: '*' }, subFilter: 'all' },
    { id: 'global_add', type: 'add', target: 2, filter: { type: 'all', value: '*' }, subFilter: 'all' },
  ],
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const storedSettings = localStorage.getItem(LS_SETTINGS_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        
        if (!parsed.goals && (parsed.dailyReviewGoal || parsed.dailyAddGoal)) {
          const newGoals: Goal[] = [];
          if (parsed.dailyReviewGoal) {
            newGoals.push({ id: 'global_review', type: 'review', target: parsed.dailyReviewGoal, filter: { type: 'all', value: '*' }, subFilter: 'all' });
          }
          if (parsed.dailyAddGoal) {
            newGoals.push({ id: 'global_add', type: 'add', target: parsed.dailyAddGoal, filter: { type: 'all', value: '*' }, subFilter: 'all' });
          }
          
          delete parsed.dailyReviewGoal;
          delete parsed.dailyAddGoal;
          parsed.goals = newGoals;
        } else if (!parsed.goals) {
            parsed.goals = defaultSettings.goals;
        }

        if (parsed.goals && Array.isArray(parsed.goals)) {
            parsed.goals = parsed.goals.map((g: any) => ({
                ...g,
                subFilter: g.subFilter || 'all',
            }));
        }

        return { ...defaultSettings, ...parsed };
      }
      return defaultSettings;
    } catch (error) {
      console.error("Error loading settings from localStorage:", error);
      return defaultSettings;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving settings to localStorage:", error);
    }
  }, [settings]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    {/* FIX: Corrected typo in closing tag from Settings-Provider to SettingsContext.Provider */}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
