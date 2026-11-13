// 검색 로봇용 정적 내용 갱신: 각 페이지를 실제로 실행해 #dc-root 안에 결과 HTML을 다시 써 넣는다.
// 사용: (jsdom 설치된 폴더에서) node tools/prerender.mjs [--check] index.html about.html schedule.html instructors.html
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const check = args.includes('--check');
const files = args.filter((a) => !a.startsWith('--'));
const norm = (s) => s.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
let bad = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lite = fs.readFileSync(path.join(path.dirname(file), 'dc-lite.js'), 'utf8');
  // 외부 스크립트(분석 코드 등)는 불러오지 않고, dc-lite.js만 인라인으로 넣어 실행한다.
  const html = src.replace('<script src="dc-lite.js"></script>', '<script>' + lite + '</script>');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://rhythmheartz.com/' + path.basename(file), pretendToBeVisual: true });
  const root = dom.window.document.getElementById('dc-root');
  if (!root || !dom.window.document.getElementById('dc-tpl')) { console.log(file, '- 건너뜀 (dc-root/dc-tpl 없음)'); continue; }
  const rendered = root.innerHTML;
  if (rendered.includes('{{')) { console.error(file, '- 실패: 치환 안 된 {{ }} 남음'); bad++; continue; }
  const a = src.indexOf('<div id="dc-root">');
  const b = src.indexOf('<template id="dc-tpl">');
  if (a < 0 || b < 0) { console.error(file, '- 실패: 표식을 찾지 못함'); bad++; continue; }
  const before = src.slice(a, b);
  const close = before.lastIndexOf('</div>');
  const current = before.slice('<div id="dc-root">'.length, close);
  const same = norm(current) === norm(rendered);
  if (check) { console.log(file, same ? '- 최신' : '- 다름 (갱신 필요)'); if (!same) bad++; continue; }
  if (same) { console.log(file, '- 변경 없음'); continue; }
  const out = src.slice(0, a) + '<div id="dc-root">\n' + rendered.trim() + '\n</div>\n' + src.slice(b);
  fs.writeFileSync(file, out);
  console.log(file, '- 갱신');
  dom.window.close();
}
process.exit(bad ? 1 : 0);
