import { useMemo } from 'react';

interface WeightProgressRingProps {
  weightHistory: { weight: number; recorded_at: string }[];
  target: string;
}

export default function WeightProgressRing({ weightHistory, target }: WeightProgressRingProps) {
  const stats = useMemo(() => {
    if (weightHistory.length === 0) return null;
    const current = weightHistory[0].weight;
    const first = weightHistory[weightHistory.length - 1].weight;
    const change = current - first;
    const changePercent = first > 0 ? Math.abs(change / first) * 100 : 0;
    const min = Math.min(...weightHistory.map(w => w.weight));
    const max = Math.max(...weightHistory.map(w => w.weight));
    const range = max - min || 1;
    // Progress ring: how far current is from start toward goal direction
    const isLoss = target === 'Weight Loss' || target === 'Cut' || target === 'Lean';
    const progressPercent = Math.min(changePercent * 3, 100); // Scale for visual
    return { current, first, change, changePercent, min, max, range, isLoss, progressPercent };
  }, [weightHistory, target]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">No weight data yet</p>
      </div>
    );
  }

  const size = 220;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(stats.progressPercent, 95);
  const dashOffset = circumference - (progress / 100) * circumference;

  const isPositive = stats.change > 0;
  const direction = stats.isLoss
    ? (stats.change < 0 ? 'On Track' : 'Needs Work')
    : (stats.change > 0 ? 'On Track' : 'Getting Started');

  return (
    <div className="flex flex-col items-center py-4">
      {/* 3D Ring */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer glow */}
        <div
          className="absolute inset-0 rounded-full opacity-20 blur-xl"
          style={{
            background: 'linear-gradient(135deg, hsl(166,76%,58%), hsl(270,60%,65%))',
          }}
        />

        <svg width={size} height={size} className="relative z-10 drop-shadow-2xl" style={{ filter: 'drop-shadow(0 4px 20px rgba(94, 237, 201, 0.15))' }}>
          {/* Background track with 3D effect */}
          <defs>
            <linearGradient id="ringBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(220,15%,18%)" />
              <stop offset="100%" stopColor="hsl(220,15%,12%)" />
            </linearGradient>
            <linearGradient id="ringProgress" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(166,76%,58%)" />
              <stop offset="50%" stopColor="hsl(200,80%,55%)" />
              <stop offset="100%" stopColor="hsl(270,60%,65%)" />
            </linearGradient>
            <filter id="ring3d">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.4)" />
              <feDropShadow dx="0" dy="-1" stdDeviation="1" floodColor="rgba(255,255,255,0.05)" />
            </filter>
            <filter id="progressGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#ringBg)"
            strokeWidth={strokeWidth}
            filter="url(#ring3d)"
          />

          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#ringProgress)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            filter="url(#progressGlow)"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />

          {/* End cap glow dot */}
          {progress > 5 && (
            <circle
              cx={size / 2 + radius * Math.cos(((progress / 100) * 360 - 90) * Math.PI / 180)}
              cy={size / 2 + radius * Math.sin(((progress / 100) * 360 - 90) * Math.PI / 180)}
              r={strokeWidth / 2 + 2}
              fill="hsl(270,60%,65%)"
              opacity={0.6}
              style={{ filter: 'blur(4px)' }}
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <p className="text-4xl font-extrabold text-foreground">{stats.current}</p>
          <p className="text-sm text-muted-foreground font-medium">kg</p>
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-4 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
          direction === 'On Track'
            ? 'bg-[hsl(166,76%,58%,0.15)] text-[hsl(166,76%,58%)]'
            : 'bg-[hsl(38,92%,50%,0.15)] text-[hsl(38,92%,50%)]'
        }`}>
          {direction}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-center gap-6 mt-5 w-full">
        <div className="text-center">
          <p className="text-lg font-extrabold text-foreground">{stats.first} kg</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Start Weight</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <p className={`text-lg font-extrabold ${isPositive ? 'text-[hsl(166,76%,58%)]' : 'text-[hsl(270,60%,65%)]'}`}>
            {isPositive ? '+' : ''}{stats.change.toFixed(1)} kg
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Change</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <p className="text-lg font-extrabold text-foreground">{stats.changePercent.toFixed(1)}%</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Progress</p>
        </div>
      </div>
    </div>
  );
}
