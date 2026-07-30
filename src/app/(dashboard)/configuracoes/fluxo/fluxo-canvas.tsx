"use client";

import {
  Background,
  Controls,
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
import { FLUXO_CONEXOES, type BlocoFluxo, type FluxoBloco } from "@/types/database";
import { alternarAtivoBloco, atualizarPosicaoBloco } from "../actions";

// Desativar esses dois trava o formulário inteiro (nada depende deles
// pra existir, tudo depende deles pra funcionar) — o aviso no card é
// só um alerta visual, não impede desativar de verdade.
const BLOCOS_ESSENCIAIS: BlocoFluxo[] = ["tipo_processo", "informacoes_basicas"];

interface BlocoNodeData extends Record<string, unknown> {
  label: string;
  ativo: boolean;
  essencial: boolean;
  onToggle: (ativo: boolean) => void;
}

function BlocoNode({ data }: { data: BlocoNodeData }) {
  return (
    <div
      className={cn(
        "min-w-[210px] rounded-xl border-2 bg-card px-3 py-2.5 shadow-sm transition-colors",
        data.ativo ? "border-brand" : "border-border opacity-50"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{data.label}</span>
        <Checkbox
          checked={data.ativo}
          onChange={(e) => data.onToggle(e.target.checked)}
          aria-label={`Ativar ou desativar ${data.label}`}
        />
      </div>
      {data.essencial && (
        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
          Bloco essencial — desativar impede criar orçamento
        </p>
      )}
    </div>
  );
}

const nodeTypes = { bloco: BlocoNode };

const edges: Edge[] = FLUXO_CONEXOES.map((conexao) => ({
  id: `${conexao.origem}-${conexao.destino}`,
  source: conexao.origem,
  target: conexao.destino,
  label: conexao.rotulo,
  animated: true,
}));

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

  function toggle(cdBloco: BlocoFluxo, ativo: boolean) {
    setAtivoPorBloco((atual) => ({ ...atual, [cdBloco]: ativo }));
    startTransition(() => alternarAtivoBloco(cdBloco, ativo));
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
          label:
            blocosIniciais.find((b) => b.cd_bloco === node.id)?.nm_bloco ?? node.id,
          ativo: ativoPorBloco[node.id] ?? true,
          essencial: BLOCOS_ESSENCIAIS.includes(node.id as BlocoFluxo),
          onToggle: (ativo: boolean) => toggle(node.id as BlocoFluxo, ativo),
        },
      })),
    [nodes, ativoPorBloco, blocosIniciais]
  );

  return (
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
  );
}
