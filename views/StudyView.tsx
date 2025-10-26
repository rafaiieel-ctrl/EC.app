import React, { useState, useEffect, useMemo } from 'react';
import { useQuestionDispatch } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import { Question } from '../types';
import { FireIcon } from '../components/icons';

interface StudyViewProps {
  dueQuestions: Question[];
}

const TimerDisplay: React.FC<{ seconds: number }> = ({ seconds }) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return (
    <div className="font-mono text-lg font-bold bg-bunker-200 dark:bg-bunker-800 px-3 py-1 rounded-md">
      {String(minutes).padStart(2, '0')}:{String(remainingSeconds).padStart(2, '0')}
    </div>
  );
};

const StudyView: React.FC<StudyViewProps> = ({ dueQuestions }) => {
  const { updateQuestion } = useQuestionDispatch();
  const { settings } = useSettings();
  
  const [sessionQueue, setSessionQueue] = useState<Question[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [filter, setFilter] = useState('all');
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  // Per-question timer state
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [timeTaken, setTimeTaken] = useState(0);

  // Session timer state
  const [timeLeft, setTimeLeft] = useState(settings.studyTimerDuration * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  const currentQuestion = sessionQueue.length > 0 ? sessionQueue[currentIndex] : null;

  const filteredDueCounts = useMemo(() => {
    return {
        all: dueQuestions.length,
        incorrect: dueQuestions.filter(q => !q.lastWasCorrect && q.totalAttempts > 0).length,
        hot: dueQuestions.filter(q => q.hotTopic).length,
        critical: dueQuestions.filter(q => q.isCritical).length,
    };
  }, [dueQuestions]);

  const handleStartSession = () => {
    let queue: Question[] = [];
    switch (filter) {
        case 'incorrect':
            queue = dueQuestions.filter(q => !q.lastWasCorrect && q.totalAttempts > 0);
            break;
        case 'hot':
            queue = dueQuestions.filter(q => q.hotTopic);
            break;
        case 'critical':
            queue = dueQuestions.filter(q => q.isCritical);
            break;
        case 'all':
        default:
            queue = dueQuestions;
            break;
    }

    if (queue.length === 0) {
        alert('Não há questões para estudar com o filtro selecionado.');
        return;
    }

    setSessionQueue(queue);
    setCurrentIndex(0);
    setIsRevealed(false);
    setSelectedChoice(null);
    if (settings.enableTimer) {
        setTimeLeft(settings.studyTimerDuration * 60);
        setIsTimerRunning(true);
    }
    setIsSessionActive(true);
  };
  
  const isFinished = isSessionActive && currentIndex >= sessionQueue.length;

  useEffect(() => {
    if (dueQuestions.length === 0) {
        setIsSessionActive(false);
        setSessionQueue([]);
    }
  }, [dueQuestions]);

  useEffect(() => {
    setTimeLeft(settings.studyTimerDuration * 60);
  }, [settings.studyTimerDuration]);

  // Per-question timer effect
  useEffect(() => {
    if (isSessionActive && !isFinished) {
        setQuestionStartTime(Date.now());
        setTimeTaken(0);
    }
  }, [currentIndex, isSessionActive, isFinished]);
  
  // Session timer effect
  useEffect(() => {
    if (!isTimerRunning || timeLeft <= 0) {
      if (timeLeft <= 0 && isTimerRunning) {
         alert("Tempo esgotado! Faça uma pausa.");
         setIsTimerRunning(false);
      }
      return;
    }
    const intervalId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isTimerRunning, timeLeft]);


  const handleChoice = (choice: string) => {
    if (isRevealed) return;
    setSelectedChoice(choice);
  };
  
  const handleReveal = () => {
    if (!selectedChoice) {
        if(!window.confirm("Nenhuma alternativa selecionada. Deseja revelar a resposta mesmo assim?")) {
            return;
        }
    }
    if (questionStartTime) {
        const elapsed = (Date.now() - questionStartTime) / 1000;
        setTimeTaken(elapsed);
    }
    setIsRevealed(true);
  };

  const handleRating = (rating: 'again' | 'hard' | 'good' | 'easy' | 'reset') => {
    if (!currentQuestion) return;

    if (rating === 'reset') {
        if (!window.confirm("Isso irá zerar o progresso de revisão desta questão, fazendo-a voltar para o início da fila. Continuar?")) {
            return;
        }
        const updated: Question = {
            ...currentQuestion,
            masteryScore: Math.max(0, currentQuestion.masteryScore - 25),
            nextReviewDate: srs.todayISO(),
            srsStage: 0,
            correctStreak: 0,
        };
        updateQuestion(updated);
    } else {
        let evalLevel: number;
        let isCorrectNow: boolean = selectedChoice === currentQuestion.correctAnswer;
        
        switch (rating) {
            case 'again': evalLevel = 0; isCorrectNow = false; break;
            case 'hard': evalLevel = 1; break;
            case 'good': evalLevel = 2; break;
            case 'easy': evalLevel = 3; break;
        }

        const srsUpdates = srs.calculateNewSrsState(
            currentQuestion,
            isCorrectNow,
            evalLevel,
            timeTaken,
            settings.srsIntervals
        );

        const updated: Question = {
            ...currentQuestion,
            yourAnswer: selectedChoice || undefined,
            ...srsUpdates,
        };
        updateQuestion(updated);
    }

    if (currentIndex < sessionQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsRevealed(false);
      setSelectedChoice(null);
    } else {
      setCurrentIndex(prev => prev + 1);
      setIsTimerRunning(false);
    }
  };
  

  if (dueQuestions.length === 0) {
     return (
        <div className="text-center py-16 px-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
          <h3 className="text-xl font-semibold">Tudo em dia!</h3>
          <p className="text-bunker-500 dark:text-bunker-400 mt-2">Nenhuma questão para estudar no momento.</p>
        </div>
      );
  }

  if (!isSessionActive) {
    const filterOptions = [
        { id: 'all', label: 'Todas as pendentes', count: filteredDueCounts.all },
        { id: 'incorrect', label: 'Questões que errei', count: filteredDueCounts.incorrect },
        { id: 'hot', label: '🔥 Vai cair na prova', count: filteredDueCounts.hot },
        { id: 'critical', label: '⚠️ Críticas', count: filteredDueCounts.critical },
    ];
    const selectedFilterCount = filterOptions.find(f => f.id === filter)?.count || 0;

    return (
        <div className="max-w-3xl mx-auto text-center space-y-8 p-8 bg-bunker-100 dark:bg-bunker-900 rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Prepare sua Sessão de Estudo</h2>
            <p className="text-bunker-500 dark:text-bunker-400">Selecione um grupo de questões para focar sua revisão.</p>
            
            <div className="space-y-3 text-left max-w-md mx-auto">
                {filterOptions.map(opt => (
                    <label key={opt.id} className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${filter === opt.id ? 'bg-sky-500/10 border-sky-500' : 'bg-bunker-50 dark:bg-bunker-800 border-bunker-200 dark:border-bunker-700 hover:border-sky-400'}`}>
                        <span className="font-semibold">{opt.label}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-lg">{opt.count}</span>
                          <input type="radio" name="filter" value={opt.id} checked={filter === opt.id} onChange={(e) => setFilter(e.target.value)} className="h-5 w-5 text-sky-600 focus:ring-sky-500 border-gray-300"/>
                        </div>
                    </label>
                ))}
            </div>
            
            <button onClick={handleStartSession} disabled={selectedFilterCount === 0} className="w-full max-w-md mx-auto bg-sky-500 text-white font-bold py-4 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-transform hover:scale-105 disabled:bg-bunker-300 dark:disabled:bg-bunker-700 disabled:cursor-not-allowed disabled:scale-100">
                {selectedFilterCount > 0 ? `Iniciar Sessão com ${selectedFilterCount} Questão(ões)` : 'Nenhuma questão encontrada'}
            </button>
        </div>
    );
  }

  if (isFinished) {
    return (
      <div className="text-center py-16 px-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-sky-500 mb-4">Sessão Concluída!</h2>
        <p className="text-lg text-bunker-600 dark:text-bunker-300">Ótimo trabalho! Você revisou as questões selecionadas.</p>
        <button onClick={() => setIsSessionActive(false)} className="mt-6 bg-sky-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-colors">
            Iniciar Nova Sessão
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
     return (
        <div className="text-center py-16 px-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
          <h3 className="text-xl font-semibold">Algo deu errado</h3>
          <p className="text-bunker-500 dark:text-bunker-400 mt-2">Não foi possível carregar a questão. Tente iniciar uma nova sessão.</p>
        </div>
      );
  }

  const isCorrect = selectedChoice === currentQuestion.correctAnswer;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center text-sm text-bunker-500 dark:text-bunker-400">
        <span>Questão {currentIndex + 1} de {sessionQueue.length}</span>
        {settings.enableTimer && <TimerDisplay seconds={timeLeft} />}
        <span>{currentQuestion.subject}</span>
      </div>

      <div className="bg-bunker-100 dark:bg-bunker-900 p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">{currentQuestion.questionRef}</h3>
          {currentQuestion.hotTopic && <div className="flex items-center gap-1 text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full"><FireIcon /> VAI CAIR</div>}
        </div>

        <p className="whitespace-pre-wrap mb-6">{currentQuestion.questionText}</p>

        <div className="space-y-3 mb-6">
          {Object.entries(currentQuestion.options).map(([key, value]) => value && (
            <button
              key={key}
              onClick={() => handleChoice(key)}
              disabled={isRevealed}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 flex items-start gap-4 
              ${selectedChoice === key 
                ? 'bg-sky-100 dark:bg-sky-900/50 border-sky-500 ring-2 ring-sky-500' 
                : 'bg-bunker-50 dark:bg-bunker-800 border-bunker-200 dark:border-bunker-700 hover:border-sky-400 disabled:hover:border-bunker-200 dark:disabled:hover:border-bunker-700'} 
              ${isRevealed && key === currentQuestion.correctAnswer ? '!bg-emerald-100 dark:!bg-emerald-900/50 !border-emerald-500' : ''}
              ${isRevealed && selectedChoice === key && !isCorrect ? '!bg-red-100 dark:!bg-red-900/50 !border-red-500' : ''}
              `}
            >
              <span className={`font-bold text-sky-600 dark:text-sky-400`}>{key})</span>
              <span>{value}</span>
            </button>
          ))}
        </div>

        {!isRevealed ? (
            <button onClick={handleReveal} className="w-full bg-sky-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-transform hover:scale-105">
                Conferir Resposta
            </button>
        ) : (
            <div className="p-4 bg-bunker-50 dark:bg-bunker-800/50 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                    <span className={`font-bold py-1 px-3 rounded-full ${isCorrect ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/20 text-red-700 dark:text-red-300'}`}>
                        {isCorrect ? 'Você Acertou!' : 'Você Errou!'}
                    </span>
                    <span className="text-sm">Gabarito: <strong>{currentQuestion.correctAnswer}</strong></span>
                </div>
                {currentQuestion.explanation && <p className="text-sm text-bunker-600 dark:text-bunker-300 border-t border-bunker-200 dark:border-bunker-700 pt-3 mt-3">{currentQuestion.explanation}</p>}

                <div className="pt-4">
                    <p className="text-center text-sm font-semibold mb-2 text-bunker-600 dark:text-bunker-300">Como você se sentiu com esta questão?</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <button onClick={() => handleRating('again')} className="p-3 font-bold rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-300 transition-colors">Errei (Again)</button>
                        <button onClick={() => handleRating('hard')} className="p-3 font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 transition-colors">Difícil (Hard)</button>
                        <button onClick={() => handleRating('good')} className="p-3 font-bold rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-700 dark:text-sky-300 transition-colors">Ok (Good)</button>
                        <button onClick={() => handleRating('easy')} className="p-3 font-bold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 transition-colors">Fácil (Easy)</button>
                    </div>
                    <div className="mt-4 text-center">
                        <button 
                            onClick={() => handleRating('reset')} 
                            className="text-xs text-bunker-500 dark:text-bunker-400 hover:text-red-500 dark:hover:text-red-400 underline transition-colors"
                        >
                            Preciso ver mais vezes. Resetar agendamento.
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default StudyView;