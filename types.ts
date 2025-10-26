export type TabID = 'today' | 'queue' | 'study' | 'add' | 'import' | 'dash' | 'goals' | 'settings' | 'list' | 'map';

export type SubFilterType = 'all' | 'critical' | 'hot' | 'incorrect';

export interface Goal {
  id: string;
  type: 'review' | 'add';
  target: number;
  filter: {
    type: 'all' | 'subject' | 'topic';
    value: string; // The subject/topic name, or a special value like '*' for all
  };
  subFilter?: SubFilterType;
}

export interface AppSettings {
  questionsPerPage: number;
  enableTimer: boolean;
  studyTimerDuration: number; // in minutes
  srsIntervals: number[]; // in days, e.g., [0.5, 1, 3, 7, 14, 30]
  goals: Goal[];
}

export interface QuestionOptions {
  A?: string;
  B?: string;
  C?: string;
  D?: string;
  E?: string;
}

export interface Question {
  id: string;
  bank: string;
  position: string;
  subject: string;
  topic: string;
  questionRef: string;
  questionText: string;
  options: QuestionOptions;
  explanation: string;
  comments: string; // User's personal notes
  yourAnswer?: string;
  correctAnswer: string;
  lastAttemptDate: string; // ISO Date: YYYY-MM-DD
  totalAttempts: number;
  lastWasCorrect: boolean;
  timeSec: number;
  selfEvalLevel: number; // 0 (hardest) to 3 (easiest)
  masteryScore: number; // 0-100
  nextReviewDate: string; // ISO Date: YYYY-MM-DD
  hotTopic: boolean; // "Vai cair na prova"
  willFallExam: boolean; // Legacy, can be removed later
  srsStage: number; // Index for the srsIntervals array
  correctStreak: number; // Number of consecutive correct answers
  isCritical: boolean;
  createdAt: string; // ISO Date: YYYY-MM-DD
}

export enum UrgencyStatus {
    CRITICO = 'CRITICO',
    ATENCAO = 'ATENCAO',
    OK = 'OK',
}