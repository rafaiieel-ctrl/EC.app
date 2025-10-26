import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import { Question } from '../types';
import { useForceGraph } from '../hooks/useForceGraph';
import InteractiveQuestionModal from '../components/InteractiveQuestionModal';
import StudySessionModal from '../components/StudySessionModal';
import { ZoomInIcon, ZoomOutIcon, ResetZoomIcon, GraphIcon, OrbitIcon } from '../components/icons';

type LayoutMode = 'graph' | 'orbit';

// Define node types and their visual properties
const NODE_STYLE = {
  SUBJECT: { radius: 14, color: 'rgb(56, 189, 248)', textColor: 'white' },
  TOPIC: { radius: 10, color: 'rgb(52, 211, 153)', textColor: 'white' },
  QUESTION: { radius: 5, color: 'rgb(156, 163, 175)', textColor: 'rgb(220,220,220)' },
  QUESTION_HOT: { radius: 7, color: 'rgb(250, 204, 21)', textColor: 'rgb(240,240,240)' },
  WEAK_BORDER: 'rgba(239, 68, 68, 0.8)',
};

const Legend: React.FC = () => (
  <div className="absolute bottom-4 right-4 bg-bunker-950/80 backdrop-blur-sm p-4 rounded-lg border border-bunker-800 text-xs text-bunker-300 space-y-2 pointer-events-none">
    <h4 className="font-bold text-sm text-white mb-2">Legenda</h4>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_STYLE.SUBJECT.color }}></div>
      <span>Disciplina</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_STYLE.TOPIC.color }}></div>
      <span>Tópico</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_STYLE.QUESTION_HOT.color }}></div>
      <span>Questão "Vai Cair"</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_STYLE.QUESTION.color }}></div>
      <span>Questão Comum</span>
    </div>
     <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: NODE_STYLE.WEAK_BORDER, backgroundColor: NODE_STYLE.QUESTION.color }}></div>
      <span>Domínio Baixo (&lt;40%)</span>
    </div>
  </div>
);

type MasteryZone = 'critical' | 'attention' | 'safe';

const OrbitalSummary: React.FC<{ 
  questions: Question[];
  onZoneClick: (zone: MasteryZone) => void;
}> = ({ questions, onZoneClick }) => {
  const summary = useMemo(() => {
    const zones = {
      critical: 0, // Mastery < 40
      attention: 0, // Mastery 40-79
      safe: 0,      // Mastery >= 80
    };
    questions.forEach(q => {
      if (q.masteryScore < 40) zones.critical++;
      else if (q.masteryScore < 80) zones.attention++;
      else zones.safe++;
    });
    return zones;
  }, [questions]);
  
  const ZoneButton: React.FC<{
    zone: MasteryZone;
    label: string;
    colorClass: string;
    count: number;
  }> = ({ zone, label, colorClass, count }) => (
     <button 
        onClick={() => count > 0 && onZoneClick(zone)} 
        disabled={count === 0}
        className="w-full flex justify-between items-center p-2 rounded-md transition-colors pointer-events-auto hover:bg-bunker-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`}></div>{label}
        </span> 
        <span className="font-bold">{count}</span>
      </button>
  );

  return (
    <div className="absolute bottom-4 left-4 bg-bunker-950/80 backdrop-blur-sm p-4 rounded-lg border border-bunker-800 text-xs text-bunker-300 space-y-2 pointer-events-none">
      <h4 className="font-bold text-sm text-white mb-2">Resumo Orbital</h4>
      <ZoneButton zone="critical" label="Zona Crítica" colorClass="bg-red-500" count={summary.critical} />
      <ZoneButton zone="attention" label="Zona de Atenção" colorClass="bg-amber-500" count={summary.attention} />
      <ZoneButton zone="safe" label="Zona Segura" colorClass="bg-emerald-500" count={summary.safe} />
    </div>
  );
};


const MapView: React.FC = () => {
  const questions = useQuestionState();
  const { updateQuestion } = useQuestionDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('graph');
  const [filterNode, setFilterNode] = useState<any | null>(null);
  
  const [weakestPathNode, setWeakestPathNode] = useState<any | null>(null);
  const [hoveredGroupNode, setHoveredGroupNode] = useState<any | null>(null);

  const [studyModalOpen, setStudyModalOpen] = useState(false);
  const [studyModalQuestions, setStudyModalQuestions] = useState<Question[]>([]);
  const [studyModalTitle, setStudyModalTitle] = useState('');

  const handleNodeHover = useCallback((node: any | null) => {
    if (node && (node.type === 'subject' || node.type === 'topic')) {
        setHoveredGroupNode(node);
    } else {
        setHoveredGroupNode(null);
    }
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    let resizeTimer: number;
    const handleResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(updateDimensions, 100);
    };

    updateDimensions();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { nodes, links } = useMemo(() => {
    const subjectNodes = new Map();
    const topicNodes = new Map();
    const questionNodes: any[] = [];
    const linkSet = new Set<string>();
    const finalLinks: { source: string; target: string }[] = [];

    const subjectData = new Map<string, { masterySum: number; questionCount: number }>();
    const topicData = new Map<string, { masterySum: number; questionCount: number }>();

    questions.forEach(q => {
        if (q.subject) {
            if (!subjectData.has(q.subject)) subjectData.set(q.subject, { masterySum: 0, questionCount: 0 });
            const subj = subjectData.get(q.subject)!;
            subj.masterySum += q.masteryScore;
            subj.questionCount++;
        }
        if (q.topic) {
            if (!topicData.has(q.topic)) topicData.set(q.topic, { masterySum: 0, questionCount: 0 });
            const top = topicData.get(q.topic)!;
            top.masterySum += q.masteryScore;
            top.questionCount++;
        }
    });
    
    const getMasteryBasedColor = (mastery: number, type: 'subject' | 'topic') => {
        if (type === 'subject') {
            const saturation = 40 + (mastery / 100) * 55; // Saturation from 40% to 95%
            return `hsl(202, ${saturation}%, 60%)`;
        }
        const saturation = 40 + (mastery / 100) * 40; // Saturation from 40% to 80%
        return `hsl(155, ${saturation}%, 52%)`;
    };

    questions.forEach(q => {
      const subjectId = `subject-${q.subject}`;
      if (q.subject && !subjectNodes.has(subjectId)) {
        const data = subjectData.get(q.subject)!;
        const avgMastery = data.questionCount > 0 ? data.masterySum / data.questionCount : 50;
        subjectNodes.set(subjectId, { 
            id: subjectId, 
            label: q.subject, 
            type: 'subject', 
            ...NODE_STYLE.SUBJECT, 
            radius: 12 + Math.min(Math.log2(data.questionCount + 1) * 2.5, 10),
            color: getMasteryBasedColor(avgMastery, 'subject'),
            masteryScore: avgMastery,
            questionCount: data.questionCount,
        });
      }

      const topicId = `topic-${q.subject}-${q.topic}`;
      if (q.topic && !topicNodes.has(topicId)) {
        const data = topicData.get(q.topic)!;
        const avgMastery = data.questionCount > 0 ? data.masterySum / data.questionCount : 50;
        topicNodes.set(topicId, { 
            id: topicId, 
            label: q.topic, 
            type: 'topic', 
            ...NODE_STYLE.TOPIC, 
            radius: 8 + Math.min(Math.log2(data.questionCount + 1) * 2, 8),
            color: getMasteryBasedColor(avgMastery, 'topic'),
            masteryScore: avgMastery,
            questionCount: data.questionCount,
        });
        const linkId = `${subjectId}-${topicId}`;
        if (subjectId && !linkSet.has(linkId)) {
            finalLinks.push({ source: subjectId, target: topicId });
            linkSet.add(linkId);
        }
      }
      
      const isHot = q.hotTopic;
      const isWeak = q.masteryScore < 40;

      questionNodes.push({
        id: q.id,
        label: q.questionRef,
        type: 'question',
        ...(isHot ? NODE_STYLE.QUESTION_HOT : NODE_STYLE.QUESTION),
        borderColor: isWeak ? NODE_STYLE.WEAK_BORDER : undefined,
        masteryScore: q.masteryScore,
        data: q,
      });

      const qLinkId = `${topicId}-${q.id}`;
      if (topicId && !linkSet.has(qLinkId)) {
          finalLinks.push({ source: topicId, target: q.id });
          linkSet.add(qLinkId);
      }
    });

    const allNodes = [...subjectNodes.values(), ...topicNodes.values(), ...questionNodes];
    const allLinks = finalLinks;

    if (!filterNode) {
      return { nodes: allNodes, links: allLinks };
    }

    const childrenMap = new Map<string, string[]>();
    allLinks.forEach(link => {
      if (!childrenMap.has(link.source)) {
        childrenMap.set(link.source, []);
      }
      childrenMap.get(link.source)!.push(link.target);
    });

    const visibleNodeIds = new Set<string>();
    const queue = [filterNode.id];
    visibleNodeIds.add(filterNode.id);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = childrenMap.get(currentId) || [];
      for (const childId of children) {
        if (!visibleNodeIds.has(childId)) {
          visibleNodeIds.add(childId);
          queue.push(childId);
        }
      }
    }

    const filteredNodes = allNodes.filter(n => visibleNodeIds.has(n.id));
    const filteredLinks = allLinks.filter(l => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target));

    return { nodes: filteredNodes, links: filteredLinks };
  }, [questions, filterNode]);
  
  const handleNodeClick = useCallback((node: any | null) => {
    if (weakestPathNode) return; // Disable clicks in path mode

    if (node) {
        if (node.type === 'question') {
            setSelectedQuestion(node.data);
        } else if (node.type === 'subject' || node.type === 'topic') {
            if (filterNode?.id === node.id) {
                setFilterNode(null);
            } else {
                setFilterNode(node);
            }
        }
    } else {
        setFilterNode(null);
    }
  }, [filterNode, weakestPathNode]);

  const handleQuestionAnswered = (updatedQuestion: Question) => {
    updateQuestion(updatedQuestion);
    setSelectedQuestion(null);
  };

  const handleZoneClick = (zone: MasteryZone) => {
    const titleMap = {
        critical: 'Sessão: Zona Crítica',
        attention: 'Sessão: Zona de Atenção',
        safe: 'Sessão: Zona Segura'
    };
    const filteredQuestions = questions.filter(q => {
        if (zone === 'critical') return q.masteryScore < 40;
        if (zone === 'attention') return q.masteryScore >= 40 && q.masteryScore < 80;
        if (zone === 'safe') return q.masteryScore >= 80;
        return false;
    });

    if (filteredQuestions.length > 0) {
        setStudyModalQuestions(filteredQuestions);
        setStudyModalTitle(titleMap[zone]);
        setStudyModalOpen(true);
    }
  };


  const { canvasRef, zoomIn, zoomOut, resetView } = useForceGraph(
    nodes,
    links,
    dimensions,
    handleNodeClick,
    layoutMode,
    weakestPathNode,
    handleNodeHover
  );

  useEffect(() => {
    const timer = setTimeout(() => {
        resetView();
    }, 100);
    return () => clearTimeout(timer);
  }, [filterNode, resetView, weakestPathNode]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[75vh] bg-bunker-950 rounded-lg relative overflow-hidden shadow-2xl shadow-bunker-950/50" 
      style={{background: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%)'}}
    >
      <canvas 
        ref={canvasRef} 
        width={dimensions.width} 
        height={dimensions.height}
      />
      <Legend />

      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <button onClick={zoomIn} className="p-2 bg-bunker-950/80 backdrop-blur-sm rounded-lg border border-bunker-800 text-bunker-300 hover:text-white hover:border-bunker-700 transition-colors" aria-label="Zoom In"><ZoomInIcon /></button>
        <button onClick={zoomOut} className="p-2 bg-bunker-950/80 backdrop-blur-sm rounded-lg border border-bunker-800 text-bunker-300 hover:text-white hover:border-bunker-700 transition-colors" aria-label="Zoom Out"><ZoomOutIcon /></button>
        <button onClick={resetView} className="p-2 bg-bunker-950/80 backdrop-blur-sm rounded-lg border border-bunker-800 text-bunker-300 hover:text-white hover:border-bunker-700 transition-colors" aria-label="Reset View"><ResetZoomIcon /></button>
      </div>
      
      {filterNode && !weakestPathNode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-bunker-950/80 backdrop-blur-sm p-2 px-4 rounded-lg border border-bunker-800 text-sm text-bunker-300 flex items-center gap-3 animate-fade-in">
            <span>Filtrando por: <strong>{filterNode.label}</strong></span>
            <button onClick={() => setFilterNode(null)} className="font-bold text-lg leading-none hover:text-white">&times;</button>
        </div>
      )}

      {hoveredGroupNode && !weakestPathNode && !filterNode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bunker-950/80 backdrop-blur-sm p-4 rounded-lg border border-bunker-800 text-center animate-fade-in pointer-events-auto">
            <p className="font-bold text-white mb-2">Analisar {hoveredGroupNode.label}</p>
            <button 
                onClick={() => setWeakestPathNode(hoveredGroupNode)}
                className="px-4 py-2 text-sm font-semibold bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
            >
                Ver Caminho de Aprendizagem
            </button>
        </div>
      )}

      {weakestPathNode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-bunker-950/80 backdrop-blur-sm p-2 px-4 rounded-lg border border-bunker-800 text-sm text-bunker-300 flex items-center gap-3 animate-fade-in">
            <span>Modo Caminho de Aprendizagem: <strong>{weakestPathNode.label}</strong></span>
            <button onClick={() => { setWeakestPathNode(null); setHoveredGroupNode(null); }} className="font-bold text-lg leading-none hover:text-white">&times;</button>
        </div>
      )}

      {layoutMode === 'orbit' && (
        <OrbitalSummary 
            questions={questions} 
            onZoneClick={handleZoneClick}
        />
      )}

      <div className="absolute top-4 right-4 flex items-center gap-1 p-1 bg-bunker-950/80 backdrop-blur-sm rounded-lg border border-bunker-800">
        <button 
            onClick={() => setLayoutMode('graph')} 
            className={`p-2 rounded-md transition-colors ${layoutMode === 'graph' ? 'text-sky-400 bg-sky-500/10' : 'text-bunker-400 hover:text-white'}`}
            aria-label="Graph View"
            title="Graph View"
        >
            <GraphIcon />
        </button>
        <button 
            onClick={() => setLayoutMode('orbit')} 
            className={`p-2 rounded-md transition-colors ${layoutMode === 'orbit' ? 'text-sky-400 bg-sky-500/10' : 'text-bunker-400 hover:text-white'}`}
            aria-label="Orbital View"
            title="Orbital View"
        >
            <OrbitIcon />
        </button>
      </div>

      {selectedQuestion && (
        <InteractiveQuestionModal
            question={selectedQuestion}
            onClose={() => setSelectedQuestion(null)}
            onQuestionAnswered={handleQuestionAnswered}
        />
      )}

      {studyModalOpen && (
        <StudySessionModal
          isOpen={studyModalOpen}
          onClose={() => setStudyModalOpen(false)}
          questions={studyModalQuestions}
          title={studyModalTitle}
        />
      )}
    </div>
  );
};

export default MapView;