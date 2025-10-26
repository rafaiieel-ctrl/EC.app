import React, { useState, useEffect } from 'react';
import { useQuestionDispatch } from '../contexts/QuestionContext';
import { Question } from '../types';

interface EditQuestionModalProps {
  question: Question;
  onClose: () => void;
}

const EditQuestionModal: React.FC<EditQuestionModalProps> = ({ question, onClose }) => {
  const { updateQuestion } = useQuestionDispatch();
  const [form, setForm] = useState({
    bank: '', position: '', subject: '', topic: '', hotTopic: false, questionRef: '', questionText: '',
    altA: '', altB: '', altC: '', altD: '', altE: '', explanation: '', comments: '',
    correctAnswer: '',
  });

  useEffect(() => {
    if (question) {
      setForm({
        bank: question.bank,
        position: question.position,
        subject: question.subject,
        topic: question.topic,
        hotTopic: question.hotTopic,
        questionRef: question.questionRef,
        questionText: question.questionText,
        altA: question.options.A || '',
        altB: question.options.B || '',
        altC: question.options.C || '',
        altD: question.options.D || '',
        altE: question.options.E || '',
        explanation: question.explanation,
        comments: question.comments || '',
        correctAnswer: question.correctAnswer,
      });
    }
  }, [question]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm(prev => ({ ...prev, [name]: checked }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.correctAnswer || !form.questionRef || !form.questionText) {
      alert("Preencha os campos obrigatórios: Identificação, Enunciado e Gabarito.");
      return;
    }

    const updatedQuestionData: Question = {
      ...question,
      bank: form.bank,
      position: form.position,
      subject: form.subject,
      topic: form.topic,
      questionRef: form.questionRef,
      questionText: form.questionText,
      options: {
        A: form.altA || undefined,
        B: form.altB || undefined,
        C: form.altC || undefined,
        D: form.altD || undefined,
        E: form.altE || undefined,
      },
      explanation: form.explanation,
      comments: form.comments,
      correctAnswer: form.correctAnswer.toUpperCase(),
      hotTopic: form.hotTopic,
    };

    updateQuestion(updatedQuestionData);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center" 
      onClick={onClose}
    >
      <div 
        className="bg-bunker-50 dark:bg-bunker-950 w-full max-w-4xl max-h-[90vh] rounded-lg shadow-xl overflow-y-auto" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-question-title"
      >
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 id="edit-question-title" className="text-2xl font-bold text-slate-900 dark:text-white">Editar Questão</h2>
              <p className="text-bunker-500 dark:text-bunker-400">Faça ajustes nos dados da questão.</p>
            </div>
             <button type="button" onClick={onClose} className="p-2 -mr-2 text-2xl font-bold leading-none rounded-full hover:bg-bunker-200 dark:hover:bg-bunker-800" aria-label="Fechar modal">&times;</button>
          </div>
          
          <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-6">
            <h3 className="font-bold text-lg">Informações Gerais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="bank" value={form.bank} onChange={handleChange} placeholder="Banca (ex: FGV)" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
                <input name="position" value={form.position} onChange={handleChange} placeholder="Cargo / Prova" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
                <input name="subject" value={form.subject} onChange={handleChange} placeholder="Disciplina" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
                <input name="topic" value={form.topic} onChange={handleChange} placeholder="Tópico" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
            </div>
            <div className="col-span-1 md:col-span-2">
                <input name="questionRef" value={form.questionRef} onChange={handleChange} placeholder="Identificação curta (ex: Q5 Daily Scrum)" required className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
            </div>
            <div className="flex items-center gap-2">
                <input type="checkbox" id="hotTopicEdit" name="hotTopic" checked={form.hotTopic} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
                <label htmlFor="hotTopicEdit" className="font-medium text-sm">🔥 Vai cair na prova</label>
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
            <div>
                 <label htmlFor="correctAnswerEdit" className="font-medium text-sm">Gabarito</label>
                 <input id="correctAnswerEdit" name="correctAnswer" value={form.correctAnswer} onChange={handleChange} placeholder="Gabarito (A-E)" required className="mt-1 w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
            </div>
          </div>

          <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-6">
            <h3 className="font-bold text-lg">Anotações Pessoais</h3>
            <textarea name="comments" value={form.comments} onChange={handleChange} placeholder="Escreva aqui seus insights, dificuldades, ou links sobre a questão..." rows={4} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"></textarea>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-bunker-200 dark:border-bunker-700">
            <button type="button" onClick={onClose} className="bg-bunker-200 dark:bg-bunker-700 text-bunker-800 dark:text-bunker-200 font-bold py-2 px-4 rounded-lg hover:bg-bunker-300 dark:hover:bg-bunker-600 transition-colors">Cancelar</button>
            <button type="submit" className="bg-sky-500 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-colors">Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditQuestionModal;