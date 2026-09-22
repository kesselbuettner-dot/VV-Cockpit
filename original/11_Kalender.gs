// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// 11_Kalender.gs
// =====================================================
//
// Kalender-Modul.
//
// Es ist aktuell keine bestehende Kalender-Anbindung
// vorhanden. Dieses Modul stellt deshalb die Grundlage
// für die spätere Google-Kalender-Anbindung bereit.
//
// Aufgaben:
// - Kalenderdaten vorbereiten
// - Dienste als Kalendereinträge aufbereiten
// - Zeitraum und Titel festlegen
// - später Google-Kalender-Einträge erstellen/löschen
//
// WICHTIG:
// Dieses Modul erstellt momentan noch KEINE echten
// Google-Kalender-Einträge. Dadurch werden beim Einbau
// keine unbeabsichtigten Termine erzeugt.
//
// =====================================================


// =====================================================
// KALENDER-EINSTELLUNGEN
// =====================================================

function kalenderEinstellungen() {

  return {

    enabled: false,

    calendarId: '',

    calendarName:
      'FF Holzhausen',

    timezone:
      Session.getScriptTimeZone(),

    durationMinutes:
      30

  };

}


// =====================================================
// KALENDER-DATEN FÜR EINEN DIENST ERZEUGEN
// =====================================================

function kalenderDienstDaten(
  nr,
  zeit,
  station,
  datum
) {

  const nummer =
    Number(nr);

  if (
    !Number.isFinite(nummer) ||
    nummer <= 0
  ) {

    throw new Error(
      'Ungültige Helfer-Nr.'
    );

  }


  const time =
    String(
      zeit || ''
    ).trim();


  if (
    !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)
  ) {

    throw new Error(
      'Ungültige Uhrzeit.'
    );

  }


  const stationName =
    String(
      station || ''
    ).trim();


  if (!stationName) {

    throw new Error(
      'Keine Station angegeben.'
    );

  }


  const helper =
    dbGetHelpers()
      .find(
        h =>
          Number(h.nr) === nummer
      );


  if (!helper) {

    throw new Error(
      'Helfer Nr. ' +
      nummer +
      ' wurde nicht gefunden.'
    );

  }


  const dateValue =
    datum
      ? new Date(datum)
      : new Date();


  if (
    isNaN(
      dateValue.getTime()
    )
  ) {

    throw new Error(
      'Ungültiges Datum.'
    );

  }


  const parts =
    time.split(':');


  dateValue.setHours(
    Number(parts[0]),
    Number(parts[1]),
    0,
    0
  );


  const end =
    new Date(
      dateValue.getTime() +
      30 * 60 * 1000
    );


  return {

    nr:
      nummer,

    name:
      (
        helper.vorname +
        ' ' +
        helper.nachname
      ).trim(),

    station:
      stationName,

    start:
      dateValue,

    end:
      end,

    title:
      'Dienst – ' +
      stationName,

    description:
      (
        'FF Holzhausen\n' +
        'Helfer: ' +
        (
          helper.vorname +
          ' ' +
          helper.nachname
        ).trim() +
        '\nStation: ' +
        stationName
      )

  };

}


// =====================================================
// KALENDER-DATEN AUS EINEM RASTERPLAN ERZEUGEN
// =====================================================
//
// Liefert nur Daten zurück.
// Es werden noch keine Kalendertermine erstellt.
//
// =====================================================

function kalenderPlanDaten(
  plan,
  datum
) {

  const result = [];


  if (
    !plan ||
    typeof plan !== 'object'
  ) {

    return result;

  }


  Object.keys(
    plan
  )
  .forEach(
    nr => {

      const raster =
        plan[nr] || {};


      Object.keys(
        raster
      )
      .sort()
      .forEach(
        zeit => {

          const station =
            String(
              raster[zeit] || ''
            ).trim();


          if (!station) {

            return;

          }


          result.push(
            kalenderDienstDaten(
              Number(nr),
              zeit,
              station,
              datum
            )
          );

        }
      );

    }
  );


  return result;

}


// =====================================================
// KALENDER-STATUS
// =====================================================

function kalenderStatus() {

  const settings =
    kalenderEinstellungen();


  let calendar = null;


  if (
    settings.enabled &&
    settings.calendarId
  ) {

    try {

      calendar =
        CalendarApp.getCalendarById(
          settings.calendarId
        );

    }
    catch (error) {

      calendar = null;

    }

  }


  return {

    enabled:
      settings.enabled,

    calendarId:
      settings.calendarId,

    calendarName:
      settings.calendarName,

    timezone:
      settings.timezone,

    available:
      !!calendar

  };

}


// =====================================================
// VERFÜGBARE KALENDER AUFLISTEN
// =====================================================
//
// Nur Vorbereitung für die spätere Admin-Oberfläche.
//
// =====================================================

function kalenderListe() {

  const calendars =
    CalendarApp
      .getAllCalendars();


  return calendars.map(
    calendar => ({

      id:
        calendar.getId(),

      name:
        calendar.getName(),

      description:
        calendar.getDescription()

    })
  );

}


// =====================================================
// KALENDER-TEST
// =====================================================
//
// Prüft nur, ob die Kalender-API erreichbar ist.
// Es wird kein Termin angelegt.
//
// =====================================================

function kalenderTest() {

  try {

    const calendars =
      CalendarApp
        .getAllCalendars();


    return {

      ok: true,

      anzahl:
        calendars.length,

      timezone:
        Session.getScriptTimeZone()

    };

  }
  catch (error) {

    return {

      ok: false,

      error:
        String(
          error.message ||
          error
        )

    };

  }

}


// =====================================================
// KALENDER-VORSCHAU
// =====================================================
//
// Erstellt eine Vorschau der Termine, ohne sie zu
// speichern.
//
// =====================================================

function kalenderVorschau(
  plan,
  datum
) {

  const entries =
    kalenderPlanDaten(
      plan,
      datum
    );


  return {

    ok: true,

    count:
      entries.length,

    entries:
      entries

  };

}

// =====================================================
// ERWEITERUNG: HELFERVERSAND / MAILVORLAGEN / ICS / PDF
// =====================================================

function kalenderMailVorlagenLaden(password) {
  if (!getRole(password)) throw new Error('Falsches Passwort.');
  const ss = dbGetSpreadsheet();
  let sheet = ss.getSheetByName('Einstellungen');
  const result = {
    betreff: 'Dein Dienst bei {Veranstaltung} am {Datum}',
    text: 'Hallo {Vorname},\n\nhier sind deine Unterlagen für {Veranstaltung} am {Datum}.\nDein erster Dienst: {Uhrzeit} an {Dienst} bis {Bis}.\n\nViele Grüße'
  };
  if (!sheet || sheet.getLastRow() < 1) return result;
  const rows = sheet.getRange(1,1,sheet.getLastRow(),2).getValues();
  rows.forEach(r=>{
    const k=String(r[0]||'').trim();
    if(k==='MailBetreff') result.betreff=String(r[1]||'');
    if(k==='MailText') result.text=String(r[1]||'');
  });
  return result;
}

function kalenderMailVorlagenSpeichern(password, betreff, text) {
  if (getRole(password) !== 'admin') throw new Error('Nur der Admin darf Mailvorlagen speichern.');
  const ss=dbGetSpreadsheet();
  let sheet=ss.getSheetByName('Einstellungen');
  if(!sheet) { sheet=ss.insertSheet('Einstellungen'); sheet.getRange(1,1,1,2).setValues([['Einstellung','Wert']]); }
  const values=sheet.getLastRow()?sheet.getRange(1,1,sheet.getLastRow(),2).getValues():[];
  const setKey=(key,val)=>{
    for(let i=1;i<values.length;i++){
      if(String(values[i][0]||'').trim()===key){ sheet.getRange(i+1,2).setValue(val); return; }
    }
    sheet.appendRow([key,val]);
  };
  setKey('MailBetreff',String(betreff||''));
  setKey('MailText',String(text||''));
  SpreadsheetApp.flush();
  return kalenderMailVorlagenLaden(password);
}

function kalenderPlanHelfer_(password, datum, nr) {
  const tag=tagesplanDatum_(datum);
  if(!tag) throw new Error('Ungültiges Veranstaltungsdatum.');
  const data=dienstplanungTagesLaden(password,tag);
  const p=data && data.plan ? data.plan[String(Number(nr))] : null;
  return p && p.raster ? p.raster : {};
}

function kalenderDienstBloecke_(raster) {
  const keys=Object.keys(raster||{}).filter(k=>/^\d{1,2}:\d{2}$/.test(k)).sort();
  const blocks=[];
  keys.forEach(t=>{
    const station=String(raster[t]||'').trim(); if(!station)return;
    const m=dienstplanungZeitMinuten_(t);
    const prev=blocks[blocks.length-1];
    if(prev && prev.station===station && prev.bisMin===m){ prev.bisMin=m+30; prev.bis=minutesToTime(prev.bisMin); }
    else blocks.push({von:t,vonMin:m,bisMin:m+30,bis:minutesToTime(m+30),station:station});
  });
  return blocks;
}

function kalenderIcsEscape_(v){ return String(v||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n'); }
function kalenderDateTime_(datum, zeit){
  const m=String(datum||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); const t=String(zeit||'').match(/^(\d{1,2}):(\d{2})$/);
  if(!m||!t)return '';
  return m[1]+m[2]+m[3]+'T'+String(Number(t[1])).padStart(2,'0')+t[2]+'00';
}

function kalenderIcsErzeugen_(helper, datum, blocks, veranstaltung) {
  const now=new Date();
  const stamp=Utilities.formatDate(now,'UTC',"yyyyMMdd'T'HHmmss'Z'");
  let out='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//FF Holzhausen//Helferplanung//DE\r\nCALSCALE:GREGORIAN\r\n';
  blocks.forEach((b,i)=>{
    out+='BEGIN:VEVENT\r\nUID:'+kalenderIcsEscape_('ffh-'+datum+'-'+helper.nr+'-'+i+'-'+b.vonMin)+'@ff-holzhausen'+'\r\n';
    out+='DTSTAMP:'+stamp+'\r\nDTSTART:'+kalenderDateTime_(datum,b.von)+'\r\nDTEND:'+kalenderDateTime_(datum,b.bis)+'\r\n';
    out+='SUMMARY:'+kalenderIcsEscape_(veranstaltung+' – Dienst: '+b.station)+'\r\nDESCRIPTION:'+kalenderIcsEscape_('Helfer: '+helper.vorname+' '+helper.nachname+' | Station: '+b.station)+'\r\nEND:VEVENT\r\n';
  });
  return out+'END:VCALENDAR\r\n';
}

function kalenderPdfErzeugen_(titel, rows, breite) {
  const doc=DocumentApp.create(titel);
  const body=doc.getBody();
  body.appendParagraph(titel).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  const table=body.appendTable(rows.map(r=>r.map(v=>String(v==null?'':v))));
  table.getRow(0).editAsText().setBold(true);
  doc.saveAndClose();
  const file=DriveApp.getFileById(doc.getId());
  const blob=file.getAs(MimeType.PDF).setName(titel.replace(/[^a-zA-Z0-9ÄÖÜäöüß _-]/g,'_')+'.pdf');
  file.setTrashed(true);
  return blob;
}

function kalenderTemplateEinsetzen_(text, helper, veranstaltung, datum, blocks) {
  const first=blocks[0]||{}; const last=blocks[blocks.length-1]||{};
  const vals={
    '{Helfername}':(helper.vorname+' '+helper.nachname).trim(),
    '{Vorname}':String(helper.vorname||''),
    '{Nachname}':String(helper.nachname||''),
    '{Veranstaltung}':String(veranstaltung||''),
    '{Datum}':String(datum||''),
    '{Uhrzeit}':String(first.von||''),
    '{Dienst}':String(first.station||''),
    '{Bis}':String(last.bis||'')
  };
  let s=String(text||''); Object.keys(vals).forEach(k=>s=s.split(k).join(vals[k])); return s;
}

function kalenderVersand(password, typ, datum, nrs) {
  const role=getRole(password); if(role!=='admin') throw new Error('Nur der Admin darf Unterlagen versenden.');
  const tag=tagesplanDatum_(datum); if(!tag) throw new Error('Kein gültiger Veranstaltungstag ausgewählt.');
  const ids=Array.isArray(nrs)?nrs.map(Number).filter(Boolean):[]; if(!ids.length) throw new Error('Keine Helfer ausgewählt.');
  const meta=ablaufplanLaden(password); const veranstaltung=meta&&meta.meta?String(meta.meta.veranstaltung||'FF Holzhausen'): 'FF Holzhausen';
  const vorlagen=kalenderMailVorlagenLaden(password); let sent=0;
  const allHelpers=dbGetHelpers();
  ids.forEach(nr=>{
    const h=allHelpers.find(x=>Number(x.nr)===nr); if(!h||!String(h.email||'').trim()) return;
    const raster=kalenderPlanHelfer_(password,tag,nr); const blocks=kalenderDienstBloecke_(raster); if(!blocks.length)return;
    const subject=kalenderTemplateEinsetzen_(vorlagen.betreff,h,veranstaltung,tag,blocks);
    const body=kalenderTemplateEinsetzen_(vorlagen.text,h,veranstaltung,tag,blocks);
    const attachments=[];
    if(typ==='calendar'){
      attachments.push(Utilities.newBlob(kalenderIcsErzeugen_(h,tag,blocks,veranstaltung),'text/calendar', 'Dienst_'+tag+'.ics'));
    } else if(typ==='helferplan'){
      const rows=[['Datum','Von','Bis','Station']]; blocks.forEach(b=>rows.push([tag,b.von,b.bis,b.station]));
      attachments.push(kalenderPdfErzeugen_('Helferplan '+h.vorname+' '+h.nachname,rows));
    } else if(typ==='dienstplan'){
      const data=dienstplanungTagesLaden(password,tag); const rows=[['Helfer','Von','Bis','Station']];
      Object.keys(data.plan||{}).forEach(id=>{const hh=allHelpers.find(x=>Number(x.nr)===Number(id)); kalenderDienstBloecke_(data.plan[id]&&data.plan[id].raster||{}).forEach(b=>rows.push([hh?hh.vorname+' '+hh.nachname:id,b.von,b.bis,b.station]));});
      attachments.push(kalenderPdfErzeugen_('Dienstplan '+tag,rows));
    } else throw new Error('Unbekannter Versandtyp: '+typ);
    MailApp.sendEmail({to:String(h.email).trim(),subject:subject||'Dienstplan',body:body||'',attachments:attachments}); sent++;
  });
  return {ok:true,anzahl:sent,message:'Versand abgeschlossen.'};
}
