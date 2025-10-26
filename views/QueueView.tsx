import React, { useState } from 'react';
import { useQuestionState } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import { BrainIcon, CheckCircleIcon, FireIcon, XCircleIcon, ChevronRightIcon } from '../components/icons';
import { Question, TabID, UrgencyStatus } from '../types';

interface QueueViewProps {
  setActiveTab: (tab: TabID) => void;
}

const QueueItem: React.FC<{ question: Question }> = ({ question }) => {
    const urgency = srs.calcUrgency(question);
    const urgencyStyles = srs.getUrgencyStyles(urgency);

    return (
        <div className={`p-4 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4 border ${urgencyStyles.bg} ${urgencyStyles.border}`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${urgencyStyles.bg} ${urgencyStyles.text}`}>
                        {urgency}
                    </span>
                    {question.hotTopic && <span className="flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full"><FireIcon /> QUENTE</span>}
                </div>
                <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{question.questionRef}</p>
                <p className="text-sm text-bunker-500 dark:text-bunker-400">{question.subject} &bull; {question.topic}</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <p className="text-bunker-500 dark:text-bunker-400 text-xs">Domínio</p>
                        <p className="font-bold">{Math.round(question.masteryScore)}%</p>
                    </div>
                     <div className="text-center">
                        <p className="text-bunker-500 dark:text-bunker-400 text-xs">Vencimento</p>
                        <p className="font-semibold">{srs.formatISOToBr(question.nextReviewDate)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-bunker-500 dark:text-bunker-400 text-xs">Última</p>
                        {question.lastWasCorrect ? <CheckCircleIcon /> : <XCircleIcon />}
                    </div>
                </div>
            </div>
        </div>
    );
};


const QueueView: React.FC<QueueViewProps> = ({ setActiveTab }) => {
  const questions = useQuestionState();
  const { settings } = useSettings();
  const [currentPage, setCurrentPage] = useState(1);

  const dueQuestions = React.useMemo(() => {
    const today = srs.todayISO();
    return questions
      .filter(q => q.nextReviewDate <= today)
      .sort((a,b) => (srs.calcUrgency(a) === srs.calcUrgency(b)) ? a.masteryScore - b.masteryScore : (srs.calcUrgency(a) === UrgencyStatus.CRITICO ? -1 : 1));
  }, [questions]);

  // Pagination logic
  const questionsPerPage = settings.questionsPerPage;
  const totalPages = Math.ceil(dueQuestions.length / questionsPerPage);
  const startIndex = (currentPage - 1) * questionsPerPage;
  const endIndex = startIndex + questionsPerPage;
  const paginatedQuestions = dueQuestions.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Fila de Revisão</h2>
          <p className="text-bunker-500 dark:text-bunker-400">Aqui estão todas as questões que precisam da sua atenção.</p>
        </div>
        {dueQuestions.length > 0 && (
          <button onClick={() => setActiveTab('study')} className="flex items-center gap-2 bg-sky-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-colors hover:scale-105 transform">
            <BrainIcon />
            <span>Estudar Fila Completa ({dueQuestions.length})</span>
          </button>
        )}
      </div>

      {dueQuestions.length > 0 ? (
        <>
          <div className="space-y-3">
            {paginatedQuestions.map(q => <QueueItem key={q.id} question={q} />)}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <button onClick={handlePrevPage} disabled={currentPage === 1} className="px-4 py-2 bg-bunker-200 dark:bg-bunker-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Anterior</button>
              <span className="text-sm font-medium text-bunker-600 dark:text-bunker-300">Página {currentPage} de {totalPages}</span>
              <button onClick={handleNextPage} disabled={currentPage === totalPages} className="px-4 py-2 bg-bunker-200 dark:bg-bunker-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Próxima</button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 px-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
          <h3 className="text-xl font-semibold">Fila Vazia!</h3>
          <p className="text-bunker-500 dark:text-bunker-400 mt-2">Você está em dia. Nenhuma questão precisa ser revisada no momento.</p>
        </div>
      )}
    </div>
  );
};

export default QueueView;