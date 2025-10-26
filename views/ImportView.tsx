import React, { useState } from 'react';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import { Question, TabID } from '../types';
import { DownloadIcon } from '../components/icons';

interface ImportViewProps {
  setActiveTab: (tab: TabID) => void;
}

interface ParsedRow {
  dateAttempt: string; bank: string; position: string; subject: string; topic: string;
  questionRef: string; questionText: string;
  altA: string; altB: string; altC: string; altD: string; altE: string;
  explanation: string; yourAnswer: string; correctAnswer: string;
  isCorrect: boolean; timeSec: number; selfEvalLevel: number; hotTopic: boolean;
}

const ImportView: React.FC<ImportViewProps> = ({ setActiveTab }) => {
  const questions = useQuestionState();
  const { addBatchQuestions } = useQuestionDispatch();
  const { settings } = useSettings();
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<{lineNumber: number, line: string, error: string}[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawText(text);
        processText(text);
      };
      reader.readAsText(file);
    }
  };
  
  const processText = (text: string) => {
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
    const parsedData: ParsedRow[] = [];
    const errorData: {lineNumber: number, line: string, error: string}[] = [];

    lines.forEach((line, idx) => {
        if(idx === 0 && line.toUpperCase().startsWith("DATE;BANK;POSITION")) return;
        const p=line.split(";");
        if (p.length !== 19) { errorData.push({lineNumber:idx+1,line,error:"Esperado 19 colunas"}); return; }
        const [date,bank,position,subject,topic,qRef,qText,aA,aB,aC,aD,aE,expl,yAns,cAns,isCorr,time,lvl,hot] = p;
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date||"")){ errorData.push({lineNumber:idx+1,line,error:"Data inválida (AAAA-MM-DD)"}); return; }
        
        parsedData.push({
          dateAttempt: date.trim(), bank: bank.trim(), position: position.trim(), subject: subject.trim(), topic: topic.trim(),
          questionRef: qRef.trim(), questionText: (qText||"").trim(),
          altA:(aA||"").trim(), altB:(aB||"").trim(), altC:(aC||"").trim(), altD:(aD||"").trim(), altE:(aE||"").trim(),
          explanation:(expl||"").trim(), yourAnswer:(yAns||"").trim().toUpperCase(), correctAnswer:(cAns||"").trim().toUpperCase(),
          isCorrect: isCorr.trim() === "0", // 0 is correct in file
          timeSec: Number(time), selfEvalLevel: Number(lvl), hotTopic: hot.trim() === "1"
        });
    });

    setParsed(parsedData);
    setErrors(errorData);
  };

  const handleImport = () => {
    if (errors.length > 0 || parsed.length === 0) {
        alert("Corrija os erros no arquivo ou selecione um arquivo válido antes de importar.");
        return;
    }

    const existingRefs = new Set(questions.map(q => q.questionRef.trim().toLowerCase()));
    const uniqueParsedRows: ParsedRow[] = [];
    const duplicates: ParsedRow[] = [];
    const refsInFile = new Set<string>();

    parsed.forEach(p => {
        const normalizedRef = p.questionRef.trim().toLowerCase();
        if (existingRefs.has(normalizedRef) || refsInFile.has(normalizedRef)) {
            duplicates.push(p);
        } else {
            uniqueParsedRows.push(p);
            refsInFile.add(normalizedRef);
        }
    });

    const newQuestions: Omit<Question, 'id'>[] = uniqueParsedRows.map(p => {
        const mastery = p.isCorrect ? 70 : 40;
        const { srsStage, nextReviewDate } = srs.getInitialSrsState(p.isCorrect, settings.srsIntervals);
        
        return {
            bank: p.bank, position: p.position, subject: p.subject, topic: p.topic, questionRef: p.questionRef, questionText: p.questionText,
            options: { A: p.altA, B: p.altB, C: p.altC, D: p.altD, E: p.altE },
            explanation: p.explanation, 
            comments: '', // Initialize comments for imported questions
            yourAnswer: p.yourAnswer, correctAnswer: p.correctAnswer,
            lastAttemptDate: p.dateAttempt, totalAttempts: 1, lastWasCorrect: p.isCorrect,
            timeSec: p.timeSec, selfEvalLevel: p.selfEvalLevel, masteryScore: mastery,
            nextReviewDate: nextReviewDate!, hotTopic: p.hotTopic, willFallExam: false,
            srsStage: srsStage!, 
            correctStreak: p.isCorrect ? 1 : 0,
            isCritical: false, createdAt: p.dateAttempt,
        };
    });
    
    if (newQuestions.length > 0) {
      addBatchQuestions(newQuestions);
    }

    let alertMessage = '';
    if (newQuestions.length > 0) {
        alertMessage += `${newQuestions.length} questão(ões) importada(s) com sucesso!`;
    }
    if (duplicates.length > 0) {
        if (alertMessage) alertMessage += '\n';
        alertMessage += `${duplicates.length} duplicata(s) foram ignoradas.`;
    }
    if (!alertMessage) {
        alertMessage = 'Nenhuma nova questão para importar (todas as encontradas já existem).';
    }
    alert(alertMessage);
    
    setRawText('');
    setParsed([]);
    setErrors([]);
    
    if (newQuestions.length > 0) {
        setActiveTab('today');
    }
  };

  const handleExport = () => {
    if (questions.length === 0) {
      alert("Nenhuma questão para exportar.");
      return;
    }

    const header = "DATE;BANK;POSITION;SUBJECT;TOPIC;QUESTION_REF;QUESTION_TEXT;ALT_A;ALT_B;ALT_C;ALT_D;ALT_E;EXPLANATION;YOUR_ANSWER;CORRECT_ANSWER;ISCORRECT;TIME_SEC;LEVEL;HOT_TOPIC";

    const sanitize = (str: string | undefined | null): string => {
        if (str === null || str === undefined) return '';
        return String(str).replace(/;/g, ',').replace(/\r?\n/g, ' ');
    };

    const rows = questions.map(q => [
        sanitize(q.lastAttemptDate),
        sanitize(q.bank),
        sanitize(q.position),
        sanitize(q.subject),
        sanitize(q.topic),
        sanitize(q.questionRef),
        sanitize(q.questionText),
        sanitize(q.options.A),
        sanitize(q.options.B),
        sanitize(q.options.C),
        sanitize(q.options.D),
        sanitize(q.options.E),
        sanitize(q.explanation),
        sanitize(q.yourAnswer),
        sanitize(q.correctAnswer),
        q.lastWasCorrect ? "0" : "1",
        q.timeSec,
        q.selfEvalLevel,
        q.hotTopic ? "1" : "0",
    ].join(';'));

    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const today = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `revisao_questoes_export_${today}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const formatExample = `DATE;BANK;POSITION;SUBJECT;TOPIC;QUESTION_REF;QUESTION_TEXT;ALT_A;ALT_B;ALT_C;ALT_D;ALT_E;EXPLANATION;YOUR_ANSWER;CORRECT_ANSWER;ISCORRECT;TIME_SEC;LEVEL;HOT_TOPIC
2025-10-25;FCC;Analista TI;Scrum;Daily Scrum;Q5 Daily;"O propósito da Daily é:";"Relatório...";"Inspecionar...";"...";"...";"...";"Inspecionar progresso";B;B;0;60;0;1`;


  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Importar & Exportar Dados</h2>
        <p className="text-bunker-500 dark:text-bunker-400">Adicione questões em lote via arquivo ou exporte seus dados atuais.</p>
      </div>

       <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
            <h3 className="font-bold text-lg">Exportar Todas as Questões</h3>
            <p className="text-sm text-bunker-500 dark:text-bunker-400">Salve um backup de todas as suas {questions.length} questões em um arquivo de texto (.txt).</p>
        </div>
        <button 
            onClick={handleExport}
            disabled={questions.length === 0}
            className="flex items-center gap-2 bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-emerald-600 transition-colors disabled:bg-bunker-300 dark:disabled:bg-bunker-700 disabled:cursor-not-allowed"
        >
            <DownloadIcon />
            <span>Exportar Dados</span>
        </button>
    </div>

      <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
        <h3 className="font-bold text-lg mb-2">Importar Questões</h3>
        <p className="text-sm text-bunker-500 dark:text-bunker-400 mb-4">Envie um arquivo .txt com uma questão por linha para adicionar várias de uma vez. Use o formato abaixo:</p>
        <pre className="text-xs p-4 bg-bunker-50 dark:bg-bunker-800 rounded-md overflow-x-auto">
          <code>{formatExample}</code>
        </pre>
        <p className="text-xs mt-2 text-bunker-500 dark:text-bunker-400">Campos: ISCORRECT = 0 (acertou) / 1 (errou) • LEVEL=0..3 • HOT_TOPIC=0/1</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
           <h3 className="font-bold text-lg">1. Enviar Arquivo para Importar</h3>
           <input type="file" accept=".txt" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"/>
           <div className="p-4 bg-bunker-100 dark:bg-bunker-900 rounded-lg h-64 overflow-auto">
                <pre className="text-xs whitespace-pre-wrap">{rawText || 'Conteúdo do arquivo aparecerá aqui...'}</pre>
           </div>
        </div>
        <div className="space-y-4">
            <h3 className="font-bold text-lg">2. Validar e Importar</h3>
            <div className="p-4 bg-bunker-100 dark:bg-bunker-900 rounded-lg h-64 overflow-auto">
                {errors.length > 0 && (
                    <div className="text-red-500">
                        <h4 className="font-bold mb-2">{errors.length} Erro(s) Encontrado(s):</h4>
                        <ul className="list-disc list-inside space-y-2 text-sm">
                            {errors.slice(0,5).map(err => <li key={err.lineNumber}>Linha {err.lineNumber}: {err.error}</li>)}
                        </ul>
                        {errors.length > 5 && <p className="text-xs mt-2">...e mais {errors.length - 5} erro(s).</p>}
                    </div>
                )}
                 {errors.length === 0 && parsed.length > 0 && (
                    <div className="text-emerald-500">
                        <h4 className="font-bold mb-2">✅ Validação OK!</h4>
                        <p>{parsed.length} questões prontas para importar.</p>
                    </div>
                 )}
                 {errors.length === 0 && parsed.length === 0 && rawText && (
                    <p className="text-bunker-500 dark:text-bunker-400">Nenhuma questão válida encontrada.</p>
                 )}
                 {!rawText && (
                    <p className="text-bunker-500 dark:text-bunker-400">Aguardando arquivo...</p>
                 )}
            </div>
            <button onClick={handleImport} disabled={errors.length > 0 || parsed.length === 0} className="w-full bg-sky-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-colors disabled:bg-bunker-300 dark:disabled:bg-bunker-700 disabled:cursor-not-allowed">
                Importar {parsed.length > 0 ? `(${parsed.length})` : ''}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ImportView;