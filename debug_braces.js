
import fs from 'fs';

const content = fs.readFileSync('c:/hostel-bite/frontend/src/app/page.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
lines.forEach((line, i) => {
  const lineNum = i + 1;
  for (let char of line) {
    if (char === '{') stack.push({ lineNum, char: '{' });
    if (char === '}') {
      if (stack.length > 0 && stack[stack.length - 1].char === '{') {
        stack.pop();
      } else {
        console.log(`Extra } at line ${lineNum}: ${line.trim()}`);
      }
    }
  }
});

console.log(`Unclosed { : ${stack.length}`);
stack.forEach(s => console.log(`Unclosed { from line ${s.lineNum}`));
