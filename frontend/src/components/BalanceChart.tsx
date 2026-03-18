import { useState } from 'react';

interface WeekData {
  week_end: string;
  credits: number;
  debits: number;
  balance: number;
}

interface GoalLine {
  name: string;
  target_amount: number;
}

interface BalanceChartProps {
  data: WeekData[];
  color: string;
  futureData?: WeekData[];
  goals?: GoalLine[];
}

export default function BalanceChart({ data, color, futureData, goals }: BalanceChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length < 2) {
    return <p className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>Not enough data for chart yet.</p>;
  }

  // Combine historical + future for axis scaling
  const allData = futureData?.length ? [...data, ...futureData] : data;
  const historicalCount = data.length;

  const hasGoals = goals && goals.length > 0;
  const W = 600;
  const H = 200;
  const PAD_L = 50;
  const PAD_R = hasGoals ? 70 : 10;
  const PAD_T = 15;
  const PAD_B = 30;

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  // Compute previous balance for each week (top of green bar)
  const prevBalances = allData.map((d, i) => i === 0 ? d.balance - d.credits + d.debits : allData[i - 1].balance);
  const barTops = allData.map((d, i) => prevBalances[i] + d.credits);

  const allValues = [
    ...allData.map(d => d.balance),
    ...barTops,
    ...prevBalances,
  ];

  // Include goal lines in y-range
  if (goals) {
    for (const g of goals) {
      allValues.push(g.target_amount);
    }
  }

  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const padding = (maxVal - minVal) * 0.08 || 1;
  const yMax = maxVal + padding;
  const yMin = minVal - padding;
  const yRange = yMax - yMin || 1;

  function toX(i: number) {
    return PAD_L + (i / (allData.length - 1)) * chartW;
  }
  function toY(val: number) {
    return PAD_T + chartH - ((val - yMin) / yRange) * chartH;
  }

  // Historical balance line points
  const linePoints = data.map((d, i) => `${toX(i)},${toY(d.balance)}`).join(' ');

  // Future (dashed) balance line points - starts from last historical point
  const futureLinePoints = futureData?.length
    ? [
        `${toX(historicalCount - 1)},${toY(data[data.length - 1].balance)}`,
        ...futureData.map((d, i) => `${toX(historicalCount + i)},${toY(d.balance)}`)
      ].join(' ')
    : '';

  // Grid lines (4-5 horizontal)
  const gridCount = 4;
  const gridLines: { y: number; label: string }[] = [];
  const step = yRange / gridCount;
  for (let i = 0; i <= gridCount; i++) {
    const val = yMin + step * i;
    gridLines.push({ y: toY(val), label: formatCompact(val) });
  }

  // Bar width - half width for side-by-side
  const barHalfW = Math.max(2, Math.min(8, chartW / allData.length * 0.25));

  // X-axis labels (show ~5-6)
  const labelInterval = Math.max(1, Math.floor(allData.length / 5));

  function formatCompact(n: number): string {
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${Math.round(n)}`;
  }

  function formatWeek(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const hovered = hoverIdx !== null ? allData[hoverIdx] : null;
  const hoveredIsFuture = hoverIdx !== null && hoverIdx >= historicalCount;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={g.y} y2={g.y} stroke="var(--color-border)" strokeWidth={0.5} />
            <text x={PAD_L - 6} y={g.y + 3.5} textAnchor="end" fontSize={9} fill="var(--color-text-muted)">{g.label}</text>
          </g>
        ))}

        {/* Goal lines */}
        {goals?.map((g, i) => {
          const gy = toY(g.target_amount);
          return (
            <g key={`goal-${i}`}>
              <line x1={PAD_L} x2={W - 5} y1={gy} y2={gy} stroke="#00F0FF" strokeWidth={0.5} strokeDasharray="5,3" opacity={0.7} />
              <text x={W - PAD_R + 4} y={gy - 4} fontSize={8} fill="#00F0FF" textAnchor="start" fontWeight={600}>
                {g.name}
              </text>
              <text x={W - PAD_R + 4} y={gy + 8} fontSize={8} fill="#00F0FF" textAnchor="start">
                {formatCompact(g.target_amount)}
              </text>
            </g>
          );
        })}

        {/* Credit/Debit bars - green left of center, red right of center */}
        {allData.map((d, i) => {
          const x = toX(i);
          const prevBal = prevBalances[i];
          const topAfterCredits = prevBal + d.credits;
          const isFuture = i >= historicalCount;
          return (
            <g key={`bar-${i}`}>
              {/* Credit bar: left of center point */}
              {d.credits > 0 && (
                <rect
                  x={x - barHalfW * 2}
                  y={toY(topAfterCredits)}
                  width={barHalfW * 2}
                  height={Math.max(1, toY(prevBal) - toY(topAfterCredits))}
                  fill="var(--color-success)"
                  opacity={isFuture ? 0.2 : 0.35}
                  rx={1}
                />
              )}
              {/* Debit bar: right of center point */}
              {d.debits > 0 && (
                <rect
                  x={x}
                  y={toY(topAfterCredits)}
                  width={barHalfW * 2}
                  height={Math.max(1, toY(d.balance) - toY(topAfterCredits))}
                  fill="var(--color-danger)"
                  opacity={isFuture ? 0.2 : 0.35}
                  rx={1}
                />
              )}
            </g>
          );
        })}

        {/* Historical balance line (solid) */}
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* Future balance line (dashed) */}
        {futureLinePoints && (
          <polyline points={futureLinePoints} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6,4" opacity={0.6} />
        )}

        {/* Data points */}
        {allData.map((_, i) => {
          const isFuture = i >= historicalCount;
          return (
            <circle
              key={`pt-${i}`}
              cx={toX(i)}
              cy={toY(allData[i].balance)}
              r={hoverIdx === i ? 4.5 : 2.5}
              fill={isFuture ? '#fff' : color}
              stroke={isFuture ? color : '#fff'}
              strokeWidth={1.5}
              strokeDasharray={isFuture ? '2,2' : undefined}
            />
          );
        })}

        {/* X-axis labels */}
        {allData.map((d, i) => (
          (i % labelInterval === 0 || i === allData.length - 1) && (
            <text key={`xl-${i}`} x={toX(i)} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--color-text-muted)">
              {formatWeek(d.week_end)}
            </text>
          )
        ))}

        {/* Hover zones */}
        {allData.map((_, i) => {
          const x0 = i === 0 ? PAD_L : (toX(i - 1) + toX(i)) / 2;
          const x1 = i === allData.length - 1 ? W - PAD_R : (toX(i) + toX(i + 1)) / 2;
          return (
            <rect
              key={`hover-${i}`}
              x={x0}
              y={PAD_T}
              width={x1 - x0}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          );
        })}

        {/* Hover line */}
        {hoverIdx !== null && (
          <line x1={toX(hoverIdx)} x2={toX(hoverIdx)} y1={PAD_T} y2={PAD_T + chartH} stroke="var(--color-text-muted)" strokeWidth={0.5} strokeDasharray="3,3" />
        )}
      </svg>

      {/* Tooltip */}
      {hovered && hoverIdx !== null && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: `${((toX(hoverIdx)) / W) * 100}%`,
          transform: 'translateX(-50%)',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.35rem 0.6rem',
          fontSize: '0.8rem',
          whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-md)',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 600 }}>
            {formatWeek(hovered.week_end)}
            {hoveredIsFuture && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> (projected)</span>}
          </div>
          <div>Prev week: ${(hovered.balance-hovered.credits+hovered.debits).toFixed(2)}</div>
          {hovered.credits > 0 && <div style={{ color: 'var(--color-success)' }}>+${hovered.credits.toFixed(2)} earned</div>}
          {hovered.debits > 0 && <div style={{ color: 'var(--color-danger)' }}>-${hovered.debits.toFixed(2)} spent</div>}
          <div>Balance: <strong>${hovered.balance.toFixed(2)}</strong></div>
        </div>
      )}
    </div>
  );
}
