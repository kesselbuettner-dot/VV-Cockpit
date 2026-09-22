'use strict';
const fs = require('node:fs');
const path = require('node:path');

function decodeDate(k, v) {
  if (v && typeof v === 'object' && v.__gasDate && typeof v.__gasDate === 'string') return new Date(v.__gasDate);
  return v;
}
function encodeDate(k, v) {
  if (this[k] instanceof Date) return {__gasDate: this[k].toISOString()};
  return v;
}
function clone(value) { return JSON.parse(JSON.stringify(value, encodeDate), decodeDate); }

class SheetStore {
  constructor(filename) {
    this.filename = filename;
    fs.mkdirSync(path.dirname(filename), {recursive: true, mode: 0o700});
    this.state = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8'), decodeDate) : {sheets: {}, properties: {}};
    if (!this.state.sheets || typeof this.state.sheets !== 'object' || Array.isArray(this.state.sheets)) throw new Error('Ungültige Datenbankdatei.');
    this.state.properties ||= {};
    this.dirty = false;
  }
  mark() {this.dirty = true;}
  save() {
    if (!this.dirty) return;
    const temp = `${this.filename}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.state, encodeDate), {mode: 0o600});
    fs.renameSync(temp, this.filename);
    this.dirty = false;
  }
  spreadsheet() { return new Spreadsheet(this); }
}
class Spreadsheet {
  constructor(store) { this.store = store; }
  getName() { return 'VV-Cockpit'; }
  getSheetByName(name) { return Object.hasOwn(this.store.state.sheets, name) ? new Sheet(this.store, name) : null; }
  insertSheet(name) {
    if (!name || this.getSheetByName(name)) throw new Error('Tabellenblatt bereits vorhanden oder ungültig: ' + name);
    this.store.state.sheets[name] = []; this.store.mark(); return new Sheet(this.store, name);
  }
  getSheets() { return Object.keys(this.store.state.sheets).map(k => this.getSheetByName(k)); }
}
class Sheet {
  constructor(store, name) { this.store=store; this.name=name; }
  rows() { return this.store.state.sheets[this.name]; }
  getName() {return this.name;}
  getLastRow() {
    const rows=this.rows();
    for (let i=rows.length-1;i>=0;i--) if ((rows[i]||[]).some(v=>v!==''&&v!==null&&v!==undefined)) return i+1;
    return 0;
  }
  getLastColumn() {
    return this.rows().reduce((max,row)=>Math.max(max,(row||[]).reduce((m,v,i)=>v!==''&&v!==null&&v!==undefined?i+1:m,0)),0);
  }
  getMaxRows(){return Math.max(1000,this.rows().length);}
  getMaxColumns(){return Math.max(26,this.getLastColumn());}
  getDataRange(){return this.getRange(1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn()));}
  getRange(row,col,numRows=1,numCols=1) {
    for(const n of [row,col,numRows,numCols]) if (!Number.isInteger(n)||n<1) throw new Error('Ungültiger Zellbereich');
    if(numRows*numCols>1000000) throw new Error('Zellbereich zu groß');
    return new Range(this.store,this.name,row,col,numRows,numCols);
  }
  appendRow(values) {if(!Array.isArray(values))throw new Error('appendRow erwartet Array');this.getRange(this.getLastRow()+1,1,1,Math.max(1,values.length)).setValues([values.length?values:['']]);return this;}
  deleteRow(index) {if(!Number.isInteger(index)||index<1)throw new Error('Ungültige Zeile');this.rows().splice(index-1,1);this.store.mark();return this;}
  insertColumnsAfter(){return this;}
  setFrozenRows(){return this;}
}
class Range {
  constructor(store,name,row,col,nr,nc){Object.assign(this,{store,name,row,col,nr,nc});}
  rows(){return this.store.state.sheets[this.name];}
  getRow(){return this.row;}
  getColumn(){return this.col;}
  getSheet(){return new Sheet(this.store,this.name);}
  getValues() {
    return Array.from({length:this.nr},(_,r)=>Array.from({length:this.nc},(_,c)=>{
      const v=this.rows()[this.row+r-1]?.[this.col+c-1];return v===undefined||v===null?'':clone(v);
    }));
  }
  getDisplayValues(){return this.getValues().map(row=>row.map(v=>v instanceof Date?v.toISOString():String(v)));}
  getValue(){return this.getValues()[0][0];}
  setValues(values) {
    if(!Array.isArray(values)||values.length!==this.nr||values.some(r=>!Array.isArray(r)||r.length!==this.nc))throw new Error('Dimensionen von setValues stimmen nicht überein');
    for(let r=0;r<this.nr;r++){
      const i=this.row+r-1;this.rows()[i]||=[];
      for(let c=0;c<this.nc;c++)this.rows()[i][this.col+c-1]=clone(values[r][c]===undefined?'':values[r][c]);
    }
    this.store.mark();return this;
  }
  setValue(value){return this.setValues([[value]]);}
  clearContent(){for(let r=0;r<this.nr;r++){const i=this.row+r-1;if(!this.rows()[i])continue;for(let c=0;c<this.nc;c++)this.rows()[i][this.col+c-1]='';}this.store.mark();return this;}
  setFontWeight(){return this;}
  setDataValidation(){return this;}
}
module.exports={SheetStore,clone};
