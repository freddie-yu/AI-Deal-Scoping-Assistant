import type { ArtifactSection } from '../domain/artifacts.js';
import { AWS_CATALOG, isServiceKey } from './catalog.js';
// Emit only a safe label alphabet. No directives, HTML, links or Mermaid code from a provider.
const label = (value: string) => value.replace(/[^\p{L}\p{N} _.,:/()-]/gu, ' ').slice(0, 150);
export function buildDiagram(sections: ArtifactSection[]) {
  const components = sections.filter(s => s.payload.kind === 'ArchitectureComponent').sort((a, b) => a.id.localeCompare(b.id));
  const nodes = components.map(s => { const p = s.payload; if (p.kind !== 'ArchitectureComponent' || !isServiceKey(p.catalogServiceKey)) throw new Error('Invalid architecture component'); return { id: s.id, label: `${p.name} / ${AWS_CATALOG[p.catalogServiceKey].name}`, external: false }; });
  const edges: { from: string; to: string; description: string }[] = [];
  const external = new Map<string, string>();
  for (const s of components) if (s.payload.kind === 'ArchitectureComponent') for (const connection of s.payload.connections) {
    const ends = [connection.from, connection.to].map(e => {
      if (e.kind === 'COMPONENT') { if (!components.some(c => c.id === e.sectionId)) throw new Error('Connection references an unavailable component'); return e.sectionId; }
      let id = external.get(e.name); if (!id) { id = `EXT_${external.size + 1}`; external.set(e.name, id); nodes.push({ id, label: e.name, external: true }); } return id;
    });
    edges.push({ from: ends[0]!, to: ends[1]!, description: connection.description });
  }
  const source = ['flowchart LR', ...nodes.map(n => `  ${n.id}["${label(n.label)}"]${n.external ? ':::external' : ''}`), ...edges.map(e => `  ${e.from} -->|"${label(e.description)}"| ${e.to}`), '  classDef external fill:#eef2ff,stroke:#64748b,stroke-dasharray:5 5'].join('\n');
  return { source, nodes, edges };
}
