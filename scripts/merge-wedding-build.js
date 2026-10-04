const fs = require('fs');
const path = require('path');
const source = path.resolve('wedding-site/build');
const target = path.resolve('build/weddingsite');
if (!fs.existsSync(path.join(source, 'index.html'))) throw new Error('Wedding build is missing');
fs.cpSync(source, target, {recursive:true});
console.log('Wedding archive included in the deployable website');
