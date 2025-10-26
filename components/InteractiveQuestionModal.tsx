import React, { useState, useEffect } from 'react';
import { Question } from '../types';
import * as srs from '../services/srsService';
import { useSettings } from '../contexts/SettingsContext';

interface InteractiveQuestionModalProps {
  question: Question;
  onClose: () => void;
  onQuestionAnswered: (updatedQuestion: Question) => void;
}

const InteractiveQuestionModal: React.FC<InteractiveQuestionModalProps> = ({ question, onClose, onQuestionAnswered }) => {
  const { settings } = useSettings();
  const [isRevealed, setIsRevealed] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [timeTaken, setTimeTaken] = useState(0);
  const [srsUpdates, setSrsUpdates] = useState<Partial<Omit<Question, 'id'>> | null>(null);
  
  useEffect(() => {
    setQuestionStartTime(Date.now());
  }, [question.id]);

  const handleChoice = (choice: string) => {
    if (isRevealed) return;
    setSelectedChoice(choice);
  };

  const handleReveal = () => {
    if (!selectedChoice) {
      if (!window.confirm("Nenhuma alternativa selecionada. Deseja revelar a resposta mesmo assim?")) {
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
    let evalLevel: number;
    let isCorrectNow: boolean = selectedChoice === question.correctAnswer;
        
    switch (rating) {
        case 'again': evalLevel = 0; isCorrectNow = false; break;
        case 'hard': evalLevel = 1; break;
        case 'good': evalLevel = 2; break;
        case 'easy': evalLevel = 3; break;
    }

    const updates = srs.calculateNewSrsState(
        question,
        isCorrectNow,
        evalLevel,
        timeTaken,
        settings.srsIntervals
    );
    setSrsUpdates(updates);
  };
  
  const handleConfirmUpdate = () => {
    if (srsUpdates) {
        const updatedQuestion: Question = {
            ...question,
            yourAnswer: selectedChoice || undefined,
            ...srsUpdates,
        };
        onQuestionAnswered(updatedQuestion);
    }
  };
  
  const isCorrect = selectedChoice === question.correctAnswer;
  const masteryColor = (score: number) => score < 40 ? 'text-red-400' : score < 75 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-bunker-50 dark:bg-bunker-950 w-full max-w-2xl max-h-[90vh] rounded-lg shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="p-4 border-b border-bunker-200 dark:border-bunker-800 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{question.questionRef}</h2>
            <p className="text-sm text-bunker-500 dark:text-bunker-400">{question.subject}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 -m-2 text-2xl font-bold leading-none rounded-full hover:bg-bunker-200 dark:hover:bg-bunker-800" aria-label="Fechar modal">&times;</button>
        </header>
        
        <div className="p-6 space-y-4 overflow-y-auto">
            <div className="p-4 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                <p className="whitespace-pre-wrap">{question.questionText}</p>
            </div>
            <div className="space-y-2">
                {Object.entries(question.options).map(([key, value]) => value && (
                    <button
                    key={key}
                    onClick={() => handleChoice(key)}
                    disabled={isRevealed}
                    className={`w-full text-left p-3 rounded-md border-2 transition-all duration-200 flex gap-3 
                        ${selectedChoice === key ? 'bg-sky-100 dark:bg-sky-900/50 border-sky-500' : 'bg-bunker-100 dark:bg-bunker-900 border-transparent hover:border-sky-400'} 
                        ${isRevealed && key === question.correctAnswer ? '!bg-emerald-100 dark:!bg-emerald-900/50 !border-emerald-500' : ''}
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
            ) : !srsUpdates ? (
                <div className="p-4 bg-bunker-50 dark:bg-bunker-800/50 rounded-lg space-y-4">
                    <p className="text-center text-sm font-semibold text-bunker-600 dark:text-bunker-300">Como você se sentiu com esta questão?</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <button onClick={() => handleRating('again')} className="p-3 font-bold rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-300 transition-colors">Errei</button>
                        <button onClick={() => handleRating('hard')} className="p-3 font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 transition-colors">Difícil</button>
                        <button onClick={() => handleRating('good')} className="p-3 font-bold rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-700 dark:text-sky-300 transition-colors">Ok</button>
                        <button onClick={() => handleRating('easy')} className="p-3 font-bold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 transition-colors">Fácil</button>
                    </div>
                </div>
            ) : (
                <div className="p-4 bg-bunker-50 dark:bg-bunker-800/50 rounded-lg space-y-4 text-center">
                    <h4 className="font-bold text-lg">Progresso Atualizado!</h4>
                    <div className="flex justify-center items-center gap-4">
                        <div>
                            <p className="text-xs text-bunker-500 dark:text-bunker-400">Domínio</p>
                            <p className={`font-bold text-2xl ${masteryColor(question.masteryScore)}`}>{question.masteryScore.toFixed(0)}% <span className="text-sm text-bunker-500 dark:text-bunker-400">→</span> <span className={masteryColor(srsUpdates.masteryScore!)}>{srsUpdates.masteryScore?.toFixed(0)}%</span></p>
                        </div>
                        <div>
                            <p className="text-xs text-bunker-500 dark:text-bunker-400">Próxima Revisão</p>
                            <p className="font-bold text-lg">{srs.formatISOToBr(srsUpdates.nextReviewDate)}</p>
                        </div>
                    </div>
                    <button onClick={handleConfirmUpdate} className="w-full mt-4 bg-sky-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-sky-600">
                        Fechar e Atualizar Mapa
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default InteractiveQuestionModal;