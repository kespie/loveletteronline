/*

TOELICHTING OP DIT DOCUMENT

Om ervoor te zorgen dat je vanuit meerdere locaties acties kunt doen in een 'gedeelde' virtuele omgeving, bestaat het systeem uit 1 centrale 
server (gecodeerd in javascript), die onafhankelijk communiceert met meerdere 'clients'. 1 client hoort bij 1 gebruiker, en bestaat uit een 
HTML-document voor de structuur (statische deel) en een javascript-document voor de communicatie en veranderingen (dynamische deel).

Dit document is het javascript-bestand dat door elke client wordt uitgevoerd in combinatie met het html-bestand. Je moet dit document eigenlijk
zien als de 'tolk' tussen de server enerzijds en de html-pagina van de client anderzijds. Het document verwerkt input van de gebruiker door de
juiste signalen/info door te geven aan de server, en vertaalt signalen/info vanuit de server naar veranderingen op de HTML-pagina.

*/

// Onderstaande regel overgenomen uit voorbeeld, nog uit te zoeken waar het goed voor is:
$(function () {
 
// SETTINGS ENZO

    // Onderstaande regel overgenomen uit voorbeeld, nog uit te zoeken waar het goed voor is. Zie http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
    "use strict";


// INITIALISATIE VAN GLOBALE VARIABELEN (kunnen worden opgevraagd en aangepast door alle functies die hieronder staan)

    // Hier initialiseren we een aantal variabelen die direct corresponderen met elementen op de HTML-pagina. Het zijn eigenlijk alleen maar 
    // pointers/doorverwijzingen naar objecten in de html-code, maar ze staan je wel toe om direct de eigenschappen van die objecten te wijzigen. 
    // Deze variabelen kun/moet je dus aanroepen in de functies verderop, om de stijl of inhoud van het html-elementen aan te passen vanuit javascript.

    var notificatiebox = document.getElementById('notificatiebox');
    var playerListDiv = document.getElementById("playerList");
    var playAreaDiv = document.getElementById("playArea");
    var cardsLeftDiv = document.getElementById("cardsleft");
    var gewonnenBerichtP = document.getElementById("gewonnen_bericht");
    var guardAreaDiv = document.getElementById("guardArea");
    var gameInfoBoxP= document.getElementById("gameinfobox");
    var startButtonDiv = document.getElementById("startButton");

    var cardHTMLclasses = ['guard','priest','baron','handmaid','prince','king','countess','princess'];
    var roleNames = ['Guard','Priest','Baron','Handmaid','Prince','King','Countess','Princess'];
    
    // Variabelen die de status bijhouden van de speler die is gekoppeld aan deze client
    var myPlayerID = -1;
    var iAmActive = false;
    var myCards = [];
    var myRoles = [];

    // Hulpvariabelen om gebruikersinteractie tijdens het spelen van kaarten mogelijk te maken.
    // Dan moet namelijk tijdelijk wat informatie worden opgeslagen.
    var waitingForPlayerSelection = false;
    var waitingforRoleSelection = false;

// KOPPEL FUNCTIES AAN HTML-ELEMENTEN

    // Koppel wat klikfuncties aan de juiste elementen
    
    startButtonDiv.addEventListener("click", clickStart, false);

    // Het koppelen van eventlisteners aan de 7 guardbuttons (hebben dezelfde class) moet simpeler kunnen dan dit, maar goed het werkt iig:
    var guardButtons = guardAreaDiv.childNodes;
    for (var i = 0; i < guardButtons.length; i++) { 
        guardButtons[i].addEventListener("click",clickGuessedRoleForGuard,false);
    }

// BRENG DE WEBSOCKET TOT STAND

    // Maak de websocket aan. Indien van toepassing, gebruikt dan de websocket die speciaal bestaat voor Mozilla
    window.WebSocket = window.WebSocket || window.MozWebSocket;

    // Als de browser WebSocket niet ondersteunt, toon dan een melding en sluit af
    if (!window.WebSocket) {
        content.html($('<p>', { text: 'Sorry, but your browser doesn\'t '
                                    + 'support WebSockets.'} ));
        input.hide();
        $('span').hide();
        return;
    }

    // Maak verbinding met de server. De variabele 'connection' is een websocket-verbinding en kan vanaf nu gebruikt worden voor alle communicatie 
    // van en naar de server
    var connection = new WebSocket('ws://127.0.0.1:1337');


// ALGEMENE FUNCTIES

    // Op het moment dat de verbinding tot stand komt, gebeurt het volgende:
    connection.onopen = function () {
        
    };

    // Als er op enig moment een error ontstaat, gebeurt het volgende:
    connection.onerror = function (error) {
        content.html($('<p>', { text: 'Sorry, but there\'s some problem with your '
                                    + 'connection or the server is down.' } ));
    };


// VERWERKEN VAN BERICHTEN VANUIT DE SERVER

    // berichten van de server belanden automatisch bij de 'onmessage' functie die hieronder staat. 
    // Het bericht zelf heet 'message' en moet altijd een zogenaamd JSON-object zijn.
    connection.onmessage = function (message) {
        // parse het json-bericht
        try {
            var json = JSON.parse(message.data);
        }
        catch (e) {
            console.log('This doesn\'t look like a valid JSON: ', message);
            return;
        }

        // Het JSON-bericht vanuit de server kan allerlei velden met info hebben, waaronder ook welk 'type' bericht het is. Op basis van het type weet de client
        // wat ie ermee moet doen. We gaan hieronder simpelweg alle bekende mogelijkheden voor het 'type' af.

        switch(json.type) {
            case 'receivePlayerID':
                receivePlayerID(json.data.nieuweID);
                break;

            case 'clearPlayerList':
                clearPlayerList();
                break;

            case 'createPlayerList':
                createPlayerList(json.data.aantalSpelers);
                break;

            case 'spelStart':
                spelStart();
                break;

            case 'updateStapelVoorraad':
                updateStapelVoorraad(json.data.aantal);
                break;

            case 'activePlayerChange':
                activePlayerChange(json.data.newActivePlayerID);
                break;

            case 'immunityChange':
                immunityChange(json.data.playerID,json.data.newImmunity);
                break;

            case 'nieuweRol':
                nieuweRol(json.data.nieuweRol);
                break;

            case 'wachtOpDoelwit':
                wachtOpDoelwit(json.data.rol);
                break;

            case 'doelwitKeuzeWasGeldig':
                doelwitKeuzeWasGeldig();
                break;

            case 'wachtOpRolKeuzeVoorGuard':
                wachtOpRolKeuzeVoorGuard(json.data.doelwitPlayerID);
                break

            case 'leverRolIn':
                leverRolIn(json.data.rol);
                break;

            case 'playerDied':
                playerDied(json.data.jsonPlayerID);
                break;

            case 'gameEnd':
                gameEnd(json.data.winnaar);
                break;

            case 'gameinfo':
                gameinfo(json.data.bericht);
                break;

            default:
                console.log('Dit JSON-type is onbekend: ', json);
        }
    };
    
// VERWERKEN VAN INPUT VAN DE GEBRUIKER

    //  De functie 'WhatClicked' is (eerder in de code) gekoppeld aan html-objecten, en wordt uitgevoerd zodra op zo'n element geklikt wordt. 
    // In dit geval wordt er dan een bericht naar de server gestuurd, waarin het id vermeld wordt van de knop waarop geklikt is.
    function clickStart() {
        stuurJSONbericht('start',{}); // vervolgens sturen we de ID als een tekstberichtje naar de server.
        //console.log('start geklikt');
    }

    function clickCard(){
        var rol = parseInt(this.innerHTML);
        stuurJSONbericht('kaartKlik',{rol: rol});
    }

    function clickPlayer(){
        if (waitingForPlayerSelection) {
            var selectedPlayerDiv = this;

            // Vind uit op welke speler is geklikt
            for (var i = 0; i < playerList.childNodes.length; i++) {
                if (playerList.childNodes[i] == selectedPlayerDiv) {
                    var gekozenDoelwitPlayerID = i;
                    stuurJSONbericht('doelwitKeuze',{gekozenDoelwitPlayerID:gekozenDoelwitPlayerID});
                }
            }
        }
    }

    function clickGuessedRoleForGuard(){
        $("#guardArea").addClass("invisible");
        notificatiebox.innerHTML = '';

        var buttonID = (this.id);
        var geradenRol = parseInt(buttonID.substr(11));

        stuurJSONbericht('userGuardKeuze',{geradenRol:geradenRol});
    }

// FUNCTIES GEKOPPELD AAN SERVERINPUT

    function wachtOpDoelwit(rol){
        waitingForPlayerSelection = true;
        notificatiebox.innerHTML = 'Selecteer een speler als doelwit voor de ' + rolNaam(rol) + '...';
    }

    function doelwitKeuzeWasGeldig(){
        waitingForPlayerSelection = false;
        notificatiebox.innerHTML = '';
    }

    function wachtOpRolKeuzeVoorGuard(targetPlayerID){
        $("#guardArea").removeClass("invisible");
        notificatiebox.innerHTML = 'Raad welke rol speler ' + targetPlayerID + ' heeft...';
    }

    function receivePlayerID(playerID){
        myPlayerID = playerID;
    }
    
    function clearPlayerList() {
        while (playerListDiv.hasChildNodes())
        {
          playerListDiv.removeChild(playerListDiv.firstChild);
        }
    }

    function createPlayerList(aantalSpelers) {
        //console.log('spelerlijst maken voor ' + aantalSpelers + ' spelers');

        for (var playerID = 0; playerID < aantalSpelers; playerID++) { 
            var playerNameDiv = document.createElement('div');

            playerNameDiv.className = 'playerName';

            if (playerID == myPlayerID) {
                playerNameDiv.className = playerNameDiv.className + ' ownName';
            }

            playerNameDiv.innerHTML = "Player " + playerID;
            playerNameDiv.addEventListener("click",clickPlayer,false);
            
            playerListDiv.appendChild(playerNameDiv);
        }
    }

    function spelStart(){
        startButtonDiv.style.display = "none";
        gewonnenBerichtP.innerHTML = "";
    }

    function updateStapelVoorraad(aantal) {
        cardsLeftDiv.innerHTML = 'Kaarten over: ' + aantal;
    }

    function activePlayerChange(newActivePlayerID){
       $(".activePlayer").removeClass("activePlayer");

       if(newActivePlayerID != -1) {
            var newActivePlayerDiv = playerListDiv.childNodes[newActivePlayerID];
            newActivePlayerDiv.className = newActivePlayerDiv.className + ' activePlayer';

            iAmActive = (newActivePlayerID == myPlayerID);
        }
    }

    function immunityChange(playerID,newImmunity){
        var playerDiv = playerListDiv.childNodes[playerID];

        if(newImmunity){
            playerDiv.className = playerDiv.className + ' immune';
        }
        else {
            $("#playerList").children(".activePlayer").removeClass("immune");
        }
    }

    function nieuweRol(rol) {
        var cardDiv = document.createElement('div');
        var cardHTMLclass = cardHTMLclasses[rol - 1];
        cardDiv.className = 'card ' + cardHTMLclass;
        cardDiv.innerHTML = rol;
        cardDiv.addEventListener("click",clickCard,false);
        
        playAreaDiv.insertBefore(cardDiv,notificatiebox);

        myCards.push(cardDiv);
        myRoles.push(rol);
    }

    function playerDied(playerID){
        var newDeadPlayerDiv = playerListDiv.childNodes[playerID];
        newDeadPlayerDiv.className = newDeadPlayerDiv.className + ' dead';
    }

    function gameEnd(winnaar){
        gewonnenBerichtP.innerHTML = 'Speler ' + winnaar + ' heeft gewonnen!';
    }

    function gameinfo(bericht){
        gameInfoBoxP.innerHTML = bericht + '<br>' + gameInfoBoxP.innerHTML;
    }

// ONDERSTEUNDENDE FUNCTIES, WORDEN OP MEERDERE MANIEREN GEBRUIKT

    function leverRolIn(rol) {
        var kaartIndexInHand = myRoles.indexOf(rol);
        playAreaDiv.removeChild(myCards[kaartIndexInHand]);
        myRoles.splice(kaartIndexInHand,1);
        myCards.splice(kaartIndexInHand,1);
    }

    function rolNaam(rolID) {
        return roleNames[rolID - 1];
    }

    function stuurJSONbericht(messageType,messageObject) {
        var json = JSON.stringify({ type: messageType, data: messageObject})
        connection.send(json);
    }
});