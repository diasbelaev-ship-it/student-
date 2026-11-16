const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function containsPath(directory, target) {
  const relative = path.relative(directory, target);
  return relative === '' || (!path.isAbsolute(relative) && relative.split(path.sep)[0] !== '..');
}

function visitFiles(directory, callback, relative = '') {
  for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink())
      throw new Error('Резервная копия файлов групп не поддерживает символические ссылки.');
    if (entry.isDirectory()) visitFiles(directory, callback, name);
    else if (entry.isFile()) callback(path.join(directory, name), name);
  }
}

const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function snapshotGroupFiles(source, destination, previousDirectory) {
  fs.mkdirSync(destination, { recursive: true });
  const savedContent = new Map();
  if (previousDirectory && fs.existsSync(previousDirectory)) {
    visitFiles(previousDirectory, (file) => savedContent.set(digest(file), file));
  }
  const result = { copied: 0, linked: 0 };
  visitFiles(source, (file, relative) => {
    const target = path.join(destination, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const hash = digest(file);
    const previous = savedContent.get(hash);
    if (previous) {
      try {
        // Link snapshots to other snapshots, never to the mutable live upload.
        fs.linkSync(previous, target);
        result.linked++;
      } catch (error) {
        if (!['EXDEV', 'EPERM', 'EACCES', 'ENOTSUP', 'EMLINK'].includes(error.code)) throw error;
        fs.copyFileSync(file, target);
        result.copied++;
      }
    } else {
      fs.copyFileSync(file, target);
      result.copied++;
    }
    savedContent.set(hash, target);
  });
  return result;
}

function copyGroupFiles(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  visitFiles(source, (file, relative) => {
    const target = path.join(destination, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  });
}

module.exports = { containsPath, snapshotGroupFiles, copyGroupFiles };
