const fs = require('fs');
let content = fs.readFileSync('.jules/bolt.md', 'utf8');

const conflictPattern = /<<<<<<< HEAD\n(2024-05-13 — Fix root slash path mapping bug[\s\S]*?)=======\n([\s\S]*?)>>>>>>> origin\/master/m;

const match = content.match(conflictPattern);
if (match) {
  // Take the new additions from master, ignoring the duplicate 'Fix Root Path Trimming' entry which is essentially the same as HEAD.
  const newContent = match[2].replace(/## \$\(date \+%Y-%m-%d\) — Fix Root Path Trimming[\s\S]*?Action:\s*.*?\n/m, '');
  content = content.replace(conflictPattern, match[1] + '\n' + newContent);
  fs.writeFileSync('.jules/bolt.md', content);
  console.log('Conflict resolved.');
} else {
  console.log('Conflict not found.');
}
