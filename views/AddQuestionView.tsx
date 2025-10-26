import React, { useState } from 'react';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import { Question, QuestionOptions, TabID } from '../types';

interface AddQuestionViewProps {
  setActiveTab: (tab: TabID) => void;
}

const initialFormState = {
  bank: '', position: '', subject: '', topic: '', hotTopic: false, questionRef: '', questionText: '',
  altA: '', altB: '', altC: '', altD: '', altE: '', explanation: '', comments: '',
  yourAnswer: '', correctAnswer: '', timeSec: '150', isCorrect: '1', selfEvalLevel: '',
};

const AddQuestionView: React.FC<AddQuestionViewProps> = ({ setActiveTab }) => {
  const { addQuestion } = useQuestionDispatch();
  const questions = useQuestionState();
  const { settings } = useSettings();
  const [form, setForm] = useState(initialFormState);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setForm(prev => ({ ...prev, [name]: checked }));
    } else {
        setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEvalClick = (level: string) => {
    setForm(prev => ({...prev, selfEvalLevel: level}));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.selfEvalLevel || !form.correctAnswer || !form.questionRef || !form.questionText) {
        alert("Preencha os campos obrigatórios: Identificação, Enunciado, Gabarito e Auto-avaliação.");
        return;
    }

    const normalizedNewRef = form.questionRef.trim().toLowerCase();
    const existingRefs = new Set(questions.map(q => q.questionRef.trim().toLowerCase()));

    if (existingRefs.has(normalizedNewRef)) {
      alert(`Erro: Uma questão com o identificador "${form.questionRef}" já existe. Por favor, use um identificador único.`);
      return;
    }

    const isCorrectBool = form.isCorrect === '1';
    const selfEvalLevelNum = parseInt(form.selfEvalLevel, 10);
    
    // Simplified initial mastery
    const mastery = isCorrectBool ? 70 : 40;

    const { srsStage, nextReviewDate } = srs.getInitialSrsState(isCorrectBool, settings.srsIntervals);

    const newQuestion: Omit<Question, 'id'> = {
      bank: form.bank, position: form.position, subject: form.subject, topic: form.topic,
      questionRef: form.questionRef, questionText: form.questionText,
      options: { A: form.altA, B: form.altB, C: form.altC, D: form.altD, E: form.altE },
      explanation: form.explanation, 
      comments: form.comments,
      yourAnswer: form.yourAnswer.toUpperCase(), correctAnswer: form.correctAnswer.toUpperCase(),
      lastAttemptDate: srs.todayISO(), totalAttempts: 1, lastWasCorrect: isCorrectBool,
      timeSec: parseInt(form.timeSec, 10) || 150, selfEvalLevel: selfEvalLevelNum,
      masteryScore: mastery, 
      nextReviewDate: nextReviewDate,
      hotTopic: form.hotTopic, 
      willFallExam: false, // Legacy
      srsStage: srsStage,
      correctStreak: isCorrectBool ? 1 : 0,
      isCritical: false,
      createdAt: srs.todayISO(),
    };

    addQuestion(newQuestion);
    alert('Questão registrada com sucesso!');
    setForm(initialFormState);
    setActiveTab('today');
  };

  const evalOptions = [
    { level: '0', title: '😵 Chorei sangue', desc: 'Não sabia' },
    { level: '1', title: '⚠ Inseguro', desc: 'Perigosa' },
    { level: '2', title: '⏳ Demorei', desc: 'Mas fui' },
    { level: '3', title: '🟢 Fácil', desc: 'Rápido e seguro' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto">
      <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Registrar Nova Questão</h2>
          <p className="text-bunker-500 dark:text-bunker-400">Adicione uma questão que você resolveu para o sistema de revisão.</p>
      </div>

      <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-6">
        <h3 className="font-bold text-lg">Informações Gerais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bank & Position */}
            <input name="bank" value={form.bank} onChange={handleChange} placeholder="Banca (ex: FGV)" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
            <input name="position" value={form.position} onChange={handleChange} placeholder="Cargo / Prova" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
            {/* Subject & Topic */}
            <input name="subject" value={form.subject} onChange={handleChange} placeholder="Disciplina" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
            <input name="topic" value={form.topic} onChange={handleChange} placeholder="Tópico" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
        </div>
         <div className="col-span-1 md:col-span-2">
            <input name="questionRef" value={form.questionRef} onChange={handleChange} placeholder="Identificação curta (ex: Q5 Daily Scrum)" required className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
        </div>
        <div className="flex items-center gap-2">
            <input type="checkbox" id="hotTopic" name="hotTopic" checked={form.hotTopic} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
            <label htmlFor="hotTopic" className="font-medium text-sm">🔥 Vai cair na prova</label>
        </div>
      </div>
      
      <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-6">
         <h3 className="font-bold text-lg">Enunciado e Alternativas</h3>
         <textarea name="questionText" value={form.questionText} onChange={handleChange} placeholder="Enunciado completo da questão" required rows={4} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"></textarea>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <textarea name="altA" value={form.altA} onChange={handleChange} placeholder="Alternativa A" rows={2} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"></textarea>
            <textarea name="altB" value={form.altB} onChange={handleChange} placeholder="Alternativa B" rows={2} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"></textarea>
            <textarea name="altC" value={form.altC} onChange={handleChange} placeholder="Alternativa C" rows={2} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"></textarea>
            <textarea name="altD" value={form.altD} onChange={handleChange} placeholder="Alternativa D" rows={2} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"></textarea>
            <textarea name="altE" value={form.altE} onChange={handleChange} placeholder="Alternativa E" rows={2} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"></textarea>
            <textarea name="explanation" value={form.explanation} onChange={handleChange} placeholder="Comentário / Macete (opcional)" rows={2} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"></textarea>
         </div>
      </div>

      <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-6">
        <h3 className="font-bold text-lg">Anotações Pessoais (Opcional)</h3>
        <textarea name="comments" value={form.comments} onChange={handleChange} placeholder="Escreva aqui seus insights, dificuldades, ou links sobre a questão..." rows={3} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"></textarea>
      </div>
      
      <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-6">
        <h3 className="font-bold text-lg">Sua Resposta e Avaliação</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <input name="yourAnswer" value={form.yourAnswer} onChange={handleChange} placeholder="Sua Resposta (A-E)" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
             <input name="correctAnswer" value={form.correctAnswer} onChange={handleChange} placeholder="Gabarito (A-E)" required className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
             <input name="timeSec" value={form.timeSec} onChange={handleChange} type="number" placeholder="Tempo (s)" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
             <select name="isCorrect" value={form.isCorrect} onChange={handleChange} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2">
                 <option value="1">Acertei</option>
                 <option value="0">Errei</option>
            </select>
        </div>
        <div>
            <label className="font-medium text-sm mb-2 block">Como sentiu? (define espaçamento inicial)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {evalOptions.map(opt => (
                    <button type="button" key={opt.level} onClick={() => handleEvalClick(opt.level)}
                        className={`p-4 text-left rounded-lg border-2 transition-colors ${form.selfEvalLevel === opt.level ? 'border-sky-500 bg-sky-500/10' : 'border-bunker-200 dark:border-bunker-700 hover:border-sky-400'}`}
                    >
                        <p className="font-bold">{opt.title}</p>
                        <p className="text-sm text-bunker-500 dark:text-bunker-400">{opt.desc}</p>
                    </button>
                ))}
            </div>
             {form.selfEvalLevel === '' && <p className="text-red-500 text-xs mt-2">Seleção obrigatória.</p>}
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button type="button" onClick={() => setForm(initialFormState)} className="bg-bunker-200 dark:bg-bunker-700 text-bunker-800 dark:text-bunker-200 font-bold py-2 px-4 rounded-lg hover:bg-bunker-300 dark:hover:bg-bunker-600 transition-colors">Limpar</button>
        <button type="submit" className="bg-sky-500 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-colors">Salvar Questão</button>
      </div>
    </form>
  );
};

export default AddQuestionView;