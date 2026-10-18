// Écouteur d'événement pour le chargement du fichier
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const text = event.target.result;
        processData(text);
    };
    reader.readAsText(file);
});

let globalData = []; // Variable globale pour conserver les données pour la barre de recherche

function processData(csvText) {
    // Séparation des lignes et détection automatique du séparateur Excel (virgule ou point-virgule)
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return;
    
    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
    
    globalData = [];
    let missingDataAlerts = [];
    let barrierAlerts = [];
    
    let totalNominal = 0;
    let totalValo = 0;
    let typeCount = {};

    // Analyse ligne par ligne
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(separator).map(v => v.trim());
        
        let rowData = {};
        headers.forEach((header, index) => {
            rowData[header] = values[index];
        });

        globalData.push(rowData);

        // 1. Détection des données manquantes spécifiées dans l'énoncé
        if (!rowData['valorisation'] || rowData['valorisation'] === "") {
            missingDataAlerts.push(`Valorisation manquante : ${rowData['produit']} (Client: ${rowData['client']}).`);
        }
        if (!rowData['emetteur'] || rowData['emetteur'] === "") {
            missingDataAlerts.push(`Émetteur manquant : ${rowData['produit']} (Client: ${rowData['client']}).`);
        }

        // 2. Calcul des KPI financiers
        const nominal = parseFloat(rowData['nominal']) || 0;
        const valo = parseFloat(rowData['valorisation']) || 0;
        totalNominal += nominal;
        totalValo += valo;

        // 3. Comptage pour la répartition par type
        const type = rowData['type'] || 'Inconnu';
        typeCount[type] = (typeCount[type] || 0) + 1;

        // 4. Surveillance du risque barrière (Niveau actuel proche de la barrière capital)
        // On définit une alerte si la distance est inférieure ou égale à 5%
        const barriere = parseFloat(rowData['barriere_capital']) || 0;
        const niveau = parseFloat(rowData['niveau_actuel']) || 0;
        if (niveau > 0 && barriere > 0) {
            const distance = niveau - barriere;
            if (distance >= 0 && distance <= 5) {
                barrierAlerts.push(`Surveillance : ${rowData['produit']} (Marge barrière : ${distance.toFixed(2)}%).`);
            }
        }
    }

    // Mise à jour de l'interface (KPIs)
    document.getElementById('kpi-count').textContent = globalData.length;
    document.getElementById('kpi-nominal').textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalNominal);
    document.getElementById('kpi-valo').textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalValo);

    // Affichage de l'encadré des erreurs de données
    const missingBox = document.getElementById('missing-data-box');
    if (missingDataAlerts.length > 0) {
        missingBox.style.display = 'block';
        missingBox.innerHTML = '<strong>Avertissement - Données manquantes :</strong><br>' + missingDataAlerts.join('<br>');
    }

    // Affichage de l'encadré de surveillance des barrières
    const barrierBox = document.getElementById('barrier-alert-box');
    if (barrierAlerts.length > 0) {
        barrierBox.style.display = 'block';
        barrierBox.innerHTML = '<strong>Alerte risque - Produits proches de la barrière :</strong><br>' + barrierAlerts.join('<br>');
    }

    // Affichage de la répartition par type de sous-jacent
    const typeBox = document.getElementById('type-repartition-content');
    typeBox.innerHTML = Object.keys(typeCount).map(t => `<strong>${t}</strong>: ${typeCount[t]}`).join(' &nbsp;|&nbsp; ');

    // Génération du tableau HTML
    renderTable(globalData);

    // Rendre le dashboard visible
    document.getElementById('dashboard').style.display = 'block';
}

function renderTable(data) {
    const tbody = document.querySelector('#positions-table tbody');
    tbody.innerHTML = '';

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row['client'] || ''}</td>
            <td>${row['produit'] || ''}</td>
            <td>${row['emetteur'] || ''}</td>
            <td>${row['type'] || ''}</td>
            <td>${row['devise'] || ''}</td>
            <td>${row['nominal'] ? new Intl.NumberFormat('fr-FR').format(row['nominal']) : ''}</td>
            <td>${row['valorisation'] ? new Intl.NumberFormat('fr-FR').format(row['valorisation']) : ''}</td>
            <td>${row['barriere_capital'] || ''}%</td>
            <td>${row['niveau_actuel'] || ''}%</td>
        `;
        tbody.appendChild(tr);
    });
}

// Fonctionnalité de filtre par client
document.getElementById('searchInput').addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    const filteredData = globalData.filter(row => {
        const clientName = (row['client'] || '').toLowerCase();
        return clientName.includes(term);
    });
    renderTable(filteredData);
});