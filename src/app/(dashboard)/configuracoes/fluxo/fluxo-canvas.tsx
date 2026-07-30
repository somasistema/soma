"use client";

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  FLUXO_CONEXOES,
  type BlocoFluxo,
  type FluxoBloco,
  type TipoAplicavelFluxo,
} from "@/types/database";
import { alternarAtivoBloco, atualizarAplicavelBloco, atualizarPosicaoBloco } from "../actions";

// Desativar esses dois trava o formulário inteiro (nada depende deles
// pra existir, tudo depende deles pra funcionar) — o aviso no card é
// só um alerta visual, não impede desativar de verdade.
const BLOCOS_ESSENCIAIS: BlocoFluxo[] = ["tipo_processo", "informacoes_basicas"];

// Cor por ramo — deixa visualmente claro que Despachante e Contrato
// são dois fluxos diferentes, mesmo reaproveitando blocos comuns.
const COR_RAMO: Record<TipoAplicavelFluxo | "comum", string> = {
  despachante: "#2563eb",
  contrato: "#d97706",
  ambos: "#94a3b8",
  comum: "#94a3b8",
};

const OPCOES_APLICAVEL: { valor: TipoAplicavelFluxo; rotulo: string }[] = [
  { valor: "ambos", rotulo: "Ambos" },
  { valor: "despachante", rotulo: "Despachante" },
  { valor: "contrato", rotulo: "Contrato" },
];

interface BlocoNodeData extends Record<string, unknown> {
  label: string;
  ativo: boolean;
  essencial: boolean;
  aplicavel: TipoAplicavelFluxo;
  onToggle: (ativo: boolean) => void;
  onMudarAplicavel: (aplicavel: TipoAplicavelFluxo) => void;
}

function BlocoNode({ data }: { data: BlocoNodeData }) {
  return (
    <div
      className={cn(
        "min-w-[230px] rounded-xl border-2 bg-card px-3 py-2.5 shadow-sm transition-colors",
        data.ativo ? "border-brand" : "border-border opacity-50"
      )}
      style={data.aplicavel !== "ambos" ? { borderColor: COR_RAMO[data.aplicavel] } : undefined}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{data.label}</span>
        <Checkbox
          checked={data.ativo}
          onChange={(e) => data.onToggle(e.target.checked)}
          aria-label={`Ativar ou desativar ${data.label}`}
        />
      </div>
      <div className="mt-2 flex gap-1">
        {OPCOES_APLICAVEL.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            onClick={() => data.onMudarAplicavel(opcao.valor)}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
              data.aplicavel === opcao.valor
                ? "text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
            style={
              data.aplicavel === opcao.valor
                ? { backgroundColor: COR_RAMO[opcao.valor] }
                : undefined
            }
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      {data.essencial && (
        <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground">
          Bloco essencial — desativar impede criar orçamento
        </p>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { bloco: BlocoNode };

export function FluxoCanvas({ blocosIniciais }: { blocosIniciais: FluxoBloco[] }) {
  const [, startTransition] = useTransition();

  const [nodes, setNodes] = useState<Node[]>(() =>
    blocosIniciais.map((bloco) => ({
      id: bloco.cd_bloco,
      type: "bloco",
      position: { x: bloco.posicao_x, y: bloco.posicao_y },
      data: {},
    }))
  );

  const [ativoPorBloco, setAtivoPorBloco] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(blocosIniciais.map((b) => [b.cd_bloco, b.sn_ativo]))
  );

  const [aplicavelPorBloco, setAplicavelPorBloco] = useState<Record<string, TipoAplicavelFluxo>>(
    () => Object.fromEntries(blocosIniciais.map((b) => [b.cd_bloco, b.tp_aplicavel]))
  );

  function toggle(cdBloco: BlocoFluxo, ativo: boolean) {
    setAtivoPorBloco((atual) => ({ ...atual, [cdBloco]: ativo }));
    startTransition(() => alternarAtivoBloco(cdBloco, ativo));
  }

  function mudarAplicavel(cdBloco: BlocoFluxo, aplicavel: TipoAplicavelFluxo) {
    setAplicavelPorBloco((atual) => ({ ...atual, [cdBloco]: aplicavel }));
    startTransition(() => atualizarAplicavelBloco(cdBloco, aplicavel));
  }

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((atual) => applyNodeChanges(changes, atual)),
    []
  );

  const onNodeDragStop = useCallback((_evento: unknown, node: Node) => {
    startTransition(() =>
      atualizarPosicaoBloco(node.id as BlocoFluxo, node.position.x, node.position.y)
    );
  }, []);

  const nodesComEstado = useMemo<Node<BlocoNodeData>[]>(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          label: blocosIniciais.find((b) => b.cd_bloco === node.id)?.nm_bloco ?? node.id,
          ativo: ativoPorBloco[node.id] ?? true,
          aplicavel: aplicavelPorBloco[node.id] ?? "ambos",
          essencial: BLOCOS_ESSENCIAIS.includes(node.id as BlocoFluxo),
          onToggle: (ativo: boolean) => toggle(node.id as BlocoFluxo, ativo),
          onMudarAplicavel: (aplicavel: TipoAplicavelFluxo) =>
            mudarAplicavel(node.id as BlocoFluxo, aplicavel),
        },
      })),
    [nodes, ativoPorBloco, aplicavelPorBloco, blocosIniciais]
  );

  // Cor/rótulo da seta vêm de quem ela liga: se o destino é exclusivo
  // de um ramo, a seta é desse ramo; senão olha a origem; senão é
  // cinza (comum aos dois). Tudo recalculado a partir do estado atual
  // dos blocos — muda na hora que você troca Ambos/Despachante/Contrato.
  const edges = useMemo<Edge[]>(() => {
    return FLUXO_CONEXOES.map((conexao) => {
      const aplicavelDestino = aplicavelPorBloco[conexao.destino] ?? "ambos";
      const aplicavelOrigem = aplicavelPorBloco[conexao.origem] ?? "ambos";
      const ramo = aplicavelDestino !== "ambos" ? aplicavelDestino : aplicavelOrigem;
      const cor = COR_RAMO[ramo];
      const rotulo =
        ramo !== "ambos" ? (ramo === "despachante" ? "Despachante" : "Contrato") : undefined;

      return {
        id: `${conexao.origem}-${conexao.destino}`,
        source: conexao.origem,
        target: conexao.destino,
        label: rotulo,
        animated: true,
        style: { stroke: cor, strokeWidth: 2 },
        labelStyle: { fill: cor, fontWeight: 600 },
        markerEnd: { type: "arrowclosed" as const, color: cor },
      };
    });
  }, [aplicavelPorBloco]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="h-0.5 w-5 rounded-full"
            style={{ backgroundColor: COR_RAMO.despachante }}
          />
          Só Despachante
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: COR_RAMO.contrato }} />
          Só Contrato
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: COR_RAMO.comum }} />
          Comum aos dois
        </span>
      </div>
      <div className="h-[560px] w-full overflow-hidden rounded-2xl border border-border bg-card">
        <ReactFlow
          nodes={nodesComEstado}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
