import { useEffect, useRef, useMemo, useCallback } from 'react';
import * as srs from '../services/srsService';

// Tuned Simulation Parameters for a calmer graph
const REPULSION_STRENGTH = -150;
const LINK_STRENGTH = 0.06;
const LINK_DISTANCE = 70;
const CENTER_STRENGTH = 0.01;
const DAMPING = 0.9; // Stronger damping for faster settling
const ENERGY_THRESHOLD = 0.005; // Threshold to consider the simulation stable

interface Node {
  id: string;
  radius: number;
  color: string;
  borderColor?: string;
  label: string;
  masteryScore?: number;
  [key: string]: any;
}
interface Link {
  source: string;
  target:string;
}
interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
type NodePositions = Record<string, NodePosition>;
type LayoutMode = 'graph' | 'orbit';

export const useForceGraph = (
  nodes: Node[],
  links: Link[],
  dimensions: { width: number; height: number },
  onNodeClick: (node: Node | null) => void,
  layoutMode: LayoutMode,
  weakestPathNode: Node | null,
  onNodeHover: (node: Node | null) => void,
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodePositions = useRef<NodePositions>({});
  
  const animationFrameId = useRef<number | null>(null);
  const lineDashOffset = useRef(0);
  const hoveredNode = useRef<Node | null>(null);
  const draggedNode = useRef<Node | null>(null);
  const transform = useRef({ k: 1, x: 0, y: 0 });
  const isStable = useRef(layoutMode === 'orbit');
  const orbitCenteringDone = useRef(true);

  const dragStartPos = useRef({ x: 0, y: 0 });
  const isDraggingNode = useRef(false);
  const isPanning = useRef(false);
  
  const targetTransform = useRef<null | { k: number; x: number; y: number }>(null);

  const { neighbors, parentMap, childrenMap } = useMemo(() => {
    const neighborMap = new Map<string, Set<string>>();
    const pMap = new Map<string, string>();
    const cMap = new Map<string, string[]>();

    if (nodes.length === 0) return { neighbors: neighborMap, parentMap: pMap, childrenMap: cMap };
    
    nodes.forEach(node => {
        neighborMap.set(node.id, new Set<string>());
        cMap.set(node.id, []);
    });

    links.forEach(link => {
      neighborMap.get(link.source)?.add(link.target);
      neighborMap.get(link.target)?.add(link.source);
      pMap.set(link.target, link.source);
      cMap.get(link.source)?.push(link.target);
    });
    return { neighbors: neighborMap, parentMap: pMap, childrenMap: cMap };
  }, [nodes, links]);

  const { weakestPathNodes, weakestPathLinks, pathNodeIds } = useMemo(() => {
    if (!weakestPathNode) return { weakestPathNodes: [], weakestPathLinks: [], pathNodeIds: new Set<string>() };
    
    const allDescendants = new Set<string>();
    const queue = [weakestPathNode.id];
    while (queue.length > 0) {
        const currentId = queue.shift()!;
        allDescendants.add(currentId);
        const children = childrenMap.get(currentId) || [];
        children.forEach(childId => queue.push(childId));
    }
    
    const questionsOnPath = nodes.filter(n => n.type === 'question' && allDescendants.has(n.id));
    const sortedQuestions = questionsOnPath.sort((a, b) => (a.masteryScore ?? 0) - (b.masteryScore ?? 0));
    
    const pathLinks = [];
    for (let i = 0; i < sortedQuestions.length - 1; i++) {
        pathLinks.push({ source: sortedQuestions[i].id, target: sortedQuestions[i+1].id });
    }
    
    const pathIds = new Set(sortedQuestions.map(n => n.id));
    pathIds.add(weakestPathNode.id);
    if (weakestPathNode.type === 'subject') {
        const topicChildren = childrenMap.get(weakestPathNode.id) || [];
        topicChildren.forEach(topicId => pathIds.add(topicId));
    }

    return { weakestPathNodes: sortedQuestions, weakestPathLinks: pathLinks, pathNodeIds: pathIds };
  }, [weakestPathNode, nodes, childrenMap]);

  useEffect(() => {
    const newPositions: NodePositions = {};
    nodes.forEach(node => {
        const existing = nodePositions.current[node.id];
        newPositions[node.id] = existing || {
            x: dimensions.width / 2 + (Math.random() - 0.5) * 100,
            y: dimensions.height / 2 + (Math.random() - 0.5) * 100,
            vx: 0,
            vy: 0,
        };
    });
    nodePositions.current = newPositions;
  }, [nodes, dimensions.width, dimensions.height]);

  useEffect(() => {
    if (layoutMode === 'graph' && !weakestPathNode) {
        isStable.current = false;
        Object.values(nodePositions.current).forEach(pos => {
            pos.vx += (Math.random() - 0.5);
            pos.vy += (Math.random() - 0.5);
        });
    }
  }, [layoutMode, weakestPathNode]);

  useEffect(() => {
    if (layoutMode === 'orbit') {
      orbitCenteringDone.current = false;
    }
  }, [layoutMode]);

  const runGraphSimulation = () => {
    if (isStable.current && !draggedNode.current) return;

    const positions = nodePositions.current;
    let totalEnergy = 0;

    nodes.forEach(nodeA => {
      const posA = positions[nodeA.id];
      if (!posA) return;
      
      posA.vx += (dimensions.width / 2 - posA.x) * CENTER_STRENGTH;
      posA.vy += (dimensions.height / 2 - posA.y) * CENTER_STRENGTH;

      nodes.forEach(nodeB => {
        if (nodeA.id === nodeB.id) return;
        const posB = positions[nodeB.id];
        if (!posB) return;
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION_STRENGTH / (distance * distance);
        posA.vx += (dx / distance) * force;
        posA.vy += (dy / distance) * force;
      });
    });
    
    links.forEach(link => {
      const source = positions[link.source];
      const target = positions[link.target];
      if (!source || !target) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx*dx + dy*dy) || 1;
      const force = (distance - LINK_DISTANCE) * LINK_STRENGTH;
      const fx = (dx/distance) * force;
      const fy = (dy/distance) * force;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    });

    nodes.forEach(node => {
      const pos = positions[node.id];
      if (!pos || draggedNode.current?.id === node.id) return;
      pos.vx *= DAMPING;
      pos.vy *= DAMPING;
      pos.x += pos.vx;
      pos.y += pos.vy;
      totalEnergy += pos.vx * pos.vx + pos.vy * pos.vy;
    });

    if (!draggedNode.current && totalEnergy < ENERGY_THRESHOLD) {
      isStable.current = true;
    }
  };

  const runOrbitLayout = useCallback(() => {
    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusX = (width / 2) * 0.9;
    const radiusY = (height / 2) * 0.9;
    
    const subjectAngles = new Map<string, number>();
    const subjects = nodes.filter(n => n.type === 'subject');
    subjects.forEach((subj, i) => {
        subjectAngles.set(subj.id, (i / subjects.length) * 2 * Math.PI);
    });

    const getRootSubjectId = (nodeId: string): string | undefined => {
        let currentId = nodeId;
        for (let i = 0; i < 5; i++) {
            if (currentId.startsWith('subject-')) return currentId;
            const parentId = parentMap.get(currentId);
            if (!parentId) return undefined;
            currentId = parentId;
        }
        return undefined;
    };
    
    let totalEnergy = 0;
    nodes.forEach(node => {
        const pos = nodePositions.current[node.id];
        if (!pos || draggedNode.current?.id === node.id) return;
        
        const mastery = node.masteryScore ?? 50;
        const radiusFactor = (1 - mastery / 105);

        const rootSubjectId = getRootSubjectId(node.id);
        const baseAngle = rootSubjectId ? subjectAngles.get(rootSubjectId) ?? 0 : (parseInt(node.id.replace(/[^0-9]/g, ''), 10) || 1) / 100 * Math.PI * 2;
        const angle = baseAngle + (node.type === 'question' ? (Math.random() - 0.5) * 0.4 : (Math.random() - 0.5) * 0.2);

        const targetX = centerX + Math.cos(angle) * radiusX * radiusFactor;
        const targetY = centerY + Math.sin(angle) * radiusY * radiusFactor;

        pos.vx = (targetX - pos.x) * 0.05;
        pos.vy = (targetY - pos.y) * 0.05;
        pos.x += pos.vx;
        pos.y += pos.vy;
        totalEnergy += Math.abs(pos.vx) + Math.abs(pos.vy);
    });
    return totalEnergy;
  }, [nodes, dimensions, parentMap]);

  const drawOrbitRings = useCallback((ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radiusX: number, radiusY: number) => {
    ctx.save();
    ctx.globalAlpha = 0.3;
    const masteryToRadiusFactor = (mastery: number) => (1 - mastery / 105);
    
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
    ctx.beginPath();
    const attentionRadiusFactor = masteryToRadiusFactor(40);
    ctx.ellipse(centerX, centerY, radiusX * attentionRadiusFactor, radiusY * attentionRadiusFactor, 0, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = 'rgba(52, 211, 153, 0.2)';
    ctx.beginPath();
    const safeRadiusFactor = masteryToRadiusFactor(80);
    ctx.ellipse(centerX, centerY, radiusX * safeRadiusFactor, radiusY * safeRadiusFactor, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }, []);
  
  const resetView = useCallback(() => {
    if (nodes.length === 0 || dimensions.width === 0) {
        targetTransform.current = { k: 1, x: 0, y: 0 };
        return;
    }
    if (layoutMode === 'graph' || weakestPathNode) {
      const nodesToFrame = weakestPathNode ? nodes.filter(n => pathNodeIds.has(n.id)) : nodes;
      if (nodesToFrame.length === 0) {
          targetTransform.current = {k:1, x:0, y:0};
          return;
      }
      const xs = nodesToFrame.map(n => nodePositions.current[n.id]?.x || 0).filter(Boolean);
      const ys = nodesToFrame.map(n => nodePositions.current[n.id]?.y || 0).filter(Boolean);
      if (xs.length === 0) {
          targetTransform.current = { k: 1, x: 0, y: 0 };
          return;
      };
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const graphWidth = maxX - minX;
      const graphHeight = maxY - minY;
      const scaleX = dimensions.width / (graphWidth + 100);
      const scaleY = dimensions.height / (graphHeight + 100);
      const newScale = Math.min(scaleX, scaleY, 1.5);

      targetTransform.current = {
          k: newScale,
          x: dimensions.width / 2 - ((minX + maxX) / 2) * newScale,
          y: dimensions.height / 2 - ((minY + maxY) / 2) * newScale,
      };
    } else {
        targetTransform.current = { k: 1, x: 0, y: 0 };
    }
    if (layoutMode === 'graph' && !weakestPathNode) {
      isStable.current = false;
    }
  }, [nodes, dimensions, layoutMode, weakestPathNode, pathNodeIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = Date.now();
      
      ctx.save();
      ctx.translate(transform.current.x, transform.current.y);
      ctx.scale(transform.current.k, transform.current.k);
      
      if (layoutMode === 'orbit' && !weakestPathNode) {
        const { width, height } = dimensions;
        const radiusX = (width / 2) * 0.9;
        const radiusY = (height / 2) * 0.9;
        drawOrbitRings(ctx, width / 2, height / 2, radiusX, radiusY);
      }

      const highlightedNodes = new Set<string>();
      if (hoveredNode.current) {
        highlightedNodes.add(hoveredNode.current.id);
        neighbors.get(hoveredNode.current.id)?.forEach(id => highlightedNodes.add(id));
      }
      
      if (!weakestPathNode) {
        ctx.lineWidth = layoutMode === 'orbit' ? 0.5 : 1;
        links.forEach(link => {
            const source = nodePositions.current[link.source];
            const target = nodePositions.current[link.target];
            if (source && target) {
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = (hoveredNode.current && !(highlightedNodes.has(link.source) && highlightedNodes.has(link.target)))
                ? 'rgba(100, 116, 139, 0.05)'
                : 'rgba(100, 116, 139, 0.3)';
            ctx.stroke();
            }
        });
      }
      
      if (weakestPathNode && weakestPathLinks.length > 0) {
        lineDashOffset.current = (lineDashOffset.current - 0.4) % 20;
        ctx.save();
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = lineDashOffset.current;
        ctx.lineWidth = 2.0;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        
        weakestPathLinks.forEach(link => {
            const source = nodePositions.current[link.source];
            const target = nodePositions.current[link.target];
            if (source && target) {
                ctx.beginPath();
                ctx.moveTo(source.x, source.y);
                ctx.lineTo(target.x, target.y);
                ctx.stroke();
            }
        });
        ctx.restore();
      }

      nodes.forEach(node => {
        const pos = nodePositions.current[node.id];
        if (pos) {
          const isDimmed = (hoveredNode.current && !highlightedNodes.has(node.id)) || (weakestPathNode && !pathNodeIds.has(node.id));
          
          ctx.globalAlpha = isDimmed ? 0.05 : 1.0;
          
          const pulse = 0.5 + Math.sin(time * 0.001 + pos.x) * 0.2;
          const glowRadius = node.radius + pulse * (node.type === 'question' ? 2 : 4);
          
          const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowRadius);
          gradient.addColorStop(0, node.color.replace(')', ', 0.6)'));
          gradient.addColorStop(0.5, node.color.replace(')', ', 0.2)'));
          gradient.addColorStop(1, node.color.replace(')', ', 0)'));
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, glowRadius, 0, 2 * Math.PI);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pos.x, pos.y, node.radius, 0, 2 * Math.PI);
          ctx.fillStyle = node.color;
          ctx.fill();
          if (node.borderColor) {
            ctx.strokeStyle = node.borderColor;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      });
      ctx.globalAlpha = 1.0;

      if (hoveredNode.current && !draggedNode.current) {
        const node = hoveredNode.current;
        const pos = nodePositions.current[node.id];
        if (pos) {
            const lines: string[] = [node.label];
            if (node.type === 'subject' || node.type === 'topic') {
                lines.push(`Questões: ${node.questionCount}`);
                lines.push(`Domínio Médio: ${Math.round(node.masteryScore)}%`);
            } else if (node.type === 'question') {
                lines.push(`Domínio: ${Math.round(node.masteryScore)}%`);
                if (node.data.lastAttemptDate) {
                    lines.push(`Última Revisão: ${srs.formatISOToBr(node.data.lastAttemptDate)}`);
                }
            }
            
            const fontSize = 12;
            ctx.font = `bold ${fontSize}px sans-serif`;
            const padding = 8;
            const lineHeight = fontSize * 1.4;
            const textWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
            const boxWidth = textWidth + padding * 2;
            const boxHeight = lines.length * lineHeight + padding * 2 - (lineHeight - fontSize);
            let boxX = pos.x + node.radius + 10;
            let boxY = pos.y - boxHeight / 2;
            const transformedWidth = dimensions.width / transform.current.k;
            const transformedHeight = dimensions.height / transform.current.k;
            const viewOriginX = -transform.current.x / transform.current.k;
            const viewOriginY = -transform.current.y / transform.current.k;

            if (boxX + boxWidth > viewOriginX + transformedWidth) boxX = pos.x - node.radius - 10 - boxWidth;
            if (boxY < viewOriginY) boxY = viewOriginY + 5;
            if (boxY + boxHeight > viewOriginY + transformedHeight) boxY = viewOriginY + transformedHeight - boxHeight - 5;
            
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6 / transform.current.k);
            else ctx.rect(boxX, boxY, boxWidth, boxHeight);
            ctx.fill();
            
            lines.forEach((line, i) => {
                ctx.font = i === 0 ? `bold ${fontSize}px sans-serif` : `${fontSize}px sans-serif`;
                ctx.fillStyle = i === 0 ? 'white' : '#cbd5e1';
                ctx.fillText(line, boxX + padding, boxY + padding + lineHeight * i + fontSize/2);
            });
        }
      }
      ctx.restore();
    };
    
    const loop = () => {
      if (targetTransform.current) {
        const t = 0.08;
        transform.current.k = transform.current.k * (1 - t) + targetTransform.current.k * t;
        transform.current.x = transform.current.x * (1 - t) + targetTransform.current.x * t;
        transform.current.y = transform.current.y * (1 - t) + targetTransform.current.y * t;
        const dx = Math.abs(transform.current.x - targetTransform.current.x);
        const dy = Math.abs(transform.current.y - targetTransform.current.y);
        const dk = Math.abs(transform.current.k - targetTransform.current.k);
        if (dx < 0.1 && dy < 0.1 && dk < 0.001) {
          transform.current = { ...targetTransform.current };
          targetTransform.current = null;
        }
      }

      if (weakestPathNode) {
          const { width, height } = dimensions;
          const centerX = width / 2;
          const centerY = height / 2;
          const nodesPerRow = Math.floor(width * 0.8 / 120);
          const spacingX = 120;
          const spacingY = 100;

          const serpentinePositions = new Map<string, {x:number, y:number}>();
          weakestPathNodes.forEach((node, i) => {
              const row = Math.floor(i / nodesPerRow);
              const col = i % nodesPerRow;
              const x = centerX + (col - (nodesPerRow-1)/2) * spacingX;
              const y = centerY + (row - (weakestPathNodes.length/nodesPerRow - 1)/2) * spacingY;
              serpentinePositions.set(node.id, { x, y });
          });
          
          nodes.forEach(node => {
              const pos = nodePositions.current[node.id];
              const serpentinePos = serpentinePositions.get(node.id);
              if (pos && serpentinePos) {
                  pos.vx = (serpentinePos.x - pos.x) * 0.1;
                  pos.vy = (serpentinePos.y - pos.y) * 0.1;
                  pos.x += pos.vx;
                  pos.y += pos.vy;
              }
          });
      } else if (layoutMode === 'graph') {
        runGraphSimulation();
      } else {
        const totalEnergy = runOrbitLayout();
        if (!orbitCenteringDone.current && totalEnergy < (0.05 * nodes.length)) {
            resetView();
            orbitCenteringDone.current = true;
        }
      }
      draw();
      animationFrameId.current = requestAnimationFrame(loop);
    };
    loop();
    
    return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
  }, [nodes, links, dimensions, neighbors, layoutMode, weakestPathNode, runOrbitLayout, drawOrbitRings, weakestPathLinks, pathNodeIds, parentMap, childrenMap, weakestPathNodes, resetView]);

  const getMousePos = (e: MouseEvent | WheelEvent, useTransform = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (useTransform) {
        return {
            x: (x - transform.current.x) / transform.current.k,
            y: (y - transform.current.y) / transform.current.k,
        };
    }
    return { x, y };
  };

  const findNodeAtPos = (x: number, y: number) => {
    const scaledHitRadius = (radius: number) => (radius + 5) / transform.current.k;
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const pos = nodePositions.current[node.id];
        if (pos) {
            const dx = x - pos.x;
            const dy = y - pos.y;
            if (dx * dx + dy * dy < scaledHitRadius(node.radius) ** 2) {
                return node;
            }
        }
    }
    return null;
  };

  const handleMouseDown = useCallback((e: MouseEvent) => {
    targetTransform.current = null;
    const { x, y } = getMousePos(e);
    const node = findNodeAtPos(x, y);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    if (node && !weakestPathNode) {
      draggedNode.current = node;
      isDraggingNode.current = true;
      if (layoutMode === 'graph') isStable.current = false;
    } else if (!weakestPathNode) {
      isPanning.current = true;
    }
  }, [layoutMode, weakestPathNode]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (draggedNode.current) {
      const { x, y } = getMousePos(e);
      const pos = nodePositions.current[draggedNode.current.id];
      if (pos) { pos.vx = 0; pos.vy = 0; pos.x = x; pos.y = y; }
    } else if (isPanning.current) {
      transform.current.x += e.movementX;
      transform.current.y += e.movementY;
    } else {
      const { x, y } = getMousePos(e);
      const newHoveredNode = findNodeAtPos(x, y);
      if (hoveredNode.current?.id !== newHoveredNode?.id) {
          hoveredNode.current = newHoveredNode;
          onNodeHover(newHoveredNode);
      }
    }
    canvas.style.cursor = draggedNode.current ? 'grabbing' : isPanning.current ? 'grabbing' : hoveredNode.current ? 'pointer' : 'grab';
  }, [onNodeHover]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (draggedNode.current && layoutMode === 'orbit') {
        const pos = nodePositions.current[draggedNode.current.id];
        if (pos) { pos.vx = 0; pos.vy = 0; }
    } else if (draggedNode.current) {
        const pos = nodePositions.current[draggedNode.current.id];
        if(pos) { pos.vx = 0; pos.vy = 0; }
    }
    const dist = Math.hypot(e.clientX - dragStartPos.current.x, e.clientY - dragStartPos.current.y);
    if (dist < 3) {
      const { x, y } = getMousePos(e);
      const node = findNodeAtPos(x, y);
      onNodeClick(node);
    }
    draggedNode.current = null;
    isDraggingNode.current = false;
    isPanning.current = false;
  }, [onNodeClick, layoutMode]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    targetTransform.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getMousePos(e, false);
    const factor = 1 - e.deltaY * 0.001;
    const newScale = Math.max(0.2, Math.min(5, transform.current.k * factor));
    const k = newScale / transform.current.k;
    transform.current.x = x - (x - transform.current.x) * k;
    transform.current.y = y - (y - transform.current.y) * k;
    transform.current.k = newScale;
  }, []);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleWheel]);

  const zoom = useCallback((factor: number) => {
    const { width, height } = dimensions;
    const newScale = Math.max(0.2, Math.min(5, transform.current.k * factor));
    const k = newScale / transform.current.k;
    
    targetTransform.current = {
        k: newScale,
        x: width/2 - (width/2 - transform.current.x) * k,
        y: height/2 - (height/2 - transform.current.y) * k,
    };
  }, [dimensions]);

  const zoomIn = useCallback(() => zoom(1.3), [zoom]);
  const zoomOut = useCallback(() => zoom(1 / 1.3), [zoom]);

  return { canvasRef, zoomIn, zoomOut, resetView };
};