const fs = require('fs');
const path = require('path');

// Función para optimizar CSS eliminando espacios en blanco y comentarios
function optimizeCSS(cssContent) {
  return cssContent
    // Eliminar comentarios
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Eliminar espacios en blanco innecesarios
    .replace(/\s+/g, ' ')
    // Eliminar espacios antes de {
    .replace(/\s*{\s*/g, '{')
    // Eliminar espacios después de }
    .replace(/\s*}\s*/g, '}')
    // Eliminar espacios antes de ;
    .replace(/\s*;\s*/g, ';')
    // Eliminar espacios antes de :
    .replace(/\s*:\s*/g, ':')
    // Eliminar espacios antes de ,
    .replace(/\s*,\s*/g, ',')
    // Eliminar espacios al inicio y final
    .trim();
}

// Función para procesar un archivo CSS
function processCSSFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const optimized = optimizeCSS(content);
    
    // Crear backup del archivo original
    const backupPath = filePath + '.backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content);
      console.log(`Backup creado: ${backupPath}`);
    }
    
    // Escribir archivo optimizado
    fs.writeFileSync(filePath, optimized);
    
    const originalSize = content.length;
    const optimizedSize = optimized.length;
    const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);
    
    console.log(`✅ ${path.basename(filePath)}: ${originalSize} → ${optimizedSize} bytes (${reduction}% reducción)`);
    
    return { originalSize, optimizedSize, reduction };
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
    return null;
  }
}

// Función para encontrar todos los archivos CSS en un directorio
function findCSSFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (item.endsWith('.css')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// Función principal
function main() {
  console.log('🚀 Iniciando optimización de CSS...\n');
  
  const srcDir = path.join(__dirname, 'src');
  const cssFiles = findCSSFiles(srcDir);
  
  if (cssFiles.length === 0) {
    console.log('No se encontraron archivos CSS para optimizar.');
    return;
  }
  
  console.log(`Encontrados ${cssFiles.length} archivos CSS:\n`);
  
  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  
  for (const file of cssFiles) {
    const result = processCSSFile(file);
    if (result) {
      totalOriginalSize += result.originalSize;
      totalOptimizedSize += result.optimizedSize;
    }
  }
  
  console.log('\n📊 Resumen de optimización:');
  console.log(`Tamaño total original: ${totalOriginalSize} bytes`);
  console.log(`Tamaño total optimizado: ${totalOptimizedSize} bytes`);
  console.log(`Reducción total: ${((totalOriginalSize - totalOptimizedSize) / totalOriginalSize * 100).toFixed(2)}%`);
  console.log(`Espacio ahorrado: ${(totalOriginalSize - totalOptimizedSize).toFixed(0)} bytes`);
  
  console.log('\n✅ Optimización completada!');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { optimizeCSS, processCSSFile, findCSSFiles }; 