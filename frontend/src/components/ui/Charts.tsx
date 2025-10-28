import React from 'react';

type BarDatum = { label: string; value: number; color?: string };

export function BarChart({ data, height = 160 }: { data: BarDatum[]; height?: number }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const barWidth = 100 / data.length;
  return (
    <div className="w-full">
      <svg viewBox={`0 0 100 ${height}`} className="w-full h-40">
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 20);
          const x = i * barWidth + 5;
          const y = height - h - 20;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth - 10} height={h} fill={d.color || '#3b82f6'} rx={2} />
              <text x={x + (barWidth - 10) / 2} y={height - 6} textAnchor="middle" fontSize="4" fill="#6b7280">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type LinePoint = { x: string; y: number };

export function LineChart({ points, height = 160, color = '#10b981' }: { points: LinePoint[]; height?: number; color?: string }) {
  if (points.length === 0) return <div className="text-sm text-gray-500">No data</div>;
  const max = Math.max(1, ...points.map(p => p.y));
  const stepX = 100 / Math.max(1, points.length - 1);
  const scaleY = (v: number) => (height - 20) - (v / max) * (height - 30);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${scaleY(p.y)}`).join(' ');
  return (
    <div className="w-full">
      <svg viewBox={`0 0 100 ${height}`} className="w-full h-40">
        <path d={path} stroke={color} strokeWidth={1.5} fill="none" />
        {points.map((p, i) => (
          <circle key={i} cx={i * stepX} cy={scaleY(p.y)} r={1.5} fill={color} />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        {points.map((p, i) => (
          <span key={i}>{p.x}</span>
        ))}
      </div>
    </div>
  );
}