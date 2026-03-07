const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
    fs.readdirSync(dir).forEach(file => {
        const dirFile = path.join(dir, file);
        if (fs.statSync(dirFile).isDirectory()) {
            // ignore node_modules and .next
            if (!dirFile.includes('node_modules') && !dirFile.includes('.next') && !dirFile.includes('.git')) {
                filelist = walkSync(dirFile, filelist);
            }
        } else {
            if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
                filelist.push(dirFile);
            }
        }
    });
    return filelist;
};

const files = walkSync('c:/Users/laksh/doitforme1');
let count = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Bump up ultra-low contrast texts
    content = content.replace(/text-white\/20/g, 'text-white/40');
    content = content.replace(/text-white\/30/g, 'text-white/50');
    content = content.replace(/text-white\/40/g, 'text-white/60');
    content = content.replace(/bg-white\/5/g, 'bg-white/10'); // Slightly boost card borders/bg for contrast if needed

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        count++;
    }
}

console.log(`Updated contrast classes in ${count} files.`);
