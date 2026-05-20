const fs = require('fs');
let content = fs.readFileSync('tests/test.js', 'utf8');

const conflictPattern = /<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> origin\/master/m;

const match = content.match(conflictPattern);
if (match) {
  content = content.replace(conflictPattern, match[1]);
  fs.writeFileSync('tests/test.js', content);
  console.log('Conflict resolved.');
} else {
  console.log('Conflict not found.');
}
