"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarMoeda } from "@/lib/utils";

const TEXT_MUTED = "#6B6A62";
const GRID_COLOR = "#E3E0D6";
const ACCENT = "#B8863C";

function TooltipCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-md">
      {children}
    </div>
  );
}

// ------------------------------------------------------------------
// Tendência — faturamento realizado por período (uma série só, sem
// legenda: o título do card já nomeia a série).
// ------------------------------------------------------------------
export function TendenciaChart({ dados }: { dados: { rotulo: string; vlRealizado: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradienteFaturamento" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
        <XAxis
          dataKey="rotulo"
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          axisLine={{ stroke: GRID_COLOR }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <Tooltip
          cursor={{ stroke: ACCENT, strokeWidth: 1, strokeDasharray: "3 3" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <TooltipCard>
                <p className="mb-1 font-medium text-foreground">{label}</p>
                <p className="text-muted-foreground">
                  Faturamento: <strong className="text-foreground">{formatarMoeda(payload[0].value as number)}</strong>
                </p>
              </TooltipCard>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="vlRealizado"
          stroke={ACCENT}
          strokeWidth={2}
          fill="url(#gradienteFaturamento)"
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------------------
// Donut — orçamentos por status, com total no centro (SVG por cima do
// PieChart, mesmo truque do "48% Contacted" de referência).
// ------------------------------------------------------------------
const STATUS_COLOR: Record<string, string> = {
  pendente: "#B8863C",
  aceito: "#3E7C59",
  pago: "#2F6690",
  liberado: "#1F8A70",
  reprovado: "#B23A3A",
};

export function StatusDonutChart({
  dados,
  total,
}: {
  dados: { status: string; rotulo: string; qtd: number }[];
  total: number;
}) {
  const comValor = dados.filter((d) => d.qtd > 0);

  if (comValor.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Sem orçamentos no período.
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={comValor}
            dataKey="qtd"
            nameKey="rotulo"
            innerRadius={64}
            outerRadius={92}
            paddingAngle={2}
            stroke="var(--color-card)"
            strokeWidth={2}
          >
            {comValor.map((d) => (
              <Cell key={d.status} fill={STATUS_COLOR[d.status]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { rotulo: string; qtd: number };
              return (
                <TooltipCard>
                  <p className="font-medium text-foreground">{d.rotulo}</p>
                  <p className="text-muted-foreground">{d.qtd} orçamento(s)</p>
                </TooltipCard>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-foreground">{total}</span>
        <span className="text-xs text-muted-foreground">no período</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Barras — faturamento por tipo de processo (categórico, 2 séries:
// Despachante x Contrato).
// ------------------------------------------------------------------
const TIPO_COLOR: Record<string, string> = {
  despachante: "#2a78d6",
  contrato: "#eb6834",
};

export function TipoProcessoBarChart({
  dados,
}: {
  dados: { tipo: string; rotulo: string; vlTotal: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <YAxis
          type="category"
          dataKey="rotulo"
          tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip
          cursor={{ fill: "var(--color-muted)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { rotulo: string; vlTotal: number };
            return (
              <TooltipCard>
                <p className="font-medium text-foreground">{d.rotulo}</p>
                <p className="text-muted-foreground">{formatarMoeda(d.vlTotal)}</p>
              </TooltipCard>
            );
          }}
        />
        <Bar dataKey="vlTotal" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {dados.map((d) => (
            <Cell key={d.tipo} fill={TIPO_COLOR[d.tipo] ?? ACCENT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
