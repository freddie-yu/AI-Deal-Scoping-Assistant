import React from 'react';
const decode = (s: string) => s.replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** Displays only our deterministic Markdown subset. React text nodes keep all
 * customer content inert; no HTML parser, links, images or active SVG. */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n'), blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const code: string[] = []; i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) code.push(lines[i++]!);
      i++; blocks.push(<div className="package-code" key={i}><p>Mermaid source · component and connection tables follow</p><pre>{code.join('\n')}</pre></div>); continue;
    }
    if (line.startsWith('| ')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.startsWith('| ')) { const cells = lines[i++]!.split('|').slice(1,-1).map(x => decode(x.trim())); if (!cells.every(x => x === '---')) rows.push(cells); }
      blocks.push(<div className="table-scroll" tabIndex={0} key={i}><table><thead><tr>{rows[0]?.map((v,j) => <th key={j}>{v}</th>)}</tr></thead><tbody>{rows.slice(1).map((r,j) => <tr key={j}>{r.map((v,k) => <td key={k}>{v}</td>)}</tr>)}</tbody></table></div>); continue;
    }
    if (line.startsWith('### ')) blocks.push(<h4 key={i}>{decode(line.slice(4))}</h4>);
    else if (line.startsWith('- ')) blocks.push(<p key={i}>• {decode(line.slice(2))}</p>);
    else blocks.push(<p key={i}>{decode(line)}</p>);
    i++;
  }
  return <div className="package-markdown">{blocks}</div>;
}

