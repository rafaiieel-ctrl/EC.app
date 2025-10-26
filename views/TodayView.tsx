

import React from 'react';
import { useQuestionState } from '../contexts/QuestionContext';
import * as srs from '../services/srsService';
import { Question, TabID, UrgencyStatus } from '../types';
import { BrainIcon, FireIcon } from '../components/icons';

interface TodayViewProps {
  setActiveTab: (tab: TabID) => void;
}

const KpiCard: React.FC<{ label: string; value: string | number; }> = ({ label, value }) => (
  <div className="bg-bunker-100 dark:bg-bunker-900 p-4 rounded-lg">
    <p className="text-sm text-bunker-500 dark:text-bunker-400 mb-1">{label}</p>
    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
  </div>
);

const SubjectGroup: React.FC<{ subject: string; questions: Question[]; setActiveTab: (tab: TabID) => void; }> = ({ subject, questions, setActiveTab }) => {
  const hotCount = questions.filter(q => q.hotTopic).length;

  return (
    <div className="bg-bunker-100 dark:bg-bunker-900 p-4 rounded-lg">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">{subject}</h3>
          <p className="text-sm text-bunker-500 dark:text-bunker-400">{questions.length} questão(ões) pendente(s)</p>
        </div>
        {hotCount > 0 && <div className="flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full"><FireIcon /> {hotCount}</div>}
      </div>
      <div className="space-y-2">
        {questions.slice(0, 5).map(q => (
          <div key={q.id} className="text-sm p-2 rounded bg-bunker-50 dark:bg-bunker-800/50 flex justify-between items-center">
            <span className="truncate pr-2">{q.questionRef}</span>
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${srs.getUrgencyStyles(srs.calcUrgency(q)).bg} ${srs.getUrgencyStyles(srs.calcUrgency(q)).text}`}>
              {Math.round(q.masteryScore)}%
            </span>
          </div>
        ))}
        {questions.length > 5 && <p className="text-xs text-center text-bunker-500 dark:text-bunker-400 pt-2">...e mais {questions.length - 5}</p>}
      </div>
    </div>
  );
};


const TodayView: React.FC<TodayViewProps> = ({ setActiveTab }) => {
  const questions = useQuestionState();

  const dueQuestions = React.useMemo(() => {
    const today = srs.todayISO();
    return questions
        .filter(q => q.nextReviewDate <= today)
        .sort((a,b) => (srs.calcUrgency(a) === srs.calcUrgency(b)) ? a.masteryScore - b.masteryScore : (srs.calcUrgency(a) === UrgencyStatus.CRITICO ? -1 : 1));
  }, [questions]);

  const kpis = React.useMemo(() => {
    const total = questions.length;
    if (total === 0) return { avgMastery: '0%', recentAccuracy: '0%', hotTopics: 0 };
    const avgMastery = questions.reduce((acc, q) => acc + q.masteryScore, 0) / total;
    const recentAccuracy = (questions.filter(q => q.lastWasCorrect).length / total) * 100;
    const hotTopics = questions.filter(q => q.hotTopic).length;
    return {
      avgMastery: `${avgMastery.toFixed(0)}%`,
      recentAccuracy: `${recentAccuracy.toFixed(0)}%`,
      hotTopics: hotTopics
    };
  }, [questions]);
  
  const dueBySubject = React.useMemo(() => {
    return dueQuestions.reduce((acc, q) => {
      const subject = q.subject || 'Outros';
      if (!acc[subject]) acc[subject] = [];
      acc[subject].push(q);
      return acc;
    }, {} as Record<string, Question[]>);
  }, [dueQuestions]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-lg bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-lg">
        <div>
          <h2 className="text-2xl font-bold">Revisão de Hoje</h2>
          {dueQuestions.length > 0 ? (
            <p className="text-sky-100">Você tem {dueQuestions.length} questão(ões) para revisar. Vamos lá!</p>
          ) : (
            <p className="text-sky-100">Parabéns, você está em dia com suas revisões! ✨</p>
          )}
        </div>
        {dueQuestions.length > 0 && (
          <button onClick={() => setActiveTab('study')} className="flex items-center gap-2 bg-white text-sky-600 font-bold py-3 px-6 rounded-lg shadow-md hover:bg-sky-50 transition-transform hover:scale-105">
            <BrainIcon />
            <span>Estudar Agora</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pendentes Hoje" value={dueQuestions.length} />
        <KpiCard label="Domínio Médio" value={kpis.avgMastery} />
        <KpiCard label="Acerto Recente" value={kpis.recentAccuracy} />
        <KpiCard label="Temas Quentes" value={kpis.hotTopics} />
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Questões por Disciplina</h3>
        {Object.keys(dueBySubject).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(dueBySubject).map(([subject, qs]) => (
              <SubjectGroup key={subject} subject={subject} questions={qs} setActiveTab={setActiveTab} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 px-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
            <p className="text-bunker-500 dark:text-bunker-400">Nenhuma questão para revisar hoje.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayView;