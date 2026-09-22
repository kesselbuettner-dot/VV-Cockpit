// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// 05_Dienstplan.gs
// =====================================================
//
// Automatische Dienstplan-Erstellung.
//
// NEUE VERSION:
// - internes 30-Minuten-Raster
// - automatischer Vorschlag
// - Ankunftszeiten werden berücksichtigt
// - Stationsbedarf wird berücksichtigt
// - möglichst faire Verteilung
// - maximal 3 zusammenhängende Einsatzblöcke
// - Test schreibt NICHT in den Dienstplan
//
// =====================================================


// =====================================================
// KONSTANTEN
// =====================================================

const DIENSTPLAN_RASTER = 30;

const DIENSTPLAN_MAX_BLOECKE = 3;


// =====================================================
// HAUPT-TEST
// =====================================================

function dienstplanVorschlagTest(datum) {

  console.log(
    '===== DIENSTPLAN VORSCHLAG ====='
  );


  const helpers =
    dbGetHelpers();

  const stations =
    dbGetStations();

  const settings =
    dbGetSettings();


  // ---------------------------------------------------
  // Nur Teilnehmer
  // ---------------------------------------------------

  const teilnehmer =
    helpers.filter(
      h =>
        String(
          h.teilnahme || ''
        )
        .trim()
        .toLowerCase() === 'ja'
    );


  console.log(
    'Teilnehmer: ' +
    teilnehmer.length
  );


  // ---------------------------------------------------
  // Berechnung
  // ---------------------------------------------------

  const result =
    dienstplanBerechnen(
      teilnehmer,
      stations,
      settings,
      datum
    );


  // ---------------------------------------------------
  // Stationsübersicht
  // ---------------------------------------------------

  console.log(
    '===== STATIONSÜBERSICHT ====='
  );


  result.stationen.forEach(
    station => {

      console.log(
        station.name +
        ': ' +
        station.besetzt +
        '/' +
        station.needed
      );

    }
  );


  console.log(
    'Warnungen: ' +
    result.warnings.length
  );


  result.warnings.forEach(
    warning => {

      console.log(
        'WARNUNG: ' +
        warning
      );

    }
  );


  console.log(
    '===== TEST ENDE ====='
  );


  return result;

}


// =====================================================
// STATIONSZEIT FÜR VERANSTALTUNGSTAG
// =====================================================
//
// Wenn ein Datum übergeben wird, haben die Tageszeiten der
// Station Vorrang. Ohne Tageszeiten bleibt das alte Verhalten
// als Rückwärtskompatibilität erhalten.
// =====================================================

function dienstplanStationszeit_(station, datum, settings) {

  settings = settings || {};
  const fallbackStart = dbTimeToMinutes(
    station.start || settings.start || '12:00'
  );
  const fallbackEnd = dbTimeToMinutes(
    station.end || settings.end || '22:00'
  );

  const tage = Array.isArray(station.tage) ? station.tage : [];
  const wantedDate = String(datum || '').trim();

  if (!tage.length || !wantedDate) {
    return { start: fallbackStart, end: fallbackEnd };
  }

  const day = tage.find(t =>
    String(t && t.datum || '').trim() === wantedDate
  );

  // Tageszeiten gepflegt, aber für diesen Tag kein Eintrag:
  // Station an diesem Tag nicht verfügbar.
  if (!day) {
    return { start: Infinity, end: -Infinity };
  }

  const start = dbTimeToMinutes(day.von || day.start || '');
  const end = dbTimeToMinutes(day.bis || day.end || '');

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { start: Infinity, end: -Infinity };
  }

  return { start: start, end: end };
}


// =====================================================
// DIENSTPLAN BERECHNEN
// =====================================================

function dienstplanBerechnen(
  helpers,
  stations,
  settings,
  datum
) {

  // ---------------------------------------------------
  // Zeiten
  // ---------------------------------------------------

  const start =
    dbTimeToMinutes(
      settings.start || '12:00'
    );


  const end =
    dbTimeToMinutes(
      settings.end || '22:00'
    );


  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start
  ) {

    throw new Error(
      'Ungültiger Dienstplan-Zeitraum: ' +
      settings.start +
      ' – ' +
      settings.end
    );

  }


  // Wir verwenden bewusst immer 30 Minuten.
  const step =
    DIENSTPLAN_RASTER;


  // ---------------------------------------------------
  // Helfer vorbereiten
  // ---------------------------------------------------

  const people =
    helpers.map(
      h => {

        let arrival =
          dbTimeToMinutes(
            h.ankunft
          );


        // Wenn keine Ankunft angegeben ist,
        // gilt der Dienstbeginn.
        if (
          !Number.isFinite(arrival)
        ) {

          arrival =
            start;

        }


        arrival =
          Math.max(
            arrival,
            start
          );


        return {

          nr:
            Number(h.nr),

          row:
            Number(h.row),

          name:
            (
              String(
                h.vorname || ''
              ) +
              ' ' +
              String(
                h.nachname || ''
              )
            ).trim(),

          vorname:
            String(
              h.vorname || ''
            ).trim(),

          nachname:
            String(
              h.nachname || ''
            ).trim(),

          arrival:
            arrival,

          assignedMinutes:
            0,

          raster:
            {},

          assignments:
            [],

          suitableStations:
            String(h.suitableStations || h.geeigneteStationen || '')
              .split(',')
              .map(x => x.trim())
              .filter(Boolean)

        };

      }
    );


  // ---------------------------------------------------
  // Stationen vorbereiten
  // ---------------------------------------------------

  const stationInfo =
    stations
      .map(
        s => ({

          name:
            String(
              s.name || ''
            ).trim(),

          needed:
            Math.max(
              0,
              Number(
                s.needed
              ) || 1
            ),

          start:
            dienstplanStationszeit_(
              s,
              datum,
              settings
            ).start,

          end:
            dienstplanStationszeit_(
              s,
              datum,
              settings
            ).end,

          besetzt:
            0,

          fehlend:
            0

        })
      )
      .filter(
        s =>
          s.name
      );


  // ---------------------------------------------------
  // Zeitraster erzeugen
  // ---------------------------------------------------

  const slots = [];


  for (
    let time = start;
    time < end;
    time += step
  ) {

    slots.push(
      time
    );

  }


  // ---------------------------------------------------
  // JEDES 30-MINUTEN-FELD PLANEN
  // ---------------------------------------------------

  slots.forEach(
    slot => {

      // -------------------------------------------------
      // Für dieses Zeitfenster benötigte Plätze
      // -------------------------------------------------

      const bedarf = [];


      stationInfo.forEach(
        station => {

          // Station nur innerhalb ihrer eigenen Betriebszeit besetzen.
          if (slot < station.start || slot >= station.end) {
            return;
          }

          for (
            let i = 0;
            i < station.needed;
            i++
          ) {

            bedarf.push(
              station
            );

          }

        }
      );


      // -------------------------------------------------
      // Stationen mit hohem Bedarf zuerst.
      // Bei Gleichstand alphabetisch.
      // -------------------------------------------------

      bedarf.sort(
        (a, b) => {

          if (
            a.needed !==
            b.needed
          ) {

            return (
              b.needed -
              a.needed
            );

          }


          return a.name.localeCompare(
            b.name
          );

        }
      );


      // -------------------------------------------------
      // Helfer für dieses Zeitfenster
      // -------------------------------------------------

      const bereitsEingesetzt =
        new Set();


      bedarf.forEach(
        station => {

          const candidates =
            people
              .filter(
                person => {

                  // Noch nicht angekommen.
                  if (
                    person.arrival >
                    slot
                  ) {

                    return false;

                  }


                  // Schon in diesem
                  // Zeitfenster eingesetzt.
                  if (
                    bereitsEingesetzt.has(
                      person.nr
                    )
                  ) {

                    return false;

                  }


                  // Stations-Eignung zentral prüfen.
                  // Es werden sowohl Stationsname als auch Kürzel akzeptiert.
                  if (!helperStationGeeignet_(
                    { suitableStations: person.suitableStations.join(',') },
                    station
                  )) {
                    return false;
                  }


                  // Darf keinen vierten
                  // Einsatzblock beginnen.
                  if (
                    !dienstplanKannBelegtWerden(
                      person,
                      slot,
                      station.name
                    )
                  ) {

                    return false;

                  }


                  return true;

                }
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  dienstplanVergleicheHelfer(
                    a,
                    b,
                    slot
                  )
              );


          if (
            candidates.length === 0
          ) {

            station.fehlend++;

            return;

          }


          const person =
            candidates[0];


          // ------------------------------------------------
          // Zuweisung
          // ------------------------------------------------

          person.raster[
            dbMinutesToTime(
              slot
            )
          ] =
            station.name;


          person.assignments.push({

            station:
              station.name,

            start:
              slot,

            end:
              slot + step

          });


          person.assignedMinutes +=
            step;


          bereitsEingesetzt.add(
            person.nr
          );

        }
      );

    }
  );


  // ---------------------------------------------------
  // Stationswerte zusammenrechnen
  // ---------------------------------------------------

  stationInfo.forEach(
    station => {

      let count = 0;


      people.forEach(
        person => {

          Object.keys(
            person.raster
          )
          .forEach(
            time => {

              if (
                person.raster[time] ===
                station.name
              ) {

                count++;

              }

            }
          );

        }
      );


      station.besetzt =
        count;

    }
  );


  // ---------------------------------------------------
  // Warnungen
  // ---------------------------------------------------

  const warnings = [];


  stationInfo.forEach(
    station => {

      if (
        station.fehlend > 0
      ) {

        warnings.push(
          'Nicht genügend Helfer für Station "' +
          station.name +
          '".'
        );

      }

    }
  );


  // ---------------------------------------------------
  // Ergebnis vorbereiten
  // ---------------------------------------------------

  const plan = {};


  people.forEach(
    person => {

      plan[
        String(
          person.nr
        )
      ] = {

        nr:
          person.nr,

        name:
          person.name,

        arrival:
          dbMinutesToTime(
            person.arrival
          ),

        // DAS ist jetzt der eigentliche Plan.
        raster:
          person.raster,

        // Nur zur Übersicht / Kompatibilität.
        schichten:
          dienstplanZusammenfassen(
            person.assignments
          )

      };

    }
  );


  return {

    start:
      dbMinutesToTime(
        start
      ),

    end:
      dbMinutesToTime(
        end
      ),

    step:
      step,

    teilnehmer:
      people.length,

    stationen:
      stationInfo,

    warnings:
      warnings,

    plan:
      plan

  };

}


// =====================================================
// HELFER-VERGLEICH
// =====================================================
//
// Entscheidet, welcher Helfer für ein 30-Minuten-Feld
// am sinnvollsten ist.
//
// Prioritäten:
//
// 1. Wer gerade schon auf derselben Station arbeitet?
// 2. Wer hat weniger Gesamtzeit?
// 3. Wer hat weniger Einsatzblöcke?
// 4. kleinere Helfer-Nr.
// =====================================================

function dienstplanVergleicheHelfer(
  a,
  b,
  slot
) {

  const stationA =
    dienstplanVorherigeStation(
      a,
      slot
    );


  const stationB =
    dienstplanVorherigeStation(
      b,
      slot
    );


  // Kontinuität bevorzugen.
  if (
    stationA &&
    !stationB
  ) {

    return -1;

  }


  if (
    stationB &&
    !stationA
  ) {

    return 1;

  }


  // Weniger Gesamtzeit bevorzugen.
  if (
    a.assignedMinutes !==
    b.assignedMinutes
  ) {

    return (
      a.assignedMinutes -
      b.assignedMinutes
    );

  }


  // Weniger Blöcke bevorzugen.
  const blocksA =
    dienstplanZaehleBloecke(
      a.assignments
    );


  const blocksB =
    dienstplanZaehleBloecke(
      b.assignments
    );


  if (
    blocksA !==
    blocksB
  ) {

    return (
      blocksA -
      blocksB
    );

  }


  return (
    a.nr -
    b.nr
  );

}


// =====================================================
// VORHERIGE STATION
// =====================================================

function dienstplanVorherigeStation(
  person,
  slot
) {

  const previous =
    slot -
    DIENSTPLAN_RASTER;


  const time =
    dbMinutesToTime(
      previous
    );


  return (
    person.raster[time] ||
    ''
  );

}


// =====================================================
// DARF HELFER BELEGT WERDEN?
// =====================================================

function dienstplanKannBelegtWerden(
  person,
  slot,
  station
) {

  const time =
    dbMinutesToTime(
      slot
    );


  // ---------------------------------------------------
  // Schon belegt?
  // ---------------------------------------------------

  if (
    person.raster[time]
  ) {

    return false;

  }


  // ---------------------------------------------------
  // Prüfen, ob ein bestehender Block
  // fortgesetzt wird.
  // ---------------------------------------------------

  const previous =
    dienstplanVorherigeStation(
      person,
      slot
    );


  if (
    previous
  ) {

    return true;

  }


  // ---------------------------------------------------
  // Neuer Block.
  // ---------------------------------------------------

  const blocks =
    dienstplanZaehleBloecke(
      person.assignments
    );


  if (
    blocks >=
    DIENSTPLAN_MAX_BLOECKE
  ) {

    return false;

  }


  return true;

}


// =====================================================
// ANZAHL BLÖCKE
// =====================================================

function dienstplanZaehleBloecke(
  assignments
) {

  if (
    !assignments ||
    assignments.length === 0
  ) {

    return 0;

  }


  const sorted =
    assignments
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          a.start -
          b.start
      );


  let blocks = 0;
  let lastEnd = null;


  sorted.forEach(
    assignment => {

      if (
        lastEnd === null ||
        assignment.start !== lastEnd
      ) {

        blocks++;

      }


      lastEnd =
        assignment.end;

    }
  );


  return blocks;

}


// =====================================================
// RASTER → SCHICHTEN
// =====================================================
//
// Nur für Kompatibilität mit dem bestehenden
// Tabellenformat.
//
// Intern bleibt der Rasterplan erhalten.
// =====================================================

function dienstplanZusammenfassen(
  assignments
) {

  if (
    !assignments ||
    assignments.length === 0
  ) {

    return [];

  }


  const sorted =
    assignments
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          a.start -
          b.start
      );


  const groups = [];


  sorted.forEach(
    assignment => {

      const last =
        groups[
          groups.length - 1
        ];


      if (
        !last ||
        last.station !==
        assignment.station ||
        last.end !==
        assignment.start
      ) {

        groups.push({

          station:
            assignment.station,

          start:
            assignment.start,

          end:
            assignment.end

        });

      } else {

        last.end =
          assignment.end;

      }

    }
  );


  return groups.map(
    group => ({

      station:
        group.station,

      von:
        dbMinutesToTime(
          group.start
        ),

      bis:
        dbMinutesToTime(
          group.end
        )

    })
  );

}


// =====================================================
// RASTERPLAN LESBAR AUSGEBEN
// =====================================================

function dienstplanVorschlagAusgeben() {

  const result =
    dienstplanVorschlagTest();


  console.log(
    '===== 30-MINUTEN-RASTER ====='
  );


  Object.keys(
    result.plan
  )
  .forEach(
    nr => {

      const person =
        result.plan[nr];


      console.log(
        'Nr. ' +
        nr +
        ' | ' +
        person.name +
        ' | Ankunft: ' +
        person.arrival
      );


      const times =
        Object.keys(
          person.raster
        )
        .sort(
          dienstplanZeitSortierung
        );


      if (
        times.length === 0
      ) {

        console.log(
          '  KEIN EINSATZ'
        );

        return;

      }


      times.forEach(
        time => {

          console.log(
            '  ' +
            time +
            ' → ' +
            person.raster[time]
          );

        }
      );

    }
  );


  console.log(
    '===== RASTER AUSGABE ENDE ====='
  );


  return result;

}


// =====================================================
// ZEIT SORTIEREN
// =====================================================

function dienstplanZeitSortierung(
  a,
  b
) {

  return (
    dbTimeToMinutes(a) -
    dbTimeToMinutes(b)
  );

}


// =====================================================
// EINZELNES RASTER EINES HELFERS
// =====================================================
//
// Diese Funktion ist später für die HTML-Oberfläche
// wichtig.
//
// Beispiel:
//
// dienstplanHelferRaster(34)
//
// liefert:
//
// {
//   "15:00": "Aufbau",
//   "15:30": "Aufbau",
//   "16:00": "Grill"
// }
// =====================================================

function dienstplanHelferRaster(
  nr
) {

  const result =
    dienstplanVorschlagTest();


  const person =
    result.plan[
      String(nr)
    ];


  if (
    !person
  ) {

    return {};

  }


  return person.raster;

}


// =====================================================
// KOMPLETTEN VORSCHLAG ALS RASTER LADEN
// =====================================================
//
// Diese Funktion ist für die spätere HTML-Anbindung
// gedacht.
//
// Die HTML-Oberfläche kann damit direkt:
//
//   const plan = dienstplanRasterLaden();
//
// aufrufen.
// =====================================================

function dienstplanRasterLaden() {

  const result =
    dienstplanVorschlagTest();


  return {

    start:
      result.start,

    end:
      result.end,

    step:
      result.step,

    plan:
      result.plan

  };

}


// =====================================================
// VORSCHLAG ÜBERNEHMEN
// =====================================================
//
// ACHTUNG:
//
// Diese Funktion schreibt tatsächlich in den
// Dienstplan.
//
// Erst verwenden, wenn der Vorschlag geprüft wurde.
// =====================================================

function dienstplanVorschlagUebernehmen(
  password
) {

  if (
    getRole(password) !==
    'admin'
  ) {

    throw new Error(
      'Nur der Admin darf den Dienstplan übernehmen.'
    );

  }


  const result =
    dienstplanVorschlagTest();


  let gespeichert = 0;


  Object.keys(
    result.plan
  )
  .forEach(
    nr => {

      const person =
        result.plan[nr];


      // Raster direkt verwenden.
      const graphPlan =
        {};


      Object.keys(
        person.raster
      )
      .forEach(
        time => {

          graphPlan[time] =
            person.raster[time];

        }
      );


      // Bestehende Speicherfunktion
      // aus dem alten System verwenden.
      saveGraphPlan(
        password,
        Number(nr),
        graphPlan
      );


      gespeichert++;

    }
  );


  return {

    ok:
      true,

    gespeichert:
      gespeichert,

    warnings:
      result.warnings

  };

}


// =====================================================
// MANUELLES RASTER VORBEREITEN
// =====================================================
//
// Diese Funktion wird später von der HTML-Oberfläche
// verwendet.
//
// Sie verändert noch NICHT den Dienstplan.
//
// Beispiel:
//
// dienstplanRasterPruefen({
//   "34": {
//      "15:00": "Aufbau",
//      "15:30": "Grill"
//   }
// });
// =====================================================

function dienstplanRasterPruefen(
  plan
) {

  if (
    !plan ||
    typeof plan !== 'object'
  ) {

    throw new Error(
      'Ungültiger Rasterplan.'
    );

  }


  const stationList = dbGetStations();
  const stationMap = {};
  stationList.forEach(station => {
    stationMap[String(station.name)] = station;
  });


  const errors = [];


  Object.keys(
    plan
  )
  .forEach(
    nr => {

      const raster =
        plan[nr];


      if (
        !raster ||
        typeof raster !== 'object'
      ) {

        return;

      }


      Object.keys(
        raster
      )
      .forEach(
        time => {

          const value =
            String(
              raster[time] || ''
            ).trim();


          // Leeres Feld ist erlaubt.
          if (
            !value
          ) {

            return;

          }


          // Station muss existieren.
          const station = stationMap[value];
          if (!station) {
            errors.push(
              'Nr. ' + nr + ' | ' + time +
              ' | unbekannte Station: ' + value
            );
            return;
          }

          // Station darf nur innerhalb ihrer Betriebszeit belegt werden.
          const settings = dbGetSettings();
          const stationStart = dbTimeToMinutes(station.start || settings.start);
          const stationEnd = dbTimeToMinutes(station.end || settings.end);
          const slot = dbTimeToMinutes(time);
          if (Number.isFinite(slot) && Number.isFinite(stationStart) && Number.isFinite(stationEnd) &&
              (slot < stationStart || slot >= stationEnd)) {
            errors.push(
              'Nr. ' + nr + ' | ' + time +
              ' | Station "' + value + '" ist zu dieser Zeit nicht verfügbar.'
            );
          }

        }
      );

    }
  );


  return {

    ok:
      errors.length === 0,

    errors:
      errors

  };

}