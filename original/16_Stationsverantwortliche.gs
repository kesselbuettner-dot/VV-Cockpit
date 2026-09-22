/** Mehrfachverantwortliche je Station; getrenntes Blatt schützt bestehende Stationsspalten. */
function ffhVerantwortlicheBlatt_(){
  const ss=dbGetSpreadsheet();
  let sh=ss.getSheetByName('Stationsverantwortliche');
  if(!sh){sh=ss.insertSheet('Stationsverantwortliche');sh.getRange(1,1,1,2).setValues([['Stationszeile','Helfer-IDs (JSON)']]);}
  return sh;
}
function ffhVerantwortlicheLaden(password){
  if(!getRole(password))throw new Error('Keine Berechtigung.');
  const sh=ffhVerantwortlicheBlatt_();const result={};
  if(sh.getLastRow()<2)return result;
  sh.getRange(2,1,sh.getLastRow()-1,2).getValues().forEach(r=>{
    try{const ids=JSON.parse(String(r[1]||'[]'));if(Array.isArray(ids))result[String(r[0])]=ids.map(String);}catch(e){}
  });return result;
}
function ffhVerantwortlicheSpeichern(password,stationRow,helperIds){
  if(getRole(password)!=='admin')throw new Error('Nur Admin darf Verantwortliche ändern.');
  const row=Number(stationRow);if(!Number.isInteger(row)||row<2)throw new Error('Ungültige Stationszeile.');
  const stations=dbGetStations();if(!stations.some(s=>Number(s.row)===row))throw new Error('Station nicht gefunden.');
  if(!Array.isArray(helperIds))throw new Error('Ungültige Helferauswahl.');
  const ids=[...new Set(helperIds.map(String).filter(id=>/^\d+$/.test(id)))];
  const sh=ffhVerantwortlicheBlatt_();const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const count=sh.getLastRow()-1;
    const rows=count>0?sh.getRange(2,1,count,1).getValues():[];
    const idx=rows.findIndex(r=>Number(r[0])===row);
    const target=idx<0?sh.getLastRow()+1:idx+2;
    sh.getRange(target,1,1,2).setValues([[row,JSON.stringify(ids)]]);
    return {row:row,helperIds:ids};
  }finally{lock.releaseLock();}
}
