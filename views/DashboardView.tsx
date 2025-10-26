

import React, { useState, useMemo } from 'react';
import { useQuestionState } from '../contexts/QuestionContext';
import * as srs from '../services/srsService';
import { Question, UrgencyStatus } from '../types';
import { FireIcon } from '../components/icons';
import QuestionListModal from '../components/QuestionListModal';
import EvolutionChart from '../components/EvolutionChart';
import MasteryTimeChart from '../components/MasteryTimeChart';

type EvolutionPeriod = '7d' | '30d' | 'month' | 'year';
type MasteryTimePeriod = 'week' | 'month' | 'year';

const DashCard: React.FC<{ label: string; value: string | number; }> = ({ label, value }) => (
  <div className="bg-bunker-100 dark:bg-bunker-900 p-4 rounded-lg">
    <p className="text-sm text-bunker-500 dark:text-bunker-400 mb-1">{label}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
  </div>
);

const DashboardView: React.FC = () => {
  const questions = useQuestionState();
  const [isParetoModalOpen, setIsParetoModalOpen] = useState(false);
  const [evolutionPeriod, setEvolutionPeriod] = useState<EvolutionPeriod>('30d');
  const [masteryTimeFilter, setMasteryTimeFilter] = useState<MasteryTimePeriod>('month');

  const stats = useMemo(() => {
    const total = questions.length;
    if (total === 0) {
      return { total: 0, avgMastery: '0%', recentAccuracy: '0%', hotTopics: 0, dueToday: 0, criticalCount: 0 };
    }
    const today = srs.todayISO();
    const dueToday = questions.filter(q => q.nextReviewDate <= today).length;
    const avgMastery = questions.reduce((acc, q) => acc + q.masteryScore, 0) / total;
    const attemptedQuestions = questions.filter(q => q.totalAttempts > 0);
    const recentAccuracy = attemptedQuestions.length > 0 ? (attemptedQuestions.filter(q => q.lastWasCorrect).length / attemptedQuestions.length) * 100 : 0;
    const hotTopics = questions.filter(q => q.hotTopic).length;
    const criticalCount = questions.filter(q => q.isCritical).length;

    return {
      total,
      avgMastery: `${avgMastery.toFixed(0)}%`,
      recentAccuracy: `${recentAccuracy.toFixed(0)}%`,
      hotTopics,
      dueToday,
      criticalCount
    };
  }, [questions]);

  const criticalQuestions = useMemo(() => {
    return [...questions]
      .sort((a, b) => {
        const urgencyA = srs.calcUrgency(a) === UrgencyStatus.CRITICO ? 0 : 1;
        const urgencyB = srs.calcUrgency(b) === UrgencyStatus.CRITICO ? 0 : 1;
        if (urgencyA !== urgencyB) return urgencyA - urgencyB;
        return a.masteryScore - b.masteryScore;
      })
      .slice(0, 10);
  }, [questions]);

  const subjectPerformance = useMemo(() => {
    const perf: Record<string, { count: number; masterySum: number; correctCount: number; attemptCount: number }> = {};
    questions.forEach(q => {
      const subject = q.subject || 'Outros';
      if (!perf[subject]) perf[subject] = { count: 0, masterySum: 0, correctCount: 0, attemptCount: 0 };
      perf[subject].count++;
      perf[subject].masterySum += q.masteryScore;
      if (q.totalAttempts > 0) {
          perf[subject].attemptCount++;
          if (q.lastWasCorrect) perf[subject].correctCount++;
      }
    });
    return Object.entries(perf).map(([subject, data]) => ({
      subject,
      count: data.count,
      avgMastery: data.masterySum / data.count,
      accuracy: data.attemptCount > 0 ? (data.correctCount / data.attemptCount) * 100 : 0,
    })).sort((a, b) => b.count - a.count);
  }, [questions]);

  const paretoData = useMemo(() => {
    const criticals = questions.filter(q => srs.calcUrgency(q) === UrgencyStatus.CRITICO);
    if (criticals.length === 0) {
        return { subjects: [], questions: [] };
    }

    const bySubject: Record<string, { count: number; questions: Question[] }> = {};
    criticals.forEach(q => {
        const subject = q.subject || 'Outros';
        if (!bySubject[subject]) bySubject[subject] = { count: 0, questions: [] };
        bySubject[subject].count++;
        bySubject[subject].questions.push(q);
    });

    const sortedSubjects = Object.entries(bySubject)
        .map(([subject, data]) => ({ subject, ...data }))
        .sort((a, b) => b.count - a.count);

    const totalCritical = criticals.length;
    const paretoThreshold = totalCritical * 0.8;
    let countSum = 0;
    const paretoSubjects: typeof sortedSubjects = [];

    for (const subjectData of sortedSubjects) {
        if (countSum < paretoThreshold || paretoSubjects.length === 0) {
            paretoSubjects.push(subjectData);
            countSum += subjectData.count;
        } else {
            break;
        }
    }

    const paretoQuestions = paretoSubjects.flatMap(s => s.questions).sort((a,b) => a.nextReviewDate.localeCompare(b.nextReviewDate));

    return { subjects: paretoSubjects, questions: paretoQuestions };
  }, [questions]);

  const evolutionData = useMemo(() => {
    const today = new Date();
    
    if (evolutionPeriod === 'year') {
        const currentYear = today.getFullYear();
        const monthlyMap = new Map<string, { reviewed: number; added: number }>();
        for (let i = 0; i < 12; i++) {
            const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
            monthlyMap.set(monthKey, { reviewed: 0, added: 0 });
        }

        questions.forEach(q => {
            if (q.lastAttemptDate) {
                const attemptDate = new Date(`${q.lastAttemptDate}T12:00:00Z`);
                if (attemptDate.getFullYear() === currentYear) {
                    const monthKey = `${currentYear}-${String(attemptDate.getMonth() + 1).padStart(2, '0')}`;
                    if (monthlyMap.has(monthKey)) {
                        monthlyMap.get(monthKey)!.reviewed++;
                    }
                }
            }
            if (q.createdAt) {
                const createdDate = new Date(`${q.createdAt}T12:00:00Z`);
                if (createdDate.getFullYear() === currentYear) {
                    const monthKey = `${currentYear}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
                    if (monthlyMap.has(monthKey)) {
                        monthlyMap.get(monthKey)!.added++;
                    }
                }
            }
        });

        return Array.from(monthlyMap.entries())
            .map(([date, counts]) => ({ date, ...counts }))
            .sort((a, b) => a.date.localeCompare(b.date));

    } else { // Daily data for 7d, 30d, month
        const dateMap = new Map<string, { reviewed: number; added: number }>();
        
        if (evolutionPeriod === 'month') {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
            for (let i = 0; i < daysInMonth; i++) {
                const d = new Date(startOfMonth);
                d.setDate(startOfMonth.getDate() + i);
                if (d > today) break; // Don't show future dates
                const isoDate = srs.toISODate(d);
                dateMap.set(isoDate, { reviewed: 0, added: 0 });
            }
        } else { // 7d or 30d
            const days = evolutionPeriod === '7d' ? 7 : 30;
            for (let i = 0; i < days; i++) {
                const d = new Date();
                d.setDate(today.getDate() - i);
                const isoDate = srs.toISODate(d);
                dateMap.set(isoDate, { reviewed: 0, added: 0 });
            }
        }
        
        questions.forEach(q => {
            if (q.lastAttemptDate && dateMap.has(q.lastAttemptDate)) {
                dateMap.get(q.lastAttemptDate)!.reviewed += 1;
            }
            if (q.createdAt && dateMap.has(q.createdAt)) {
                dateMap.get(q.createdAt)!.added += 1;
            }
        });

        return Array.from(dateMap.entries())
            .map(([date, counts]) => ({ date, ...counts }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
  }, [questions, evolutionPeriod]);
  
  const masteryTimeData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today, local time.
    let startDate = new Date(today);

    switch (masteryTimeFilter) {
        case 'week':
            startDate.setDate(today.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(today.getMonth() - 1);
            break;
        case 'year':
            startDate.setFullYear(today.getFullYear() - 1);
            break;
    }

    const startTime = startDate.getTime();

    return questions
        .filter(q => {
            if (!q.lastAttemptDate) return false;
            // Use midday UTC to avoid timezone issues when comparing dates
            const attemptTime = new Date(`${q.lastAttemptDate}T12:00:00Z`).getTime();
            return attemptTime >= startTime;
        })
        .map(q => ({
            x: new Date(`${q.lastAttemptDate}T12:00:00Z`).getTime(),
            y: q.masteryScore,
            question: q,
        }));
  }, [questions, masteryTimeFilter]);

  const evolutionPeriodOptions: { id: EvolutionPeriod; label: string }[] = [
    { id: '7d', label: '7D' },
    { id: '30d', label: '30D' },
    { id: 'month', label: 'Mês' },
    { id: 'year', label: 'Ano' },
  ];
  
  const masteryTimeFilterOptions: { id: MasteryTimePeriod; label: string }[] = [
    { id: 'week', label: 'Semana' },
    { id: 'month', label: 'Mês' },
    { id: 'year', label: 'Ano' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard de Performance</h2>
        <p className="text-bunker-500 dark:text-bunker-400">Uma visão geral do seu progresso de estudo.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <DashCard label="Total de Questões" value={stats.total} />
        <DashCard label="Pendentes Hoje" value={stats.dueToday} />
        <DashCard label="Domínio Médio" value={stats.avgMastery} />
        <DashCard label="Acerto Recente" value={stats.recentAccuracy} />
        <DashCard label="Vai Cair" value={stats.hotTopics} />
        <DashCard label="Críticas" value={stats.criticalCount} />
      </div>

      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Evolução de Atividade</h3>
            <div className="flex items-center gap-1 p-1 bg-bunker-200 dark:bg-bunker-800 rounded-lg mt-2 sm:mt-0">
                {evolutionPeriodOptions.map(opt => (
                    <button
                        key={opt.id}
                        onClick={() => setEvolutionPeriod(opt.id)}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                            evolutionPeriod === opt.id
                                ? 'bg-white dark:bg-bunker-950 text-sky-600 dark:text-sky-400 shadow-sm'
                                : 'text-bunker-600 dark:text-bunker-400 hover:bg-white/60 dark:hover:bg-bunker-950/60'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
        <div className="bg-bunker-100 dark:bg-bunker-900 p-4 rounded-lg">
            <EvolutionChart data={evolutionData} period={evolutionPeriod} />
        </div>
      </div>
      
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Domínio vs. Tempo</h3>
            <div className="flex items-center gap-1 p-1 bg-bunker-200 dark:bg-bunker-800 rounded-lg mt-2 sm:mt-0">
                {masteryTimeFilterOptions.map(opt => (
                    <button
                        key={opt.id}
                        onClick={() => setMasteryTimeFilter(opt.id)}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                            masteryTimeFilter === opt.id
                                ? 'bg-white dark:bg-bunker-950 text-sky-600 dark:text-sky-400 shadow-sm'
                                : 'text-bunker-600 dark:text-bunker-400 hover:bg-white/60 dark:hover:bg-bunker-950/60'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
        <div className="bg-bunker-100 dark:bg-bunker-900 p-4 rounded-lg">
            <MasteryTimeChart data={masteryTimeData} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="font-bold text-lg">🚨 Questões Prioritárias (Piores)</h3>
          <div className="bg-bunker-100 dark:bg-bunker-900 p-4 rounded-lg space-y-2">
            {criticalQuestions.length > 0 ? criticalQuestions.map(q => (
              <div key={q.id} className="flex justify-between items-center p-2 bg-bunker-50 dark:bg-bunker-800/50 rounded">
                <div className="truncate pr-2">
                    <p className="text-sm font-semibold">{q.questionRef}</p>
                    <p className="text-xs text-bunker-500 dark:text-bunker-400">{q.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                    {q.hotTopic && <FireIcon />}
                    <span className={`text-sm font-bold ${q.masteryScore < 50 ? 'text-red-500' : q.masteryScore < 75 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {Math.round(q.masteryScore)}%
                    </span>
                </div>
              </div>
            )) : <p className="text-center text-bunker-500 dark:text-bunker-400 py-4">Nenhuma questão crítica.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-lg">📚 Performance por Disciplina</h3>
           <div className="bg-bunker-100 dark:bg-bunker-900 p-4 rounded-lg">
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-bunker-500 dark:text-bunker-400 uppercase">
                        <tr>
                            <th className="py-2 px-2">Disciplina</th>
                            <th className="py-2 px-2 text-center">Questões</th>
                            <th className="py-2 px-2 text-center">Domínio</th>
                            <th className="py-2 px-2 text-center">Acerto</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bunker-200 dark:divide-bunker-800">
                    {subjectPerformance.map(s => (
                        <tr key={s.subject}>
                            <td className="py-2 px-2 font-medium">{s.subject}</td>
                            <td className="py-2 px-2 text-center">{s.count}</td>
                            <td className="py-2 px-2 text-center font-semibold">{s.avgMastery.toFixed(0)}%</td>
                            <td className="py-2 px-2 text-center">{s.accuracy.toFixed(0)}%</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
             </div>
           </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Foco 80/20 (Princípio de Pareto)</h3>
        <div className="bg-bunker-100 dark:bg-bunker-900 p-6 rounded-lg">
            <p className="text-sm text-bunker-500 dark:text-bunker-400 mb-4">
            As disciplinas abaixo representam aproximadamente 80% das suas questões críticas/vencidas.
            <button 
                onClick={() => setIsParetoModalOpen(true)}
                className="text-sky-500 hover:underline ml-1 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={paretoData.subjects.length === 0}
            >
                Clique para ver a lista completa.
            </button>
            </p>
            {paretoData.subjects.length > 0 ? (
            <div className="space-y-3 cursor-pointer" onClick={() => setIsParetoModalOpen(true)}>
                {paretoData.subjects.map((s) => {
                const maxCount = paretoData.subjects[0]?.count || 1;
                const barWidth = Math.max((s.count / maxCount) * 100, 5); // min width 5%
                return (
                    <div key={s.subject} className="flex items-center gap-4 group">
                    <span className="w-1/3 md:w-1/4 truncate text-sm font-medium">{s.subject}</span>
                    <div className="w-2/3 md:w-3/4 bg-bunker-200 dark:bg-bunker-800 rounded-full h-6">
                        <div 
                        className="bg-sky-500 h-6 rounded-full flex items-center justify-end px-2 text-white text-xs font-bold transition-all duration-500 group-hover:bg-sky-400"
                        style={{ width: `${barWidth}%` }}
                        >
                        {s.count}
                        </div>
                    </div>
                    </div>
                );
                })}
            </div>
            ) : (
            <p className="text-center text-bunker-500 dark:text-bunker-400 py-4">Nenhuma questão crítica para analisar.</p>
            )}
        </div>
      </div>
      
      {isParetoModalOpen && (
        <QuestionListModal 
            isOpen={isParetoModalOpen}
            onClose={() => setIsParetoModalOpen(false)}
            title={`Questões Críticas (Foco Pareto)`}
            questions={paretoData.questions}
        />
      )}
    </div>
  );
};

export default DashboardView;