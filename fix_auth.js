const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const targetPattern = /const supabase = createServerClient\([\s\S]*?process\.env\.NEXT_PUBLIC_SUPABASE_URL![,\s]+process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY![,\s]+\{[\s\S]*?cookies: {[\s\S]*?get\(name: string\) \{.*?return cookieStore\.get\(name\)\?\.value.*?\}[\s\S]*?remove\(name: string, options: CookieOptions\) \{[\s\S]*?try \{ cookieStore\.set\(\{ name, value: '', \.\.\.options \}\) \} catch \(error\) \{ \}[\s\S]*?\}[\s\S]*?\}[,\s]*\}[,\s]*\)/g;

const targetPattern2 = /const supabase = createServerClient\([\s\S]*?process\.env\.NEXT_PUBLIC_SUPABASE_URL![,\s]+process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY![,\s]+\{[\s\S]*?cookies: \{[\s\S]*?get\(name: string\) [\s\S]*?remove\(name: string, options: CookieOptions\) [\s\S]*?\}[\s\S]*?\}[,\s]*\}[,\s]*\)/g;

const exactPattern = /const\s+supabase\s*=\s*createServerClient\([\s\S]*?cookies:\s*\{[\s\S]*?get\([^)]*\)\s*\{[^}]*\}[\s\S]*?set\([^)]*\)\s*\{[^}]*\}[\s\S]*?remove\([^)]*\)\s*\{[^}]*\}[^\}]*\}[\s\S]*?\}\s*\)/gm;

const replacement = `const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )`;


walkDir('c:/Users/laksh/doitforme1/app/api', function(filePath) {
  if (filePath.endsWith('route.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('cookieStore.get(name)?.value')) {
       // It's easier to just match from createServerClient( until the closing ).
       // Wait, regex might be tricky. Let's do string bounds:
       let startIdx = content.indexOf('const supabase = createServerClient');
       if (startIdx === -1) {
          startIdx = content.indexOf('const supabase = await createServerClient');
       }
       if (startIdx !== -1) {
           let endIdx = content.indexOf(')', startIdx); // This might match the wrong ), let's find the closing ) after cookies
           // Since the format is fairly standard, let's use exactPattern
           let newContent = content.replace(exactPattern, replacement);
           if (newContent !== content) {
               console.log('Fixed', filePath);
               fs.writeFileSync(filePath, newContent, 'utf8');
           } else {
               console.log('Failed to match exact pattern in', filePath);
           }
       }
    }
  }
});
