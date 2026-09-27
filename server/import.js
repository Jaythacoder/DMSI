const fs = require('fs');
const path = require('path');

/**
 * Data Import Script for Menance Strain Identifier
 * Specifically configured for the cannabis-strains-final.csv dataset
 */

const DATA_PATH = path.join(__dirname, '..', 'data', 'strains.json');
const IMPORT_PATH = 'C:\\Users\\user\\Desktop\\DataSets\\Cannabis\\cannabis-strains-final.csv';

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] ? values[i].trim() : null;
    });
    return obj;
  });
}

function importData() {
  if (!fs.existsSync(IMPORT_PATH)) {
    console.error(`Error: Import file not found at ${IMPORT_PATH}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(IMPORT_PATH, 'utf8');
    const newData = parseCSV(content);
    
    let existingData = [];
    if (fs.existsSync(DATA_PATH)) {
      existingData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    }

    console.log(`Existing strains: ${existingData.length}`);
    console.log(`Source file strains: ${newData.length}`);

    const existingNames = new Set(existingData.map(s => s.name.toLowerCase()));
    const merged = [...existingData];
    let addedCount = 0;

    newData.forEach(item => {
      const name = item.strain_name;
      if (name && !existingNames.has(name.toLowerCase())) {
        merged.push({
          name: name,
          type: item.indica_sativa || 'hybrid',
          effects: item.effect ? item.effect.split(',').map(e => e.trim()) : [],
          flavors: item.flavor ? item.flavor.split(',').map(f => f.trim()) : [],
          // Pro fields
          thc: item.thc || null,
          cbd: item.cbd || null,
          lineage: item.genetic_background || null,
          description: item.description || null,
          image: item.product_url || null
        });
        existingNames.add(name.toLowerCase());
        addedCount++;
      }
    });

    fs.writeFileSync(DATA_PATH, JSON.stringify(merged, null, 2));
    console.log(`Successfully imported ${addedCount} new strains. Total: ${merged.length}`);
  } catch (err) {
    console.error('Import failed:', err);
  }
}

importData();
