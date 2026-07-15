const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value.trim();
    }
  });
}

async function main() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
  const key = process.env.SUPABASE_SECRET_KEY;
  
  console.log("Fetching OpenAPI description from PostgREST...");
  
  try {
    const response = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Accept-Profile': 'nafaflow'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const schema = await response.json();
    console.log("Tables found in nafaflow schema:");
    const paths = Object.keys(schema.paths || {});
    const tables = new Set();
    paths.forEach(p => {
      const parts = p.split('/');
      if (parts[1]) {
        tables.add(parts[1]);
      }
    });
    console.log(Array.from(tables));
    
    console.log("\nDetails for each table structure:");
    if (schema.definitions) {
      Object.keys(schema.definitions).forEach(tableName => {
        console.log(`\nTable: ${tableName}`);
        const definition = schema.definitions[tableName];
        if (definition.properties) {
          Object.keys(definition.properties).forEach(propName => {
            const prop = definition.properties[propName];
            console.log(`  - ${propName}: ${prop.type} (${prop.format || ''})`);
          });
        }
      });
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
