import React, { useState, useMemo } from 'react';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import * as srs from '../services/srsService';
import { Question } from '../types';
import { FireIcon, ExclamationTriangleIcon, ChevronUpIcon, ChevronDownIcon } from '../components/icons';
import EditQuestionModal from '../components/EditQuestionModal';
import ConfirmationModal from '../components/ConfirmationModal';

type SortableColumn = 'questionRef' | 'subject' | 'masteryScore' | 'nextReviewDate';
interface SortConfig {
    key: SortableColumn;
    direction: 'ascending' | 'descending';
}

const ListView: React.FC = () => {
    const questions = useQuestionState();
    const { updateQuestion, updateBatchQuestions, deleteQuestions } = useQuestionDispatch();
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState('');
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'questionRef', direction: 'ascending' });
    const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
    const [isResetScheduleConfirmModalOpen, setIsResetScheduleConfirmModalOpen] = useState(false);
    const [isResetMasteryConfirmModalOpen, setIsResetMasteryConfirmModalOpen] = useState(false);

    const questionsPerPage = 15;

    const filteredAndSortedQuestions = useMemo(() => {
        let sortableItems = questions.filter(q => 
            q.questionRef.toLowerCase().includes(filter.toLowerCase()) ||
            q.subject.toLowerCase().includes(filter.toLowerCase()) ||
            q.topic.toLowerCase().includes(filter.toLowerCase())
        );

        sortableItems.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];
            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });

        return sortableItems;
    }, [questions, filter, sortConfig]);
    
    // Pagination logic
    const totalPages = Math.ceil(filteredAndSortedQuestions.length / questionsPerPage);
    const startIndex = (currentPage - 1) * questionsPerPage;
    const paginatedQuestions = filteredAndSortedQuestions.slice(startIndex, startIndex + questionsPerPage);

    const requestSort = (key: SortableColumn) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const handleSelect = (id: string) => {
        const newSelectedIds = new Set(selectedIds);
        if (newSelectedIds.has(id)) {
            newSelectedIds.delete(id);
        } else {
            newSelectedIds.add(id);
        }
        setSelectedIds(newSelectedIds);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(paginatedQuestions.map(q => q.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleToggleFlag = (id: string, flag: 'isCritical' | 'hotTopic', currentValue: boolean) => {
        const question = questions.find(q => q.id === id);
        if(question) {
            updateQuestion({ ...question, [flag]: !currentValue });
        }
    };
    
    const handleBatchReset = () => {
        if (selectedIds.size === 0) return;
        setIsResetScheduleConfirmModalOpen(true);
    };

    const handleConfirmResetSchedule = () => {
        const updates = [...selectedIds].map(id => ({
            id,
            nextReviewDate: srs.todayISO(),
            srsStage: 0,
        }));
        updateBatchQuestions(updates);
        setSelectedIds(new Set());
    };

    const handleBatchResetMastery = () => {
        if (selectedIds.size === 0) return;
        setIsResetMasteryConfirmModalOpen(true);
    };

    const handleConfirmResetMastery = () => {
        const updates = [...selectedIds].map(id => ({
            id,
            masteryScore: 0,
        }));
        updateBatchQuestions(updates);
        setSelectedIds(new Set());
    };
    
    const handleBatchDelete = () => {
        if (selectedIds.size === 0) return;
        setIsDeleteConfirmModalOpen(true);
    };

    const handleConfirmDelete = () => {
        deleteQuestions([...selectedIds]);
        setSelectedIds(new Set());
    };
    
    const handleNextPage = () => {
      if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
    };
    const handlePrevPage = () => {
      if (currentPage > 1) setCurrentPage(prev => prev + 1);
    };

    const SortableHeader: React.FC<{ columnKey: SortableColumn; title: string; className?: string; }> = ({ columnKey, title, className }) => {
        const isSorted = sortConfig.key === columnKey;
        const Icon = sortConfig.direction === 'ascending' ? ChevronUpIcon : ChevronDownIcon;
        return (
            <th className={`p-3 ${className}`}>
                <button onClick={() => requestSort(columnKey)} className="flex items-center gap-1 group transition-colors w-full">
                    <span className="group-hover:text-bunker-700 dark:group-hover:text-bunker-200">{title}</span>
                    {isSorted && <span className="text-sky-500"><Icon /></span>}
                </button>
            </th>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Listar Todas as Questões</h2>
                <p className="text-bunker-500 dark:text-bunker-400">Gerencie todas as suas questões registradas.</p>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                <input
                    type="text"
                    placeholder="Filtrar por ID, disciplina ou tópico..."
                    value={filter}
                    onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full md:w-1/3 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"
                />
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button onClick={handleBatchResetMastery} disabled={selectedIds.size === 0} className="text-sm font-semibold px-4 py-2 bg-orange-100 text-orange-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-200 transition-colors dark:bg-orange-900/50 dark:text-orange-300 dark:hover:bg-orange-900/80">Resetar Domínio</button>
                    <button onClick={handleBatchReset} disabled={selectedIds.size === 0} className="text-sm font-semibold px-4 py-2 bg-orange-100 text-orange-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-200 transition-colors dark:bg-orange-900/50 dark:text-orange-300 dark:hover:bg-orange-900/80">Resetar Agendamento</button>
                    <button onClick={handleBatchDelete} disabled={selectedIds.size === 0} className="text-sm font-semibold px-4 py-2 bg-rose-100 text-rose-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-200 transition-colors dark:bg-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-900/80">Excluir</button>
                </div>
            </div>
            
            <div className="overflow-x-auto bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-bunker-500 dark:text-bunker-400 uppercase bg-bunker-200 dark:bg-bunker-800">
                        <tr>
                            <th className="p-3"><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size === paginatedQuestions.length && paginatedQuestions.length > 0} /></th>
                            <SortableHeader columnKey="questionRef" title="Identificação" />
                            <SortableHeader columnKey="subject" title="Disciplina" />
                            <SortableHeader columnKey="masteryScore" title="Domínio" className="text-center" />
                            <SortableHeader columnKey="nextReviewDate" title="Próxima Revisão" className="text-center" />
                            <th className="p-3 text-center" title="Crítica">⚠️</th>
                            <th className="p-3 text-center" title="Vai Cair na Prova">🔥</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bunker-200 dark:divide-bunker-800">
                        {paginatedQuestions.map(q => (
                            <tr key={q.id} className="hover:bg-bunker-200/50 dark:hover:bg-bunker-800/50 cursor-pointer" onClick={() => setEditingQuestion(q)}>
                                <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(q.id)} onChange={() => handleSelect(q.id)} /></td>
                                <td className="p-3 font-medium">{q.questionRef}</td>
                                <td className="p-3 text-bunker-600 dark:text-bunker-300">{q.subject}</td>
                                <td className="p-3 text-center font-semibold">{q.masteryScore.toFixed(0)}%</td>
                                <td className="p-3 text-center">{srs.formatISOToBr(q.nextReviewDate)}</td>
                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => handleToggleFlag(q.id, 'isCritical', q.isCritical)} className={`p-1 rounded-full ${q.isCritical ? 'text-yellow-500' : 'text-bunker-400 dark:text-bunker-600 hover:text-yellow-500'}`}><ExclamationTriangleIcon /></button>
                                </td>
                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => handleToggleFlag(q.id, 'hotTopic', q.hotTopic)} className={`p-1 rounded-full ${q.hotTopic ? 'text-amber-500' : 'text-bunker-400 dark:text-bunker-600 hover:text-amber-500'}`}><FireIcon /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                <button onClick={handlePrevPage} disabled={currentPage === 1} className="px-4 py-2 bg-bunker-200 dark:bg-bunker-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Anterior</button>
                <span className="text-sm font-medium text-bunker-600 dark:text-bunker-300">Página {currentPage} de {totalPages}</span>
                <button onClick={handleNextPage} disabled={currentPage === totalPages} className="px-4 py-2 bg-bunker-200 dark:bg-bunker-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Próxima</button>
                </div>
            )}
            {editingQuestion && (
                <EditQuestionModal
                    question={editingQuestion}
                    onClose={() => setEditingQuestion(null)}
                />
            )}
            <ConfirmationModal
                isOpen={isDeleteConfirmModalOpen}
                onClose={() => setIsDeleteConfirmModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title={`Excluir ${selectedIds.size} questão(ões)?`}
            >
                <p>
                    Você está prestes a excluir permanentemente <strong>{selectedIds.size} questão(ões)</strong>.
                </p>
                <p className="font-bold mt-4">
                    Esta ação é irreversível. Deseja continuar?
                </p>
            </ConfirmationModal>
            <ConfirmationModal
                isOpen={isResetScheduleConfirmModalOpen}
                onClose={() => setIsResetScheduleConfirmModalOpen(false)}
                onConfirm={handleConfirmResetSchedule}
                title={`Resetar agendamento de ${selectedIds.size} questão(ões)?`}
            >
                <p>
                    As questões selecionadas voltarão para o início da fila de revisão e deverão ser revistas hoje.
                </p>
                <p className="font-bold mt-4">
                    Esta ação não pode ser desfeita. Deseja continuar?
                </p>
            </ConfirmationModal>
            <ConfirmationModal
                isOpen={isResetMasteryConfirmModalOpen}
                onClose={() => setIsResetMasteryConfirmModalOpen(false)}
                onConfirm={handleConfirmResetMastery}
                title={`Zerar domínio de ${selectedIds.size} questão(ões)?`}
            >
                <p>
                    O score de maestria das questões selecionadas será redefinido para <strong>0%</strong>.
                </p>
                <p className="font-bold mt-4">
                    Esta ação não pode ser desfeita. Deseja continuar?
                </p>
            </ConfirmationModal>
        </div>
    );
};

export default ListView;