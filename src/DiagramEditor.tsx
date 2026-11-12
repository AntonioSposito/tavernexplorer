import { addEdge, applyEdgeChanges, applyNodeChanges, Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState } from "react";
import type { JournalNote } from "./types";
import { Button, Dialog, Input } from "./ui";

// Diagramma di una nota (React Flow): riquadri con un testo collegati da frecce. Si salva da solo a ogni modifica conclusa.
type Diagram = NonNullable<JournalNote["diagram"]>;
type LabelDraft = { kind: "node" | "edge"; id: string | null; label: string };

const arrow = { type: MarkerType.ArrowClosed };
const toNodes = (diagram: Diagram): Node[] => diagram.nodes.map((node) => ({ id: node.id, position: { x: node.x, y: node.y }, data: { label: node.label } }));
const toEdges = (diagram: Diagram): Edge[] => diagram.edges.map((edge) => ({ ...edge, markerEnd: arrow }));
const toDiagram = (nodes: Node[], edges: Edge[]): Diagram => ({
  nodes: nodes.map((node) => ({ id: node.id, x: Math.round(node.position.x), y: Math.round(node.position.y), label: String(node.data.label ?? "") })),
  edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, ...edge.label ? { label: String(edge.label) } : {} })),
});

// ponytail: lo stato parte dalla nota all'apertura; le modifiche altrui arrivano riaprendo il diagramma (vince l'ultimo salvataggio).
export default function DiagramEditor({ diagram, editable, onChange }: { diagram: Diagram; editable: boolean; onChange: (diagram: Diagram) => void }) {
  const [nodes, setNodes] = useState(() => toNodes(diagram));
  const [edges, setEdges] = useState(() => toEdges(diagram));
  const [draft, setDraft] = useState<LabelDraft | null>(null);
  const save = (nextNodes = nodes, nextEdges = edges) => { setNodes(nextNodes); setEdges(nextEdges); onChange(toDiagram(nextNodes, nextEdges)); };

  const saveLabel = ({ kind, id, label }: LabelDraft) => {
    if (kind === "edge") save(nodes, edges.map((edge) => edge.id === id ? { ...edge, label: label.trim() || undefined } : edge));
    else if (id) save(nodes.map((node) => node.id === id ? { ...node, data: { label } } : node));
    else save([...nodes, { id: crypto.randomUUID(), position: { x: 40 + (nodes.length % 5) * 20, y: 40 + (nodes.length % 5) * 70 }, data: { label } }]);
    setDraft(null);
  };
  const remove = ({ kind, id }: LabelDraft) => {
    if (kind === "edge") save(nodes, edges.filter((edge) => edge.id !== id));
    else save(nodes.filter((node) => node.id !== id), edges.filter((edge) => edge.source !== id && edge.target !== id));
    setDraft(null);
  };

  return <div className="diagram">
    {editable && <div className="diagram-actions">
      <Button type="button" variant="outline" onClick={() => setDraft({ kind: "node", id: null, label: "" })}>Aggiungi riquadro</Button>
      <small>Trascina dal pallino di un riquadro a un altro per collegarli; doppio clic per modificare.</small>
    </div>}
    <div className="diagram-canvas">
      <ReactFlow nodes={nodes} edges={edges} colorMode="dark" fitView={diagram.nodes.length > 0} fitViewOptions={{ maxZoom: 1 }} proOptions={{ hideAttribution: true }}
        nodesDraggable={editable} nodesConnectable={editable} elementsSelectable={editable} deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
        onNodesChange={(changes) => setNodes((current) => applyNodeChanges(changes, current))}
        onEdgesChange={(changes) => setEdges((current) => applyEdgeChanges(changes, current))}
        onNodeDragStop={(_, __, dragged) => save(nodes.map((node) => dragged.find((item) => item.id === node.id) ?? node))}
        onConnect={(connection) => save(nodes, addEdge({ ...connection, id: crypto.randomUUID(), markerEnd: arrow }, edges))}
        onDelete={({ nodes: gone, edges: cut }) => save(nodes.filter((node) => !gone.some((item) => item.id === node.id)), edges.filter((edge) => !cut.some((item) => item.id === edge.id) && !gone.some((item) => item.id === edge.source || item.id === edge.target)))}
        onNodeDoubleClick={(_, node) => editable && setDraft({ kind: "node", id: node.id, label: String(node.data.label ?? "") })}
        onEdgeDoubleClick={(_, edge) => editable && setDraft({ kind: "edge", id: edge.id, label: String(edge.label ?? "") })}>
        <Background/>
        <Controls showInteractive={false}/>
      </ReactFlow>
    </div>
    {!nodes.length && <p className="assign-empty">{editable ? "Diagramma vuoto: aggiungi un riquadro." : "Diagramma vuoto."}</p>}

    <Dialog open={!!draft} title={draft?.kind === "edge" ? "Modifica freccia" : draft?.id ? "Modifica riquadro" : "Nuovo riquadro"} onClose={() => setDraft(null)}>{draft && <form className="action-form" onSubmit={(event) => { event.preventDefault(); if (draft.kind === "edge" || draft.label.trim()) saveLabel(draft); }}>
      <label><span>Testo</span><Input aria-label={draft.kind === "edge" ? "Testo della freccia" : "Testo del riquadro"} autoFocus required={draft.kind === "node"} value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })}/></label>
      <div className="action-form-buttons">
        {draft.id && <Button type="button" variant="destructive" onClick={() => remove(draft)}>Elimina</Button>}
        <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Annulla</Button>
        <Button type="submit">Salva</Button>
      </div>
    </form>}</Dialog>
  </div>;
}
