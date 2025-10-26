
import { Question, UrgencyStatus } from '../types';

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`); // Use midday to avoid timezone issues
  // Use milliseconds for precision with fractional days
  const millisecondsToAdd = days * 24 * 60 * 60 * 1000;
  d.setTime(d.getTime() + millisecondsToAdd);
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

export function formatISOToBr(iso: string | null | undefined): string {
    if (!iso) return "-";
    try {
        const [y, m, d] = iso.split("-");
        return `${d}/${m}/${y}`;
    } catch {
        return "-";
    }
}

export function getInitialSrsState(isCorrect: boolean, srsIntervals: number[]): { srsStage: number; nextReviewDate: string } {
    const today = todayISO();
    if (isCorrect) {
        // Correct on first try, skip to stage 1
        const srsStage = 1;
        const intervalDays = srsIntervals[1] ?? srsIntervals[0] ?? 7;
        return {
            srsStage,
            nextReviewDate: addDaysISO(today, intervalDays),
        };
    } else {
        // Incorrect, start at stage 0
        const srsStage = 0;
        const intervalDays = srsIntervals[0] ?? 1;
        return {
            srsStage,
            nextReviewDate: addDaysISO(today, intervalDays),
        };
    }
}

export function calculateNewSrsState(
  question: Question, 
  isCorrect: boolean, 
  selfEvalLevel: number, // 0:again, 1:hard, 2:good, 3:easy
  timeTakenSec: number, 
  srsIntervals: number[]
): Partial<Omit<Question, 'id'>> {

  const now = todayISO();

  // 1. Calculate new correct streak
  const newCorrectStreak = isCorrect ? (question.correctStreak || 0) + 1 : 0;

  // 2. Calculate new mastery score
  let masteryDelta = 0;
  if (isCorrect) {
    const baseMasteryChange = [0, 5, 10, 15][selfEvalLevel] || 10;
    const standardTime = 90;
    const timeFactor = Math.max(-1, (standardTime - timeTakenSec) / standardTime);
    const timeModifier = timeFactor * 5;
    const daysSinceLastReview = (new Date(now).getTime() - new Date(question.lastAttemptDate || question.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const intervalFactor = Math.log1p(daysSinceLastReview > 0 ? daysSinceLastReview : 0);
    const intervalModifier = Math.min(intervalFactor * 2, 10);
    const streakModifier = Math.min(newCorrectStreak, 5);

    masteryDelta = baseMasteryChange + timeModifier + intervalModifier + streakModifier;
  } else {
    masteryDelta = -25;
  }
  
  const newMastery = Math.max(0, Math.min(100, (question.masteryScore || 0) + masteryDelta));

  // 3. Calculate next review date
  let nextReviewDate: string;
  let newSrsStage: number;

  if (isCorrect) {
    newSrsStage = (question.srsStage || 0) + 1;
    let baseIntervalDays = srsIntervals[Math.min(newSrsStage, srsIntervals.length - 1)] ?? srsIntervals[srsIntervals.length - 1];
    const masteryFactor = 1 + (newMastery - 70) / 100;
    const evalFactor = [0.9, 0.95, 1, 1.2][selfEvalLevel] || 1;
    let finalIntervalDays = baseIntervalDays * masteryFactor * evalFactor;
    
    if (question.hotTopic) {
      finalIntervalDays = Math.min(finalIntervalDays, 7);
    }
    
    nextReviewDate = addDaysISO(now, Math.max(0.5, finalIntervalDays));
  } else {
    newSrsStage = 0;
    const intervalDays = srsIntervals[0] ?? 1;
    nextReviewDate = addDaysISO(now, intervalDays);
  }

  return {
    masteryScore: newMastery,
    srsStage: newSrsStage,
    nextReviewDate: nextReviewDate,
    correctStreak: newCorrectStreak,
    lastWasCorrect: isCorrect,
    selfEvalLevel: selfEvalLevel,
    timeSec: Math.round(timeTakenSec),
    lastAttemptDate: now,
    totalAttempts: (question.totalAttempts || 0) + 1,
  };
}


export function calcUrgency(q: Question): UrgencyStatus {
    const t = todayISO();
    if (q.nextReviewDate <= t) return UrgencyStatus.CRITICO;
    if (q.masteryScore < 60) return UrgencyStatus.ATENCAO;
    return UrgencyStatus.OK;
}

export function getUrgencyStyles(urgency: UrgencyStatus): { text: string, bg: string, border: string } {
    switch (urgency) {
        case UrgencyStatus.CRITICO:
            return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
        case UrgencyStatus.ATENCAO:
            return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
        case UrgencyStatus.OK:
            return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
        default:
            return { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' };
    }
}