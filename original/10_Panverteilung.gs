// =====================================================
// FF HOLZHAUSEN – HELFER-DIENSTPLAN
// 10_Planverteilung.gs
// =====================================================
//
// Endgültige Planverteilung.
//
// Dieses Modul nimmt die Wunschpläne der Helfer entgegen
// und erzeugt daraus eine gemeinsame Planverteilung.
//
// WICHTIG:
// - 05_Dienstplan.gs bleibt für den Vorschlag zuständig.
// - 07_Wunschplan.gs stellt die Wünsche bereit.
// - 10_Planverteilung.gs entscheidet NICHT über Wünsche,
//   solange kein Verteilungsprozess gestartet wurde.
// - Der endgültige Plan wird nur über eine ausdrücklich
//   aufgerufene Speicherfunktion geschrieben.
//
// =====================================================


// =====================================================
// WUNSCHPLÄNE SAMMELN / PRÜFEN
// =====================================================

function planverteilungPruefen(
  plaene
) {

  const check =
    wunschplaenePruefen(
      plaene
    );


  const stationen =
    dbGetStations();


  const benoetigt = {};

  stationen.forEach(
    station => {

      benoetigt[
        station.name
      ] =
        Number(
          station.needed
        ) || 1;

    }
  );


  const belegung =
    {};


  Object.keys(
    plaene || {}
  )
  .forEach(
    nr => {

      const raster =
        plaene[nr] || {};


      Object.keys(
        raster
      )
      .forEach(
        zeit => {

          const station =
            String(
              raster[zeit] || ''
            ).trim();


          if (!station) {

            return;

          }


          if (!belegung[zeit]) {

            belegung[zeit] = {};

          }


          if (!belegung[zeit][station]) {

            belegung[zeit][station] = 0;

          }


          belegung[zeit][station]++;

        }
      );

    }
  );


  const warnungen = [];


  Object.keys(
    belegung
  )
  .forEach(
    zeit => {

      Object.keys(
        belegung[zeit]
      )
      .forEach(
        station => {

          const count =
            belegung[zeit][station];

          const needed =
            benoetigt[station] || 1;


          if (
            count > needed
          ) {

            warnungen.push(
              zeit +
              ': Station "' +
              station +
              '" hat ' +
              count +
              ' Helfer bei ' +
              needed +
              ' benötigten.'
            );

          }

        }
      );

    }
  );


  return {

    ok:
      check.ok,

    errors:
      check.errors || [],

    warnings:
      warnungen

  };

}


// =====================================================
// WÜNSCHE FÜR EINEN ZEITPUNKT AUSWERTEN
// =====================================================

function planverteilungZeitpunkt(
  plaene,
  zeit
) {

  const result = {};


  Object.keys(
    plaene || {}
  )
  .forEach(
    nr => {

      const raster =
        plaene[nr] || {};

      const station =
        String(
          raster[zeit] || ''
        ).trim();


      if (!station) {

        return;

      }


      if (!result[station]) {

        result[station] = [];

      }


      result[station].push(
        Number(nr)
      );

    }
  );


  return result;

}


// =====================================================
// VERTEILUNG ERZEUGEN
// =====================================================
//
// Grundregel:
// Wünsche werden zunächst 1:1 übernommen.
//
// Wenn eine Station überbesetzt ist, bleiben die
// Wünsche erhalten und werden als Konflikt gemeldet.
// Die eigentliche Priorisierung kann später erweitert
// werden.
//
// =====================================================

function planverteilungErzeugen(
  plaene
) {

  const check =
    planverteilungPruefen(
      plaene
    );


  if (
    !check.ok
  ) {

    throw new Error(
      'Wunschpläne sind ungültig:\n' +
      check.errors.join('\n')
    );

  }


  const plan =
    {};


  Object.keys(
    plaene || {}
  )
  .forEach(
    nr => {

      plan[nr] =
        Object.assign(
          {},
          plaene[nr] || {}
        );

    }
  );


  return {

    ok: true,

    plan:
      plan,

    warnings:
      check.warnings

  };

}


// =====================================================
// PLANVERTEILUNG LADEN
// =====================================================
//
// Bereitet den endgültigen Plan für die Oberfläche vor.
// Es wird NICHT gespeichert.
//
// =====================================================

function planverteilungLaden(
  plaene
) {

  const result =
    planverteilungErzeugen(
      plaene
    );


  return {

    ok:
      result.ok,

    plan:
      result.plan,

    warnings:
      result.warnings,

    stations:
      stationenUebersicht(
        result.plan
      )

  };

}


// =====================================================
// ENDGÜLTIGEN PLAN SPEICHERN
// =====================================================
//
// Nur Admin.
//
// Die Funktion nutzt die bereits vorhandene
// saveGraphPlan()-Funktion aus dem bisherigen System.
// =====================================================

function planverteilungSpeichern(
  password,
  plan
) {

  if (
    getRole(password) !==
    'admin'
  ) {

    throw new Error(
      'Nur der Admin darf den endgültigen Dienstplan speichern.'
    );

  }


  if (
    !plan ||
    typeof plan !== 'object'
  ) {

    throw new Error(
      'Ungültiger Dienstplan.'
    );

  }


  const check =
    planverteilungPruefen(
      plan
    );


  if (
    !check.ok
  ) {

    throw new Error(
      'Der Dienstplan enthält ungültige Einträge:\n' +
      check.errors.join('\n')
    );

  }


  let gespeichert = 0;


  Object.keys(
    plan
  )
  .forEach(
    nr => {

      saveGraphPlan(
        password,
        Number(nr),
        plan[nr] || {}
      );


      gespeichert++;

    }
  );


  return {

    ok: true,

    gespeichert:
      gespeichert,

    warnings:
      check.warnings

  };

}


// =====================================================
// STATIONSBELEGUNG FÜR ENDGÜLTIGEN PLAN
// =====================================================

function planverteilungStationsstatus(
  plan
) {

  return stationenStatus(
    plan
  );

}


// =====================================================
// KONFLIKTE ERMITTELN
// =====================================================
//
// Ein Konflikt liegt vor, wenn an einem Zeitpunkt mehr
// Helfer eine Station wünschen als benötigt werden.
//
// =====================================================

function planverteilungKonflikte(
  plan
) {

  const stations =
    dbGetStations();


  const needed = {};


  stations.forEach(
    station => {

      needed[
        station.name
      ] =
        Number(
          station.needed
        ) || 1;

    }
  );


  const conflicts = [];


  const times = {};


  Object.keys(
    plan || {}
  )
  .forEach(
    nr => {

      const raster =
        plan[nr] || {};


      Object.keys(
        raster
      )
      .forEach(
        zeit => {

          const station =
            String(
              raster[zeit] || ''
            ).trim();


          if (!station) {

            return;

          }


          if (!times[zeit]) {

            times[zeit] = {};

          }


          if (!times[zeit][station]) {

            times[zeit][station] = [];

          }


          times[zeit][station].push(
            Number(nr)
          );

        }
      );

    }
  );


  Object.keys(
    times
  )
  .forEach(
    zeit => {

      Object.keys(
        times[zeit]
      )
      .forEach(
        station => {

          const helpers =
            times[zeit][station];

          const max =
            needed[station] || 1;


          if (
            helpers.length > max
          ) {

            conflicts.push({

              zeit:
                zeit,

              station:
                station,

              needed:
                max,

              helpers:
                helpers,

              excess:
                helpers.length - max

            });

          }

        }
      );

    }
  );


  return conflicts;

}


// =====================================================
// KOMPLETTE PLANVERTEILUNGS-DATEN
// =====================================================

function planverteilungDaten(
  plan
) {

  return {

    ok: true,

    plan:
      plan || {},

    conflicts:
      planverteilungKonflikte(
        plan || {}
      ),

    stations:
      planverteilungStationsstatus(
        plan || {}
      )

  };

}
