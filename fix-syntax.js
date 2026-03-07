const fs = require('fs');
const file = 'c:/Users/laksh/doitforme1/app/post/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// The agent accidentally wrote \${ and \` into the file due to JSON stringification bugs in thought/tool-call boundary.
content = content.replace(/\\\${/g, '${');
content = content.replace(/\\`/g, '`');

fs.writeFileSync(file, content, 'utf8');
console.log("Syntax fixed!");
