import React, { useEffect, useId, useRef, useState } from 'react';
import { buildDiagram } from '../../architecture/diagram.js';
import type { ArtifactSection } from '../../domain/index.js';
export function ArchitectureDiagram({ sections, onRender }: { sections: ArtifactSection[]; onRender?: (success: boolean | null) => void }) {
  const container = useRef<HTMLDivElement>(null); const id = useId().replace(/[^a-zA-Z0-9]/g, ''); const [error, setError] = useState('');
  let diagram: ReturnType<typeof buildDiagram>;
  try { diagram = buildDiagram(sections); } catch {
    // A rejected dependency can leave a proposal incomplete. Keep the structured
    // inventory inspectable even when the remaining graph cannot be rendered.
    diagram = { source: '', nodes: sections.flatMap(a => a.payload.kind === 'ArchitectureComponent' ? [{ id: a.id, label: `${a.payload.name} / ${a.payload.catalogServiceKey}`, external: false }] : []), edges: sections.flatMap(a => a.payload.kind === 'ArchitectureComponent' ? a.payload.connections.map(c => ({ from: c.from.kind === 'COMPONENT' ? c.from.sectionId : c.from.name, to: c.to.kind === 'COMPONENT' ? c.to.sectionId : c.to.name, description: c.description })) : []) };
  }
  const source = diagram.source;
  useEffect(() => {
    let current = true; setError(''); container.current?.replaceChildren(); onRender?.(null);
    if (!source) { setError('A referenced component is unavailable. Review the remaining components and connections below, then regenerate or reject dependent proposals.'); onRender?.(false); return; }
    if (!diagram.nodes.length) { onRender?.(false); return; }
    void import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false, flowchart: { htmlLabels: false, useMaxWidth: true }, theme: 'neutral' });
      const { svg } = await mermaid.render(`architecture${id}`, source);
      if (current && container.current) {
        const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
        parsed.querySelectorAll('script,foreignObject,a').forEach(el => el.remove());
        parsed.querySelectorAll('*').forEach(el => { for (const attribute of Array.from(el.attributes)) if (/^on/i.test(attribute.name) || /href$/i.test(attribute.name)) el.removeAttribute(attribute.name); });
        container.current.replaceChildren(document.importNode(parsed.documentElement, true));
        onRender?.(true);
      }
    }).catch(() => { if (current) { setError('Diagram rendering unavailable. Inspect the component and connection tables below.'); onRender?.(false); } });
    return () => { current = false; };
  }, [source, id, onRender]);
  return <section className="panel"><h3>Customer solution architecture</h3><p className="muted">Derived from validated AWS components and connections. Dashed nodes are external systems.</p>{error && <p role="alert">{error}</p>}<div className="diagram" ref={container} data-testid="architecture-diagram" aria-label="AWS architecture diagram" />
    <details open><summary>Components and connections</summary><div className="table-wrap"><table><thead><tr><th>Node</th><th>Component / AWS service</th></tr></thead><tbody>{diagram.nodes.map(n => <tr key={n.id}><td>{n.id}</td><td>{n.label}{n.external ? ' · External system' : ''}</td></tr>)}</tbody></table><table><thead><tr><th>From → To</th><th>Data flow</th></tr></thead><tbody>{diagram.edges.map((e, i) => <tr key={i}><td>{e.from} → {e.to}</td><td>{e.description}</td></tr>)}</tbody></table></div></details>
    <details><summary>Generated Mermaid source</summary><pre>{source}</pre></details></section>;
}
