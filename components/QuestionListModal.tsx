
import React from 'react';
import { Question } from '../types';
import * as srs from '../services/srsService';

interface QuestionListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  questions: Question[];
}

const QuestionListModal: React.FC<QuestionListModalProps> = ({ isOpen, onClose, title, questions }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" 
            onClick={onClose}
        >
            <div 
                className="bg-bunker-50 dark:bg-bunker-950 w-full max-w-2xl max-h-[80vh] rounded-lg shadow-xl flex flex-col" 
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="question-list-title"
            >
                <header className="p-4 border-b border-bunker-200 dark:border-bunker-800 flex justify-between items-center shrink-0">
                    <h2 id="question-list-title" className="text-lg font-bold text-slate-900 dark:text-white">{title} ({questions.length})</h2>
                    <button type="button" onClick={onClose} className="p-2 -m-2 text-2xl font-bold leading-none rounded-full hover:bg-bunker-200 dark:hover:bg-bunker-800" aria-label="Fechar modal">&times;</button>
                </header>
                <div className="p-4 overflow-y-auto">
                    {questions.length > 0 ? (
                        <ul className="space-y-2">
                            {questions.map(q => (
                                <li key={q.id} className="p-3 bg-bunker-100 dark:bg-bunker-900 rounded-md flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{q.questionRef}</p>
                                        <p className="text-sm text-bunker-500 dark:text-bunker-400">{q.subject}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-sm font-bold">{q.masteryScore.toFixed(0)}%</p>
                                        <p className="text-xs text-bunker-500 dark:text-bunker-400">Vence: {srs.formatISOToBr(q.nextReviewDate)}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-center text-bunker-500 dark:text-bunker-400 py-8">Nenhuma questão para exibir.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuestionListModal;
