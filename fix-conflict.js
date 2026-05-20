const fs = require('fs');
let content = fs.readFileSync('.jules/bolt.md', 'utf8');

const conflictPattern = /<<<<<<< HEAD\n(2024-05-13 — Fix root slash path mapping bug[\s\S]*?)=======\n(## \$\(date \+%Y-%m-%d\) — Fix Root Path Trimming[\s\S]*?)>>>>>>> origin\/master\n/m;

const match = content.match(conflictPattern);
if (match) {
  content = content.replace(conflictPattern, match[1]);
  fs.writeFileSync('.jules/bolt.md', content);
  console.log('Conflict resolved.');
} else {
  console.log('Conflict not found.');
}
