import React, { useState, useMemo } from 'react';
import { Question } from '../types';

interface ChartDataPoint {
  x: number; // timestamp
  y: number; // mastery score
  question: Question;
}

interface MasteryTimeChartProps {
  data: ChartDataPoint[];
}

interface TooltipData {
  x: number; // screen x
  y: number; // screen y
  data: ChartDataPoint;
}

const MasteryTimeChart: React.FC<MasteryTimeChartProps> = ({ data }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const width = 500;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };

  const { xScale, yScale, xLabels } = useMemo(() => {
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const xVals = data.map(d => d.x);
    const minDate = xVals.length > 0 ? Math.min(...xVals) : new Date().getTime();
    const maxDate = xVals.length > 0 ? Math.max(...xVals) : new Date().getTime();
    
    const xDom = [minDate, maxDate];
    const yDom = [0, 100];

    const xScaleFn = (value: number) => {
      if (xDom[1] === xDom[0]) return padding.left + innerWidth / 2;
      return padding.left + ((value - xDom[0]) / (xDom[1] - xDom[0])) * innerWidth;
    }
    const yScaleFn = (value: number) => padding.top + innerHeight - ((value - yDom[0]) / (yDom[1] - yDom[0])) * innerHeight;
    
    const numXLabels = 5;
    const xLabelData = [];
    if (xDom[1] > xDom[0]) {
        const interval = (xDom[1] - xDom[0]) / (numXLabels - 1);
        for (let i = 0; i < numXLabels; i++) {
            const dateVal = xDom[0] + (i * interval);
            xLabelData.push(new Date(dateVal));
        }
    } else if (data.length > 0) {
        xLabelData.push(new Date(xDom[0]));
    }
    
    return {
      xScale: xScaleFn,
      yScale: yScaleFn,
      xLabels: xLabelData,
    };
  }, [data]);
  
  const getMasteryColor = (score: number) => {
    if (score < 40) return 'fill-red-500';
    if (score < 80) return 'fill-amber-500';
    return 'fill-emerald-500';
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const cursorPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    
    let closestPoint: ChartDataPoint | null = null;
    let minDistance = Infinity;

    data.forEach(d => {
      const screenX = xScale(d.x);
      const screenY = yScale(d.y);
      const distance = Math.sqrt(Math.pow(cursorPoint.x - screenX, 2) + Math.pow(cursorPoint.y - screenY, 2));
      if (distance < minDistance && distance < 20) {
          minDistance = distance;
          closestPoint = d;
      }
    });

    if (closestPoint) {
      setTooltip({
        x: xScale(closestPoint.x),
        y: yScale(closestPoint.y),
        data: closestPoint
      });
    } else {
      setTooltip(null);
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };
  
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-sm text-bunker-500 dark:text-bunker-400">
        Nenhuma revisão encontrada para o período selecionado.
      </div>
    );
  }
  
  const yLabels = [0, 20, 40, 60, 80, 100];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="w-full h-auto">
        {/* Axes and Grid */}
        {yLabels.map(label => (
          <g key={`y-grid-${label}`}>
            <line
              x1={padding.left} y1={yScale(label)}
              x2={width - padding.right} y2={yScale(label)}
              className="stroke-bunker-200 dark:stroke-bunker-800" strokeWidth="1" strokeDasharray="2,2" />
            <text x={padding.left - 8} y={yScale(label) + 4} textAnchor="end" className="text-xs fill-bunker-400">{label}%</text>
          </g>
        ))}
        {xLabels.map((date, i) => (
             <text key={`x-label-${i}`} x={xScale(date.getTime())} y={height - padding.bottom + 15} textAnchor="middle" className="text-xs fill-bunker-400">
                {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </text>
        ))}
         <text x={width / 2} y={height-5} textAnchor="middle" className="text-xs font-semibold fill-bunker-500 dark:fill-bunker-400">Data da Revisão</text>
         <text transform={`translate(15, ${height/2}) rotate(-90)`} textAnchor="middle" className="text-xs font-semibold fill-bunker-500 dark:fill-bunker-400">Domínio</text>

        {/* Data points */}
        {data.map((d, i) => (
          <circle 
            key={i}
            cx={xScale(d.x)}
            cy={yScale(d.y)}
            r={tooltip?.data === d ? 6 : 4}
            className={`${getMasteryColor(d.y)} transition-all opacity-70 hover:opacity-100 cursor-pointer`}
          />
        ))}

        {/* Tooltip focus circle */}
        {tooltip && (
            <circle
                cx={tooltip.x}
                cy={tooltip.y}
                r={8}
                className={`stroke-2 ${getMasteryColor(tooltip.data.y).replace('fill', 'stroke')}`}
                fill="none"
            />
        )}
      </svg>
      
      {/* Tooltip */}
      {tooltip && (
          <div className="absolute p-2 text-xs text-white bg-bunker-900/80 dark:bg-bunker-950/80 rounded-md shadow-lg pointer-events-none"
             style={{ 
                 left: `${(tooltip.x / width) * 100}%`, 
                 top: `${(tooltip.y / height) * 100}%`, 
                 transform: `translate(10px, -110%)` 
             }}
          >
              <p className="font-bold mb-1">{tooltip.data.question.questionRef}</p>
              <p>Domínio: <strong>{tooltip.data.y.toFixed(0)}%</strong></p>
              <p>Data: <strong>{new Date(tooltip.data.x).toLocaleDateString('pt-BR')}</strong></p>
          </div>
      )}
    </div>
  );
};

export default MasteryTimeChart;
