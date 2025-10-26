import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Question } from '../types';
import * as srs from '../services/srsService';
import { SAMPLE_QUESTIONS } from './sample-data';

const LS_QUESTIONS_KEY = 'revApp_questions_v5_react';

// --- State Context ---
const QuestionStateContext = createContext<Question[] | undefined>(undefined);

// --- Dispatch Context ---
interface QuestionDispatch {
  addQuestion: (newQuestion: Omit<Question, 'id'>) => void;
  updateQuestion: (updatedQuestion: Question) => void;
  updateBatchQuestions: (updates: ({ id: string } & Partial<Omit<Question, 'id'>>)[]) => void;
  deleteQuestions: (questionIds: string[]) => void;
  addBatchQuestions: (newQuestions: Omit<Question, 'id'>[]) => void;
  resetAllProgress: () => void;
}
const QuestionDispatchContext = createContext<QuestionDispatch | undefined>(undefined);


export const QuestionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [questions, setQuestions] = useState<Question[]>(() => {
    try {
      const storedQuestions = localStorage.getItem(LS_QUESTIONS_KEY);
      if (storedQuestions && storedQuestions !== '[]') {
        // Migration for correctStreak
        const parsed = JSON.parse(storedQuestions);
        return parsed.map((q: any) => ({ ...q, correctStreak: q.correctStreak || 0 }));
      }
      return SAMPLE_QUESTIONS.map((q_data, index) => ({
        ...q_data,
        id: `q_sample_${index}_${q_data.questionRef.replace(/[^a-zA-Z0-9]/g, '')}`,
      }));
    } catch (error) {
      console.error("Error loading questions from localStorage:", error);
      return SAMPLE_QUESTIONS.map((q_data, index) => ({
        ...q_data,
        id: `q_sample_${index}_${q_data.questionRef.replace(/[^a-zA-Z0-9]/g, '')}`,
      }));
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_QUESTIONS_KEY, JSON.stringify(questions));
    } catch (error) {
      console.error("Error saving questions to localStorage:", error);
    }
  }, [questions]);

  const addQuestion = useCallback((newQuestionData: Omit<Question, 'id'>) => {
    const newQuestion: Question = {
      ...newQuestionData,
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
    setQuestions(prev => [...prev, newQuestion]);
  }, []);

  const updateQuestion = useCallback((updatedQuestion: Question) => {
    setQuestions(prev => prev.map(q => (q.id === updatedQuestion.id ? updatedQuestion : q)));
  }, []);
  
  const addBatchQuestions = useCallback((newQuestionsData: Omit<Question, 'id'>[]) => {
      const newQuestions: Question[] = newQuestionsData.map(q_data => ({
        ...q_data,
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${Math.random().toString(36).substring(2, 9)}`,
      }));
      setQuestions(prev => [...prev, ...newQuestions]);
    }, []);

  const resetAllProgress = useCallback(() => {
    const today = srs.todayISO();
    setQuestions(prev => prev.map(q => ({
      ...q,
      nextReviewDate: today,
      srsStage: 0,
      masteryScore: 0,
      totalAttempts: 0,
      lastWasCorrect: false,
      selfEvalLevel: 0,
      lastAttemptDate: '',
      correctStreak: 0,
      yourAnswer: '',
    })));
  }, []);
  
  const updateBatchQuestions = useCallback((updates: ({ id: string } & Partial<Omit<Question, 'id'>>)[]) => {
    setQuestions(prevQuestions => {
        const updatesMap = new Map(updates.map(u => [u.id, u]));
        return prevQuestions.map(q => {
            const update = updatesMap.get(q.id);
            return update ? { ...q, ...update } : q;
        });
    });
  }, []);

  const deleteQuestions = useCallback((questionIds: string[]) => {
    const idsSet = new Set(questionIds);
    setQuestions(prev => prev.filter(q => !idsSet.has(q.id)));
  }, []);
  
  const dispatchValue = useMemo(() => ({
    addQuestion,
    updateQuestion,
    addBatchQuestions,
    resetAllProgress,
    updateBatchQuestions,
    deleteQuestions,
  }), [addQuestion, updateQuestion, addBatchQuestions, resetAllProgress, updateBatchQuestions, deleteQuestions]);

  return (
    <QuestionStateContext.Provider value={questions}>
        <QuestionDispatchContext.Provider value={dispatchValue}>
            {children}
        </QuestionDispatchContext.Provider>
    </QuestionStateContext.Provider>
  );
};

export const useQuestionState = (): Question[] => {
  const context = useContext(QuestionStateContext);
  if (context === undefined) {
    throw new Error('useQuestionState must be used within a QuestionProvider');
  }
  return context;
};

export const useQuestionDispatch = (): QuestionDispatch => {
  const context = useContext(QuestionDispatchContext);
  if (context === undefined) {
    throw new Error('useQuestionDispatch must be used within a QuestionProvider');
  }
  return context;
};