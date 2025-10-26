import React, { useState, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useQuestionState } from '../contexts/QuestionContext';
import * as srs from '../services/srsService';
import { Goal, SubFilterType } from '../types';
import { TrophyIcon, CalendarIcon, PlusIcon, TrashIcon } from '../components/icons';


const GoalProgressCard: React.FC<{
  goal: Goal;
  current: number;
  onUpdateTarget: (goalId: string, newTarget: number) => void;
  onDelete: (goalId: string) => void;
}> = ({ goal, current, onUpdateTarget, onDelete }) => {
  const percentage = goal.target > 0 ? Math.min((current / goal.target) * 100, 100) : 0;
  const isComplete = current >= goal.target;

  const goalDescription = () => {
    const action = goal.type === 'review' ? 'Revisar' : 'Registrar';
    
    const subFilterText = {
        all: '',
        critical: ' (Críticas ⚠️)',
        hot: ' (Vai Cair 🔥)',
        incorrect: ' (Que Errei ❌)',
    }[goal.subFilter || 'all'];

    const scopeText = goal.filter.type === 'all'
        ? '(Geral)'
        : `em ${goal.filter.value}`;
    
    return `${action}${subFilterText} ${scopeText}`;
  };

  const Icon = goal.type === 'review' ? CalendarIcon : PlusIcon;

  return (
    <div className="bg-bunker-100 dark:bg-bunker-900 p-4 rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-bunker-500 dark:text-bunker-400">
            <Icon />
            <span className="font-semibold">{goalDescription()}</span>
          </div>
           <p className="text-2xl font-bold mt-2">
            {current} <span className="text-lg text-bunker-500 dark:text-bunker-400">/</span> 
            <input
              type="number"
              value={goal.target}
              onChange={(e) => onUpdateTarget(goal.id, parseInt(e.target.value, 10) || 0)}
              className="inline-block w-16 bg-transparent text-lg text-bunker-500 dark:text-bunker-400 font-normal p-0 border-0 focus:ring-0"
            />
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
            {isComplete && (
                <span className="text-xs font-semibold bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full">Meta Atingida!</span>
            )}
             <button onClick={() => onDelete(goal.id)} className="text-bunker-400 hover:text-red-500" aria-label="Excluir meta">
                <TrashIcon />
            </button>
        </div>
      </div>
      <div className="w-full bg-bunker-200 dark:bg-bunker-700 rounded-full h-2.5">
        <div 
          className={`h-2.5 rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-sky-500'}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};


const AddGoalForm: React.FC<{
  onAddGoal: (goal: Omit<Goal, 'id'>) => void;
  subjects: string[];
  topics: string[];
}> = ({ onAddGoal, subjects, topics }) => {
    const [type, setType] = useState<'review' | 'add'>('review');
    const [filterType, setFilterType] = useState<'all' | 'subject' | 'topic'>('all');
    const [filterValue, setFilterValue] = useState('*');
    const [subFilter, setSubFilter] = useState<SubFilterType>('all');
    const [target, setTarget] = useState(10);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddGoal({ type, target, filter: { type: filterType, value: filterValue }, subFilter });
        // Reset form
        setTarget(10);
        setFilterType('all');
        setFilterValue('*');
        setSubFilter('all');
    };

    const handleFilterTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value as 'all' | 'subject' | 'topic';
        setFilterType(newType);
        if (newType === 'all') setFilterValue('*');
        else if (newType === 'subject') setFilterValue(subjects[0] || '');
        else if (newType === 'topic') setFilterValue(topics[0] || '');
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg space-y-4">
             <h3 className="font-bold text-lg border-b border-bunker-200 dark:border-bunker-800 pb-3">Adicionar Nova Meta</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="text-sm font-medium">Tipo</label>
                    <select value={type} onChange={(e) => setType(e.target.value as 'review' | 'add')} className="w-full mt-1 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2">
                        <option value="review">Revisar Questões</option>
                        <option value="add">Registrar Questões</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium">Escopo</label>
                    <select value={filterType} onChange={handleFilterTypeChange} className="w-full mt-1 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2">
                        <option value="all">Geral</option>
                        <option value="subject">Por Disciplina</option>
                        <option value="topic">Por Tópico</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium">Filtro de Escopo</label>
                    <select value={filterValue} onChange={e => setFilterValue(e.target.value)} disabled={filterType === 'all'} className="w-full mt-1 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2 disabled:opacity-50">
                        {filterType === 'all' && <option value="*">Todas</option>}
                        {filterType === 'subject' && subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        {filterType === 'topic' && topics.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                    <label className="text-sm font-medium">Sub-filtro (para Revisão)</label>
                    <select 
                        value={subFilter} 
                        onChange={(e) => setSubFilter(e.target.value as SubFilterType)}
                        disabled={type === 'add'} 
                        className="w-full mt-1 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2 disabled:opacity-50"
                    >
                        <option value="all">Todos os tipos</option>
                        <option value="critical">Críticas (⚠️)</option>
                        <option value="hot">Vai Cair (🔥)</option>
                        <option value="incorrect">Que Errei (❌)</option>
                    </select>
                </div>
                 <div>
                    <label className="text-sm font-medium">Meta (unid.)</label>
                     <input type="number" value={target} onChange={e => setTarget(parseInt(e.target.value, 10))} min="1" className="w-full mt-1 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
                </div>
             </div>
             <div className="flex justify-end pt-2">
                <button type="submit" className="bg-sky-500 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-colors">Adicionar Meta</button>
             </div>
        </form>
    );
};


const GoalsView: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const questions = useQuestionState();

  const uniqueSubjects = useMemo(() => [...new Set(questions.map(q => q.subject).filter(Boolean))].sort(), [questions]);
  const uniqueTopics = useMemo(() => [...new Set(questions.map(q => q.topic).filter(Boolean))].sort(), [questions]);

  const calculateProgress = (goal: Goal): number => {
    const today = srs.todayISO();
    return questions.filter(q => {
        const dateMatch = goal.type === 'review' 
            ? q.lastAttemptDate === today 
            : q.createdAt === today;
        if (!dateMatch) return false;
        
        let filterMatch = false;
        switch (goal.filter.type) {
            case 'all': filterMatch = true; break;
            case 'subject': filterMatch = q.subject === goal.filter.value; break;
            case 'topic': filterMatch = q.topic === goal.filter.value; break;
            default: filterMatch = false;
        }
        if (!filterMatch) return false;

        if (goal.type === 'add') return true; // subfilters don't apply to 'add' goals

        let subFilterMatch = false;
        switch (goal.subFilter) {
            case 'all': subFilterMatch = true; break;
            case 'critical': subFilterMatch = q.isCritical; break;
            case 'hot': subFilterMatch = q.hotTopic; break;
            case 'incorrect': subFilterMatch = !q.lastWasCorrect && q.totalAttempts > 0; break;
            default: subFilterMatch = true; // Default to 'all' if undefined
        }
        
        return subFilterMatch;
    }).length;
  };

  const handleAddGoal = (newGoalData: Omit<Goal, 'id'>) => {
    const newGoal: Goal = {
      ...newGoalData,
      id: `goal_${Date.now()}_${Math.random()}`
    };
    updateSettings({ goals: [...settings.goals, newGoal] });
  };
  
  const handleDeleteGoal = (goalId: string) => {
    updateSettings({ goals: settings.goals.filter(g => g.id !== goalId) });
  };
  
  const handleUpdateGoalTarget = (goalId: string, newTarget: number) => {
    updateSettings({
      goals: settings.goals.map(g => (g.id === goalId ? { ...g, target: newTarget } : g))
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="text-sky-500 text-2xl"><TrophyIcon /></div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Metas Diárias</h2>
          <p className="text-bunker-500 dark:text-bunker-400">Acompanhe seu progresso e defina metas por disciplina ou tópico.</p>
        </div>
      </div>

       <div>
        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Metas Atuais</h3>
        {settings.goals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.goals.map(goal => (
                <GoalProgressCard
                key={goal.id}
                goal={goal}
                current={calculateProgress(goal)}
                onUpdateTarget={handleUpdateGoalTarget}
                onDelete={handleDeleteGoal}
                />
            ))}
            </div>
        ) : (
             <div className="text-center py-10 px-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                <p className="text-bunker-500 dark:text-bunker-400">Nenhuma meta configurada. Adicione uma abaixo!</p>
            </div>
        )}
      </div>
      
      <AddGoalForm onAddGoal={handleAddGoal} subjects={uniqueSubjects} topics={uniqueTopics} />
      
    </div>
  );
};

export default GoalsView;