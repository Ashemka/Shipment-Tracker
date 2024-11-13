// ==UserScript==
// @name         Ship tracker Light
// @author       Ashemka
// @version      1.1
// @description  Extrait les informations de livraison des commandes Amazon et affiche les prévisions avec un code couleur cohérent. Inclut un bouton de synchronisation automatique des données.
// @match        https://www.amazon.fr/vine/orders*
// @match        https://www.amazon.fr/gp/legacy/order-history?orderFilter=cancelled*
// @match        https://www.amazon.fr/your-orders/orders?*
// @match        https://www.amazon.fr/gp/css/order-history?ref_=nav_orders_first
// @match        https://www.amazon.fr/gp/your-account/order-history/*
// @match        https://www.amazon.fr/vine/account*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_listValues
// @grant        window.close
// @updateURL https://raw.githubusercontent.com/Ashemka/Shipment-Tracker/refs/heads/main/ShipTrack.js
// @downloadURL https://raw.githubusercontent.com/Ashemka/Shipment-Tracker/refs/heads/main/ShipTrack.js
// ==/UserScript==

(function() {
    'use strict';

    console.log('Script "Ship tracker Light" démarré');

    const isFirefox = typeof InstallTrigger !== 'undefined';

    // Fonction pour formater les dates
    function formatDate(dateString) {
        console.log('formatDate appelé avec :', dateString);
        dateString = dateString.toLowerCase();
        dateString = dateString.replace(/(livraison prévue le|livraison prévue|livré le|livré|arrivera|livraison estimée le|livraison le) /g, '').trim();
        return dateString;
    }

    // Fonction pour extraire et stocker les informations de commande à partir de la page des commandes Amazon
    function extractAndStoreOrderInfo() {
        console.log('extractAndStoreOrderInfo appelé');
        if (window.location.href.includes("your-orders/orders") || window.location.href.includes("order-history?ref_=nav_orders_first") || window.location.href.includes("your-account/order-history")) {
            let orders = GM_getValue('orders', []);

            let orderDivs = document.querySelectorAll('div.yohtmlc-shipment-status-primaryText');
            let orderIDs = document.querySelectorAll('span.a-color-secondary[dir="ltr"]');
            let shipmentButtons = document.querySelectorAll('a[href*="shipmentId="]');

            console.log('Éléments trouvés :', orderDivs.length, orderIDs.length, shipmentButtons.length);

            shipmentButtons.forEach(button => {
                let url = new URL(button.href);
                let shipmentID = url.searchParams.get('shipmentId');
                let orderID = url.searchParams.get('orderId');

                if (shipmentID && orderID) {
                    let orderInfo = orders.find(o => o.orderID === orderID) || { orderID, deliveryInfo: '', shipmentIDs: [], deliveryStatus: '' };
                    if (!orderInfo.shipmentIDs.includes(shipmentID)) {
                        orderInfo.shipmentIDs.push(shipmentID);
                    }
                    orders = orders.filter(o => o.orderID !== orderID);
                    orders.push(orderInfo);
                    console.log('ShipmentID stocké pour orderID :', shipmentID, orderID);
                }
            });

            orderDivs.forEach((div, index) => {
                let orderID = orderIDs[index]?.innerText.trim();
                let deliveryInfo = div.querySelector('span.a-size-medium')?.innerText.trim();
                let deliveryStatus = '';

                if (!deliveryInfo) {
                    deliveryInfo = div.querySelector('span.a-size-medium.a-color-base.a-text-bold')?.innerText.trim();
                }

                if (deliveryInfo) {
                    if (deliveryInfo.toLowerCase().includes('livré')) {
                        deliveryStatus = 'Livré';
                    }
                    deliveryInfo = formatDate(deliveryInfo);
                }

                if (orderID && deliveryInfo) {
                    let orderInfo = orders.find(o => o.orderID === orderID) || { orderID, deliveryInfo: '', shipmentIDs: [], deliveryStatus: '' };
                    orderInfo.deliveryInfo = deliveryInfo;
                    orderInfo.deliveryStatus = deliveryStatus;
                    orders = orders.filter(o => o.orderID !== orderID);
                    orders.push(orderInfo);
                    console.log('deliveryInfo et deliveryStatus stockés pour orderID :', deliveryInfo, deliveryStatus, orderID);
                }
            });

            GM_setValue('orders', orders);
        }
    }

    // Fonction pour extraire et stocker les commandes annulées
    function extractAndStoreCancelledOrders() {
        console.log('extractAndStoreCancelledOrders appelé');
        if (window.location.href.includes("order-history?orderFilter=cancelled")) {
            const orderElements = document.querySelectorAll('.yohtmlc-order');

            orderElements.forEach(orderElement => {
                const orderId = orderElement.querySelector('.a-color-secondary.value')?.textContent.trim();
                if (orderId) {
                    GM_setValue(`cancelledOrder_${orderId}`, true);
                    console.log('Commande annulée stockée :', orderId);
                }
            });
        }
    }

    // Fonction pour extraire et stocker les informations de livraison à partir de la page de l'historique des commandes
    function extractAndStoreLegacyDeliveryInfo() {
        console.log('extractAndStoreLegacyDeliveryInfo appelé');
        if (window.location.href.includes("your-orders/orders") || window.location.href.includes("order-history?ref_=nav_orders_first") || window.location.href.includes("your-account/order-history")) {
            let orders = GM_getValue('orders', []);

            let orderIDs = document.querySelectorAll('span.a-color-secondary.value');
            let deliveryInfos = document.querySelectorAll('.shipment-top-row .a-size-medium.a-color-base.a-text-bold');

            console.log('Éléments legacy trouvés :', orderIDs.length, deliveryInfos.length);

            orderIDs.forEach((orderIDElement, index) => {
                let orderID = orderIDElement.innerText.trim();
                let deliveryInfo = deliveryInfos[index]?.textContent.trim();
                let deliveryStatus = '';

                if (deliveryInfo && deliveryInfo.match(/^Livraison\s+\w{3}\.\s+\d{1,2}\s+\w+$/)) {
                    deliveryInfo = deliveryInfo.replace("Livraison ", "").trim();
                } else {
                    const shipmentInfoContainer = orderIDElement.closest('.shipment-top-row');
                    if (shipmentInfoContainer) {
                        const fallbackDeliveryInfo = shipmentInfoContainer.querySelector('.a-size-medium.a-color-base.a-text-bold');
                        if (fallbackDeliveryInfo) {
                            deliveryInfo = fallbackDeliveryInfo.textContent.trim();
                        }
                    }
                }

                if (deliveryInfo) {
                    if (deliveryInfo.toLowerCase().includes('livré')) {
                        deliveryStatus = 'Livré';
                    }
                    deliveryInfo = formatDate(deliveryInfo);
                    console.log('deliveryInfo formaté :', deliveryInfo);
                }

                if (orderID && deliveryInfo) {
                    let orderInfo = orders.find(o => o.orderID === orderID) || { orderID, deliveryInfo: '', shipmentIDs: [], deliveryStatus: '' };
                    orderInfo.deliveryInfo = deliveryInfo;
                    orderInfo.deliveryStatus = deliveryStatus;
                    orders = orders.filter(o => o.orderID !== orderID);
                    orders.push(orderInfo);
                    console.log('deliveryInfo et deliveryStatus legacy stockés pour orderID :', deliveryInfo, deliveryStatus, orderID);
                }
            });

            GM_setValue('orders', orders);
        }
    }

    // Fonction pour extraire les informations de livraison à partir d'une structure de bloc spécifique
    function extractDeliveryInfoFromBlock() {
        console.log('extractDeliveryInfoFromBlock appelé');
        let orders = GM_getValue('orders', []);
        const blocks = document.querySelectorAll('.a-box.shipment .a-box-inner');

        blocks.forEach(block => {
            const deliveryInfoElement = block.querySelector('.a-size-medium.a-color-base.a-text-bold');
            let deliveryInfo = '';
            let deliveryStatus = '';

            if (deliveryInfoElement) {
                deliveryInfo = deliveryInfoElement.textContent.trim();
                if (deliveryInfo.toLowerCase().includes('livré')) {
                    deliveryStatus = 'Livré';
                }
                deliveryInfo = formatDate(deliveryInfo);
            }

            const trackPackageLink = block.querySelector('.track-package-button a');
            let orderID = '';
            if (trackPackageLink) {
                const url = new URL(trackPackageLink.href);
                orderID = url.searchParams.get('orderId');
                const shipmentID = url.searchParams.get('shipmentId');

                if (orderID && shipmentID) {
                    let orderInfo = orders.find(o => o.orderID === orderID) || { orderID, deliveryInfo: '', shipmentIDs: [], deliveryStatus: '' };
                    if (!orderInfo.shipmentIDs.includes(shipmentID)) {
                        orderInfo.shipmentIDs.push(shipmentID);
                    }
                    orders = orders.filter(o => o.orderID !== orderID);
                    orders.push(orderInfo);
                    console.log('ShipmentID de bloc stocké pour orderID :', shipmentID, orderID);
                }
            }

            if (orderID && deliveryInfo) {
                let orderInfo = orders.find(o => o.orderID === orderID) || { orderID, deliveryInfo: '', shipmentIDs: [], deliveryStatus: '' };
                orderInfo.deliveryInfo = deliveryInfo;
                orderInfo.deliveryStatus = deliveryStatus;
                orders = orders.filter(o => o.orderID !== orderID);
                orders.push(orderInfo);
                console.log('deliveryInfo et deliveryStatus de bloc stockés pour orderID :', deliveryInfo, deliveryStatus, orderID);
            }
        });

        GM_setValue('orders', orders);
    }

    // Fonction pour extraire l'ID de commande à partir de l'URL du bouton "Détails"
    function extractOrderID(detailsButton) {
        const url = new URL(detailsButton.href);
        return url.searchParams.get("orderID") || url.pathname.split('/vine/orders/')[1].split('?')[0];
    }

    // Fonction pour analyser les chaînes de date en objets Date
    function parseDate(dateString) {
        const now = new Date();
        dateString = dateString.toLowerCase();

        // Supprimer le préfixe "livraison prévue" s'il existe
        dateString = dateString.replace('livraison prévue ', '').trim();

        // Gérer les dates relatives
        if (dateString.includes('aujourd\'hui')) {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (dateString.includes('demain')) {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        } else if (dateString.includes('après-demain')) {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
        } else {
            // Gérer les noms de jours
            const daysOfWeek = {
                'dimanche': 0,
                'lundi': 1,
                'mardi': 2,
                'mercredi': 3,
                'jeudi': 4,
                'vendredi': 5,
                'samedi': 6
            };

            for (let dayName in daysOfWeek) {
                if (dateString.includes(dayName)) {
                    const targetDay = daysOfWeek[dayName];
                    const currentDay = now.getDay();
                    let daysToAdd = targetDay - currentDay;
                    if (daysToAdd <= 0) {
                        daysToAdd += 7;
                    }
                    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd);
                }
            }

            // Gérer les dates du type "27 août" ou "27 août 2023"
            const monthsFull = {
                'janvier': 0,
                'février': 1,
                'mars': 2,
                'avril': 3,
                'mai': 4,
                'juin': 5,
                'juillet': 6,
                'août': 7,
                'septembre': 8,
                'octobre': 9,
                'novembre': 10,
                'décembre': 11
            };

            const dateRegex = /(\d{1,2})\s+([a-zéû]+)(?:\s+(\d{4}))?/i;
            const match = dateString.match(dateRegex);

            if (match) {
                const day = parseInt(match[1], 10);
                const monthName = match[2].toLowerCase();
                const year = parseInt(match[3], 10) || now.getFullYear();

                const monthIndex = monthsFull[monthName];
                if (monthIndex !== undefined) {
                    return new Date(year, monthIndex, day);
                }
            }
        }

        return null;
    }

    // Fonction pour corréler et afficher les informations de livraison sur la page des commandes Vine
    function correlateAndDisplayDeliveryInfo() {
        console.log('correlateAndDisplayDeliveryInfo appelé');
        if (window.location.href.includes("vine/orders")) {
            let orderRows = document.querySelectorAll('tr.vvp-orders-table--row');
            let orders = GM_getValue('orders', []);

            // Vérifier et ajouter la colonne d'en-tête si elle n'existe pas
            let headingRow = document.querySelector('tr.vvp-orders-table--heading-row');
            if (headingRow) {
                // Vérifier si la colonne "Date de livraison" existe déjà
                let existingHeader = Array.from(headingRow.children).find(th => th.textContent.trim() === 'Date de livraison');
                if (!existingHeader) {
                    let deliveryDateHeader = document.createElement('th');
                    deliveryDateHeader.textContent = 'Date de livraison';
                    deliveryDateHeader.style.whiteSpace = 'nowrap'; // Empêcher le retour à la ligne
                    headingRow.insertBefore(deliveryDateHeader, headingRow.children[3]);
                }
            }

            orderRows.forEach(row => {
                // Vérifier si la cellule "Date de livraison" existe déjà
                let existingDeliveryDateCell = row.querySelector('.delivery-date-cell');
                if (existingDeliveryDateCell) {
                    existingDeliveryDateCell.remove(); // Supprimer l'ancienne cellule pour la mettre à jour
                }

                let detailsButton = row.querySelector('a[name="vvp-orders-table--order-details-btn"]');
                if (!detailsButton) detailsButton = row.querySelector('a[id^="a-autoid-"]');

                let deliveryDateCell = document.createElement('td');
                deliveryDateCell.classList.add('vvp-orders-table--text-col', 'delivery-date-cell');

                if (detailsButton) {
                    let orderID = extractOrderID(detailsButton);
                    if (!orderID && detailsButton.href.includes('enrollment-asin=')) {
                        deliveryDateCell.innerHTML = 'Non disponible';
                        deliveryDateCell.style.color = '#';
                    } else if (orderID) {
                        let orderInfo = orders.find(o => o.orderID === orderID) || { deliveryInfo: '', deliveryStatus: '' };
                        let deliveryInfo = orderInfo.deliveryInfo;
                        let deliveryStatus = orderInfo.deliveryStatus;

                        if (deliveryInfo) {
                            if (deliveryStatus === 'Livré') {
                                deliveryDateCell.innerHTML = `<strong>Livré : ${deliveryInfo}</strong>`;
                                deliveryDateCell.style.color = 'green';
                            } else {
                                // Calculer la date de livraison et la différence en jours
                                let deliveryDate = parseDate(deliveryInfo);
                                if (deliveryDate) {
                                    const now = new Date();
                                    const diffTime = deliveryDate - now;
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                    deliveryDateCell.innerHTML = deliveryInfo;

                                    // Appliquer le code couleur
                                    if (diffDays === 0) {
                                        deliveryDateCell.style.color = '#1fe300';
                                    } else if (diffDays === 1) {
                                        deliveryDateCell.style.color = '#00c7d1';
                                    } else if (diffDays === 2) {
                                        deliveryDateCell.style.color = '#f98941';
                                    } else if (diffDays > 2 && diffDays <= 7) {
                                        deliveryDateCell.style.color = '#be31fa';
                                    } else {
                                        deliveryDateCell.style.color = ''; // Couleur par défaut
                                    }
                                } else {
                                    deliveryDateCell.style.color = ''; // Couleur par défaut
                                }
                            }
                        } else {
                            deliveryDateCell.innerHTML = 'Non disponible';
                            deliveryDateCell.style.color = '#ff002b';
                        }
                    }
                } else {
                    deliveryDateCell.innerHTML = 'Non disponible';
                    deliveryDateCell.style.color = '#ff002b';
                }

                let orderDateCell = row.querySelector('td[data-order-timestamp]');
                if (orderDateCell) {
                    orderDateCell.insertAdjacentElement('afterend', deliveryDateCell);
                } else {
                    row.appendChild(deliveryDateCell);
                }

                if (detailsButton) {
                    let orderID = extractOrderID(detailsButton);
                    if (!orderID) {
                        console.log('Order ID introuvable pour le bouton détails :', detailsButton.href);
                        return; // Passer cette ligne si l'ID de commande n'est pas trouvé
                    }
                    let isCancelled = GM_getValue(`cancelledOrder_${orderID}`, false);
                    if (isCancelled) {
                        row.style.backgroundColor = 'rgba(255, 0, 0, 0.33)';
                    }
                }
            });
        }
    }

    // Fonction pour ajouter le bouton "Synchroniser" à la page des commandes Vine
    function addSyncButton() {
        console.log('addSyncButton appelé');
        if (window.location.href.includes("vine/orders")) {
            const syncButton = document.createElement('button');
            syncButton.classList.add('a-button', 'a-button-base', 'vvp-orders-table--action-btn', 'sync-button');
            syncButton.textContent = 'Synchroniser';
            syncButton.style.backgroundColor = '#0073bb';
            syncButton.style.color = 'white';
            syncButton.style.border = '1px solid #0073bb';
            syncButton.style.marginLeft = '10px';

            syncButton.addEventListener('click', function() {
                syncDeliveryData();
            });

            const imageColHeading = document.querySelector('#vvp-orders-table--image-col-heading');
            if (imageColHeading) {
                imageColHeading.appendChild(syncButton);
            }
        }
    }

    // Fonction pour synchroniser les données de livraison
    function syncDeliveryData() {
        console.log('syncDeliveryData appelé');

        // Vérifier si nous sommes déjà sur la page des commandes
        if (window.location.href.includes("your-orders/orders")) {
            // Extraire les données
            extractAndStoreOrderInfo();
            extractAndStoreCancelledOrders();
            extractAndStoreLegacyDeliveryInfo();
            extractDeliveryInfoFromBlock();

            // Indiquer que la synchronisation est terminée
            GM_setValue('syncComplete', true);

            // Fermer l'onglet après un délai
            setTimeout(() => {
                window.close();
            }, 3000); // Ferme la fenêtre après 3 secondes
        } else {
            // Réinitialiser le flag de synchronisation
            GM_setValue('syncComplete', false);

            // Ouvrir la page des commandes dans un nouvel onglet
            const ordersUrl = 'https://www.amazon.fr/your-orders/orders?timeFilter=year-2024&ref_=ppx_yo2ov_dt_b_filter_all_y2024';
            const newTab = window.open(ordersUrl, '_blank');

            // Vérifier si le navigateur permet d'accéder à la fenêtre ouverte
            if (newTab) {
                // Attendre que la synchronisation soit terminée
                const checkSyncComplete = setInterval(() => {
                    const syncComplete = GM_getValue('syncComplete', false);
                    if (syncComplete) {
                        clearInterval(checkSyncComplete);
                        // Mettre à jour les statistiques et l'affichage
                        const stats = calculateDeliveryStats();
                        displayDeliveryStats(stats);
                        correlateAndDisplayDeliveryInfo(); // Mettre à jour l'affichage
                    }
                }, 1000); // Vérifie toutes les secondes
            } else {
                alert('Veuillez autoriser les fenêtres contextuelles pour que la synchronisation fonctionne.');
            }
        }
    }

    // Fonction pour calculer les statistiques de livraison
    function calculateDeliveryStats() {
        console.log('Calcul des statistiques de livraison...');
        const now = new Date();
        let stats = {
            today: 0,
            tomorrow: 0,
            dayAfterTomorrow: 0,
            next7Days: 0
        };

        const orders = GM_getValue('orders', []);

        orders.forEach(orderInfo => {
            if (orderInfo.deliveryInfo) {
                let deliveryDate = parseDate(orderInfo.deliveryInfo);
                if (deliveryDate) {
                    const diffTime = deliveryDate - now;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    // Si le produit est déjà livré, on ne le considère pas dans les statistiques
                    if (orderInfo.deliveryStatus === 'Livré') {
                        // Ne rien faire, ne pas inclure dans les statistiques
                    } else {
                        if (diffDays === 0) {
                            stats.today++;
                        } else if (diffDays === 1) {
                            stats.tomorrow++;
                        } else if (diffDays === 2) {
                            stats.dayAfterTomorrow++;
                        } else if (diffDays > 2 && diffDays <= 7) {
                            stats.next7Days++;
                        }
                    }
                }
            }
        });

        return stats;
    }

    // Fonction pour afficher les statistiques de livraison dans le DOM
    function displayDeliveryStats(stats) {
        const headingDiv = document.querySelector('.vvp-orders-table--heading-top');
        if (!headingDiv) {
            console.error('Conteneur de titre introuvable');
            return;
        }

        // Supprimer les statistiques existantes
        const existingStatsDiv = document.getElementById('delivery-stats');
        if (existingStatsDiv) {
            existingStatsDiv.remove();
        }

        // Créer et insérer les nouvelles statistiques
        const statsDiv = document.createElement('div');
        statsDiv.id = 'delivery-stats';
        statsDiv.style.marginTop = '10px';
        statsDiv.style.fontSize = '14px';
        statsDiv.style.color = '#555';

        statsDiv.innerHTML = `
            <strong>Statistiques de livraison :</strong>
            <ul style="margin: 5px 0; padding-left: 20px; list-style-type: disc;">
                <li>Livraisons aujourd'hui : <span style="color: #1fe300;">${stats.today}</span></li>
                <li>Livraisons demain : <span style="color: #00c7d1;">${stats.tomorrow}</span></li>
                <li>Livraisons après-demain : <span style="color: #f98941">${stats.dayAfterTomorrow}</span></li>
                <li>Livraisons dans les 7 prochains jours : <span style="color: #be31fa;">${stats.next7Days}</span></li>
            </ul>
        `;

        headingDiv.appendChild(statsDiv);
    }

    // Fonction pour observer les mutations du DOM (pour gérer les changements de page)
    function observeDOMChanges() {
        const targetNode = document.querySelector('#vvp-orders-table--tbody');
        if (!targetNode) {
            console.log('Nœud cible pour l\'observateur de mutations introuvable.');
            return;
        }

        const config = { childList: true, subtree: true };
        const callback = function(mutationsList, observer) {
            for (let mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    main(); // Réexécuter le script sur les nouvelles pages
                    break;
                }
            }
        };

        const observer = new MutationObserver(callback);
        observer.observe(targetNode, config);
    }

    // Fonction principale
    function main() {
        console.log('Fonction principale appelée');

        // Si nous sommes sur la page des commandes, extraire les données
        if (window.location.href.includes("your-orders/orders")) {
            syncDeliveryData();
        } else {
            // Sinon, exécuter le script normalement
            extractAndStoreOrderInfo();
            extractAndStoreCancelledOrders();
            extractAndStoreLegacyDeliveryInfo();
            extractDeliveryInfoFromBlock();
            correlateAndDisplayDeliveryInfo();
            addSyncButton();

            // Calculer et afficher les statistiques de livraison
            const stats = calculateDeliveryStats();
            displayDeliveryStats(stats);
        }
    }

    // Appeler main() lors du chargement initial
    window.addEventListener('load', () => {
        main();
        observeDOMChanges(); // Commencer à observer les changements du DOM
    });

    // Menu du script (si nécessaire)
    GM_registerMenuCommand('Mettre à jour les statistiques de livraison', () => {
        main();
        alert('Les statistiques de livraison ont été mises à jour.');
    });

})();
