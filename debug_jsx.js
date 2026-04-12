
import fs from 'fs';

const content = fs.readFileSync('c:/hostel-bite/frontend/src/app/page.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
lines.forEach((line, i) => {
  const lineNum = i + 1;
  // Match opened tags (ignoring self-closing ones like <div />)
  const openTags = line.match(/<div(?![^>]*\/>)[^>]*>/g);
  if (openTags) {
    openTags.forEach(() => stack.push({ lineNum, line: line.trim() }));
  }
  
  const closeTags = line.match(/<\/div>/g);
  if (closeTags) {
    closeTags.forEach(() => {
      if (stack.length > 0) {
        stack.pop();
      } else {
        console.log(`Extra closing </div> at line ${lineNum}: ${line.trim()}`);
      }
    });
  }
});

console.log(`Unclosed <div> tags: ${stack.length}`);
stack.forEach(tag => console.log(`Unclosed <div> from line ${tag.lineNum}: ${tag.line}`));
