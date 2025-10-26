
import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import { ExclamationTriangleIcon } from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';

const SettingsView: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const questions = useQuestionState();
  const { resetAllProgress } = useQuestionDispatch();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    updateSettings({ [name]: checked });
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      updateSettings({ [name]: numValue });
    } else if (value === '') {
        // Allow clearing the input, maybe default to 1
        updateSettings({ [name]: 1 });
    }
  };
  
  const handleIntervalChange = (index: number, value: number) => {
    if (isNaN(value) || value < 0.1) return;
    const newIntervals = [...settings.srsIntervals];
    newIntervals[index] = value;
    updateSettings({ srsIntervals: newIntervals });
  };

  const addInterval = () => {
    const lastInterval = settings.srsIntervals[settings.srsIntervals.length - 1] || 30;
    const newIntervals = [...settings.srsIntervals, lastInterval * 2];
    updateSettings({ srsIntervals: newIntervals });
  };

  const removeInterval = (index: number) => {
    if (settings.srsIntervals.length <= 1) {
      alert("É necessário pelo menos um intervalo.");
      return;
    }
    const newIntervals = settings.srsIntervals.filter((_, i) => i !== index);
    updateSettings({ srsIntervals: newIntervals });
  };

  const handleExport = () => {
    if (questions.length === 0) {
      alert("Nenhuma questão para exportar.");
      return;
    }
    const header = "DATE;BANK;POSITION;SUBJECT;TOPIC;QUESTION_REF;QUESTION_TEXT;ALT_A;ALT_B;ALT_C;ALT_D;ALT_E;EXPLANATION;YOUR_ANSWER;CORRECT_ANSWER;ISCORRECT;TIME_SEC;LEVEL;HOT_TOPIC";
    const sanitize = (str: any): string => String(str ?? '').replace(/;/g, ',').replace(/\r?\n/g, ' ');
    const rows = questions.map(q => [
        sanitize(q.lastAttemptDate), sanitize(q.bank), sanitize(q.position), sanitize(q.subject), sanitize(q.topic), sanitize(q.questionRef), sanitize(q.questionText),
        sanitize(q.options.A), sanitize(q.options.B), sanitize(q.options.C), sanitize(q.options.D), sanitize(q.options.E), sanitize(q.explanation),
        sanitize(q.yourAnswer), sanitize(q.correctAnswer), q.lastWasCorrect ? "0" : "1", q.timeSec, q.selfEvalLevel, q.hotTopic ? "1" : "0",
    ].join(';'));
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const today = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `revisao_questoes_export_${today}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResetProgress = () => {
    setIsConfirmModalOpen(true);
  };

  const handleConfirmReset = () => {
    resetAllProgress();
    setTimeout(() => {
        alert("Progresso de todas as questões foi zerado.");
    }, 100);
  };


  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações</h2>
        <p className="text-bunker-500 dark:text-bunker-400">Personalize o comportamento do aplicativo.</p>
      </div>

      <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-6">
        <h3 className="font-bold text-lg border-b border-bunker-200 dark:border-bunker-800 pb-3">Intervalos de Repetição Espaçada</h3>
        <p className="text-sm text-bunker-500 dark:text-bunker-400">Defina a sequência de dias para a próxima revisão após um acerto. Use 0.5 para 12 horas.</p>
        <div className="space-y-3">
          {settings.srsIntervals.map((interval, index) => (
            <div key={index} className="flex items-center gap-3">
              <label className="text-sm font-medium w-20">Etapa {index + 1}</label>
              <input
                type="number"
                value={interval}
                onChange={(e) => handleIntervalChange(index, parseFloat(e.target.value))}
                step="0.5"
                min="0.5"
                className="w-24 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"
              />
              <span className="text-sm text-bunker-500 dark:text-bunker-400">dias</span>
              <button onClick={() => removeInterval(index)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold ml-auto p-1">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addInterval} className="text-sm bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold py-2 px-4 rounded-lg hover:bg-sky-500/20 transition-colors">+ Adicionar Etapa</button>
      </div>
      
      <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-6">
        <h3 className="font-bold text-lg border-b border-bunker-200 dark:border-bunker-800 pb-3">Fila de Revisão</h3>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <label htmlFor="questionsPerPage" className="font-medium">Questões por página</label>
          <input
            id="questionsPerPage"
            name="questionsPerPage"
            type="number"
            value={settings.questionsPerPage}
            onChange={handleNumberChange}
            min="1"
            max="100"
            className="w-full sm:w-32 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"
          />
        </div>
      </div>

      <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-6">
        <h3 className="font-bold text-lg border-b border-bunker-200 dark:border-bunker-800 pb-3">Sessão de Estudo</h3>
        
        <div className="flex justify-between items-center gap-2">
            <label htmlFor="enableTimer" className="font-medium">
                Habilitar cronômetro de estudo
                <p className="text-sm font-normal text-bunker-500 dark:text-bunker-400">Mostra um timer regressivo durante a revisão.</p>
            </label>
            <label htmlFor="enableTimer" className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                id="enableTimer"
                name="enableTimer"
                checked={settings.enableTimer}
                onChange={handleCheckboxChange}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-bunker-200 dark:bg-bunker-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-sky-300 dark:peer-focus:ring-sky-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-sky-600"></div>
            </label>
        </div>

        {settings.enableTimer && (
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-4 border-t border-bunker-200 dark:border-bunker-700">
            <label htmlFor="studyTimerDuration" className="font-medium">Duração do cronômetro (minutos)</label>
            <input
              id="studyTimerDuration"
              name="studyTimerDuration"
              type="number"
              value={settings.studyTimerDuration}
              onChange={handleNumberChange}
              min="1"
              max="120"
              className="w-full sm:w-32 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"
            />
          </div>
        )}
      </div>

      <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-4">
        <h3 className="font-bold text-lg border-b border-bunker-200 dark:border-bunker-800 pb-3">Gerenciamento de Dados</h3>
        <p className="text-sm text-bunker-500 dark:text-bunker-400">
          O aplicativo salva automaticamente todas as alterações no armazenamento local do seu navegador. Não é necessário salvar manualmente.
        </p>
        <div className="flex justify-start">
          <button
            onClick={handleExport}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Fazer Backup Manual (Exportar)
          </button>
        </div>
      </div>
      
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg space-y-4">
        <div className="flex items-center gap-3">
          <div className="text-red-400"><ExclamationTriangleIcon /></div>
          <h3 className="font-bold text-lg text-red-400">Zona de Risco</h3>
        </div>
        <p className="text-sm text-red-300">
          As ações abaixo são destrutivas e não podem ser desfeitas. Tenha certeza do que está fazendo.
        </p>
        <div className="pt-4 mt-2 border-t border-red-500/20">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-200">Zerar todo o progresso de estudo</p>
              <p className="text-sm text-red-300 max-w-md">
                Isso redefine o domínio, histórico e agendamento de todas as questões para o estado inicial. As questões em si <strong>não</strong> serão apagadas.
              </p>
            </div>
            <button
              onClick={handleResetProgress}
              disabled={questions.length === 0}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Zerar Progresso
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmReset}
        title="Zerar todo o progresso?"
      >
        <p>
            Isso irá zerar o progresso de estudo (domínio, acertos, histórico) de <strong>todas as {questions.length} questões</strong>.
        </p>
        <p className="font-bold mt-4">
            Esta ação é irreversível. Deseja continuar?
        </p>
      </ConfirmationModal>
    </div>
  );
};

export default SettingsView;
