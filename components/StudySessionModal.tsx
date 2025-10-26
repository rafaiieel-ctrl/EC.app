import React, { useState, useEffect } from 'react';
import { useQuestionDispatch } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import { Question } from '../types';

interface StudySessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  title: string;
}

const StudySessionModal: React.FC<StudySessionModalProps> = ({ isOpen, onClose, questions, title }) => {
  const { updateQuestion } = useQuestionDispatch();
  const { settings } = useSettings();
  
  const [sessionQueue, setSessionQueue] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [timeTaken, setTimeTaken] = useState(0);
  
  const currentQuestion = sessionQueue.length > 0 ? sessionQueue[currentIndex] : null;

  useEffect(() => {
    if (isOpen && questions.length > 0) {
      // Sort questions by mastery, from lowest to highest, to tackle the hardest first
      const sortedQuestions = [...questions].sort((a, b) => a.masteryScore - b.masteryScore);
      setSessionQueue(sortedQuestions);
      setCurrentIndex(0);
      setIsRevealed(false);
      setSelectedChoice(null);
      setQuestionStartTime(Date.now());
    } else {
      setSessionQueue([]);
    }
  }, [isOpen, questions]);
  
  const isFinished = currentIndex >= sessionQueue.length;

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

  const handleRating = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentQuestion) return;

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

    if (currentIndex < sessionQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsRevealed(false);
      setSelectedChoice(null);
      setQuestionStartTime(Date.now());
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };
  
  if (!isOpen) {
    return null;
  }

  const renderContent = () => {
    if (isFinished) {
      return (
          <div className="text-center p-8 space-y-4">
            <h3 className="text-2xl font-bold text-sky-500">Sessão Concluída!</h3>
            <p className="text-bunker-600 dark:text-bunker-300">Você revisou todas as questões desta zona.</p>
            <button onClick={onClose} className="mt-4 bg-sky-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-colors">
                Voltar ao Mapa
            </button>
          </div>
      );
    }

    if (!currentQuestion) {
        return <div className="p-8 text-center text-bunker-500 dark:text-bunker-400">Carregando questão...</div>;
    }
    
    const isCorrect = selectedChoice === currentQuestion.correctAnswer;

    return (
        <div className="p-6 space-y-4">
            <div className="p-4 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                <p className="font-semibold text-sm mb-2">{currentQuestion.questionRef}</p>
                <p className="whitespace-pre-wrap">{currentQuestion.questionText}</p>
            </div>
            <div className="space-y-2">
                 {Object.entries(currentQuestion.options).map(([key, value]) => value && (
                    <button
                    key={key}
                    onClick={() => handleChoice(key)}
                    disabled={isRevealed}
                    className={`w-full text-left p-3 rounded-md border-2 transition-all duration-200 flex gap-3 
                        ${selectedChoice === key ? 'bg-sky-100 dark:bg-sky-900/50 border-sky-500' : 'bg-bunker-100 dark:bg-bunker-900 border-bunker-200 dark:border-bunker-800 hover:border-sky-400 disabled:hover:border-bunker-200 dark:disabled:hover:border-bunker-800'} 
                        ${isRevealed && key === currentQuestion.correctAnswer ? '!bg-emerald-100 dark:!bg-emerald-900/50 !border-emerald-500' : ''}
                        ${isRevealed && selectedChoice === key && !isCorrect ? '!bg-red-100 dark:!bg-red-900/50 !border-red-500' : ''}
                    `}
                    >
                    <span className="font-bold text-sky-600 dark:text-sky-400">{key})</span>
                    <span>{value}</span>
                    </button>
                ))}
            </div>

            {!isRevealed ? (
                 <button onClick={handleReveal} className="w-full mt-4 bg-sky-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-transform hover:scale-105">
                    Conferir Resposta
                </button>
            ) : (
                <div className="p-4 bg-bunker-50 dark:bg-bunker-800/50 rounded-lg space-y-4">
                    <p className="text-center text-sm font-semibold text-bunker-600 dark:text-bunker-300">Como você se sentiu com esta questão?</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <button onClick={() => handleRating('again')} className="p-3 font-bold rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-300 transition-colors">Errei</button>
                        <button onClick={() => handleRating('hard')} className="p-3 font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 transition-colors">Difícil</button>
                        <button onClick={() => handleRating('good')} className="p-3 font-bold rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-700 dark:text-sky-300 transition-colors">Ok</button>
                        <button onClick={() => handleRating('easy')} className="p-3 font-bold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 transition-colors">Fácil</button>
                    </div>
                </div>
            )}
        </div>
    );
  };
  
  const progress = isFinished ? sessionQueue.length : currentIndex;
  const total = sessionQueue.length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-bunker-50 dark:bg-bunker-950 w-full max-w-3xl max-h-[90vh] rounded-lg shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="p-4 border-b border-bunker-200 dark:border-bunker-800 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title} ({progress}/{total})</h2>
            <p className="text-sm text-bunker-500 dark:text-bunker-400">Resolva as questões para atualizar seu domínio.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 -m-2 text-2xl font-bold leading-none rounded-full hover:bg-bunker-200 dark:hover:bg-bunker-800" aria-label="Fechar modal">&times;</button>
        </header>
        
        <div className="overflow-y-auto">
            {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default StudySessionModal;
