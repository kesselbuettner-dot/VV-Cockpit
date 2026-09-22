'use strict';
// Einmalig Google-Sheets-CSV-Exporte importieren: Dateiname = Tabellenblattname + .csv
const fs=require('node:fs');const path=require('node:path');const {SheetStore}=require('../src/sheets');
const [dir,database]=process.argv.slice(2);
if(!dir||!database){console.error('Nutzung: node tools/import-csv.js <csv-ordner> <pfad-zur-database.json>');process.exit(2);}
function csv(text){
  const rows=[];let row=[],field='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
    else if(c==='"')quoted=true;
    else if(c===','){row.push(field);field='';}
    else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw Error('CSV enthält nicht geschlossenes Anführungszeichen');
  if(row.length||field){row.push(field);rows.push(row);}
  return rows;
}
const store=new SheetStore(database);const files=fs.readdirSync(dir).filter(f=>f.toLowerCase().endsWith('.csv'));
if(!files.length)throw Error('Keine CSV-Dateien im angegebenen Ordner.');
for(const file of files){const name=path.basename(file,'.csv');const rows=csv(fs.readFileSync(path.join(dir,file),'utf8'));store.state.sheets[name]=rows;store.mark();console.log('Importiert:',name,rows.length,'Zeilen');}
store.save();console.log('Fertig. Bestehende Tabellen gleichen Namens wurden ersetzt.');
