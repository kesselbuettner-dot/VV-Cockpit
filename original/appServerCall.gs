// =====================================================
// FF HOLZHAUSEN – ZENTRALER SERVER-DISPATCHER
// appServerCall.gs
// =====================================================
//
// Das Frontend ruft nur noch appServerCall() auf.
// Dadurch gibt es keine dynamischen Zugriffe wie
// google.script.run[functionName](...) mehr.
//
// Die Whitelist verhindert außerdem, dass beliebige
// globale Apps-Script-Funktionen vom Frontend aufgerufen
// werden können.
// =====================================================

function appServerCall(functionName, args) {

  const name = String(functionName || '').trim();
  if (!name) {
    throw new Error('Keine Serverfunktion angegeben.');
  }

  if (!Array.isArray(args)) {
    args = [];
  }

  switch (name) {
    case 'ablaufplanLaden':
      return ablaufplanLaden.apply(null, args);

    case 'ablaufplanSpeichern':
      return ablaufplanSpeichern.apply(null, args);

    case 'appStartLaden':
      return appStartLaden.apply(null, args);

    case 'dbGetHelpers':
      return dbGetHelpers.apply(null, args);

    case 'dbGetSettings':
      return dbGetSettings.apply(null, args);

    case 'dienstplanungLaden':
      return dienstplanungLaden.apply(null, args);

    case 'dienstplanungMehrfachAendern':
      return dienstplanungMehrfachAendern.apply(null, args);

    case 'dienstplanungSpeichern':
      return dienstplanungSpeichern.apply(null, args);

    case 'dienstplanungTagesLaden':
      return dienstplanungTagesLaden.apply(null, args);

    case 'dienstplanungTagesSpeichern':
      return dienstplanungTagesSpeichern.apply(null, args);

    case 'helferHinzufuegen':
      return helferHinzufuegen.apply(null, args);

    case 'helferSpeichern':
      return helferSpeichern.apply(null, args);

    case 'helferLoeschen':
      return helferLoeschen.apply(null, args);

    case 'helferListeLaden':
      return helferListeLaden.apply(null, args);

    case 'kalenderMailVorlagenLaden':
      return kalenderMailVorlagenLaden.apply(null, args);

    case 'kalenderMailVorlagenSpeichern':
      return kalenderMailVorlagenSpeichern.apply(null, args);

    case 'kalenderVersand':
      return kalenderVersand.apply(null, args);

    case 'kalenderStatus':
      return kalenderStatus.apply(null, args);

    case 'kasseLoeschen':
      return kasseLoeschen.apply(null, args);

    case 'kasseSpeichern':
      return kasseSpeichern.apply(null, args);

    case 'kassenAblosungAnfordern':
      return kassenAblosungAnfordern.apply(null, args);

    case 'kassenArtikelNachschubGeliefert':
      return kassenArtikelNachschubGeliefert.apply(null, args);

    case 'kassenArtikelReihenfolgeSpeichern':
      return kassenArtikelReihenfolgeSpeichern.apply(null, args);

    case 'kassenArtikelStatusDashboard':
      return kassenArtikelStatusDashboard.apply(null, args);

    case 'kassenArtikelStatusSetzen':
      return kassenArtikelStatusSetzen.apply(null, args);

    case 'kassenDatenLaden':
      return kassenDatenLaden.apply(null, args);

    case 'kassenDiagnose':
      return kassenDiagnose.apply(null, args);

    case 'kassenDienstplanAktuell':
      return kassenDienstplanAktuell.apply(null, args);

    case 'kassenLaden':
      return kassenLaden.apply(null, args);

    case 'kassenStatus':
      return kassenStatus.apply(null, args);

    case 'kassenVerkaufSpeichern':
      return kassenVerkaufSpeichern.apply(null, args);

    case 'loginUser':
      return loginUser.apply(null, args);

    case 'mapsKarteLaden':
      return mapsKarteLaden.apply(null, args);

    case 'mapsStationLaden':
      return mapsStationLaden.apply(null, args);

    case 'mapsStationPunktLoeschen':
      return mapsStationPunktLoeschen.apply(null, args);

    case 'mapsStationPunktSpeichern':
      return mapsStationPunktSpeichern.apply(null, args);

    case 'saveSettings':
      return saveSettings.apply(null, args);

    case 'stationSpeichern':
      return stationSpeichern.apply(null, args);

    case 'stationenLaden':
      return stationenLaden.apply(null, args);

    case 'stationschichtenLaden':
      return stationschichtenLaden.apply(null, args);

    case 'stationschichtenSpeichern':
      return stationschichtenSpeichern.apply(null, args);

    case 'stationschichtenDienstplanErzeugen':
      return stationschichtenDienstplanErzeugen.apply(null, args);

    case 'verkaufAllergene':
      return verkaufAllergene.apply(null, args);

    case 'verkaufArtikelLoeschen':
      return verkaufArtikelLoeschen.apply(null, args);

    case 'verkaufArtikelSpeichern':
      return verkaufArtikelSpeichern.apply(null, args);

    case 'artikelSpeichern':
      return artikelSpeichern.apply(null, args);

    case 'artikelListeLaden':
      return artikelListeLaden.apply(null, args);

    case 'verkaufDatenLaden':
      return verkaufDatenLaden.apply(null, args);

    case 'verkaufZusatzstoffe':
      return verkaufZusatzstoffe.apply(null, args);

    case 'wunschplaenePersistiertLaden':
      return wunschplaenePersistiertLaden.apply(null, args);

    case 'wunschplanAktuellenDienstLaden':
      return wunschplanAktuellenDienstLaden.apply(null, args);

    case 'wunschplanHelferPruefen':
      return wunschplanHelferPruefen.apply(null, args);

    case 'wunschplanPersistiertAendern':
      return wunschplanPersistiertAendern.apply(null, args);

    case 'wunschplanPersistiertLaden':
      return wunschplanPersistiertLaden.apply(null, args);

    case 'wunschplanPersistiertMehrfachAendern':
      return wunschplanPersistiertMehrfachAendern.apply(null, args);

    case 'wunschplanTagesAlleLaden':
      return wunschplanTagesAlleLaden.apply(null, args);

    case 'wunschplanTagesLaden':
      return wunschplanTagesLaden.apply(null, args);

    case 'wunschplanTagesSpeichern':
      return wunschplanTagesSpeichern.apply(null, args);

    default:
      throw new Error(
        'Nicht erlaubte oder unbekannte Serverfunktion: ' + name
      );
  }
}
