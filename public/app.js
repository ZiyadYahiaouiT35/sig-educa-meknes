const map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([33.89, -5.55], 13);
L.control.zoom({ position: 'topright' }).addTo(map);

const legend = L.control({ position: 'bottomright' });
legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
        <div style="padding: 1rem; background: rgba(15, 23, 42, 0.9); border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <h3 style="margin-top: 0; font-size: 0.9rem; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.8rem;">Légende</h3>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.85rem; color: #e2e8f0; display: flex; flex-direction: column; gap: 8px;">
                <li style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 12px; border-radius: 50%; background-color: #3b82f6; display: inline-block;"></span> Écoles Primaires</li>
                <li style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 12px; border-radius: 50%; background-color: #22c55e; display: inline-block;"></span> Collèges</li>
                <li style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 12px; border-radius: 50%; background-color: #ef4444; display: inline-block;"></span> Lycées</li>
                <li style="display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-star" style="color: #facc15; font-size: 14px;"></i> DPEN Meknès</li>
                <li style="display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-shield-halved" style="color: #8b5cf6; font-size: 14px;"></i> Académie Militaire</li>
                <li style="display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-eye-slash" style="color: #06b6d4; font-size: 14px;"></i> Institut pour Malvoyants</li>
                <li style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 12px; border-radius: 50%; border: 2px solid #facc15; background-color: transparent; display: inline-block;"></span> Internat</li>
            </ul>
        </div>
    `;
    // Prevent clicks from propagating to the map
    L.DomEvent.disableClickPropagation(div);
    return div;
};
legend.addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd', maxZoom: 19
}).addTo(map);

const starIcon = L.divIcon({
    html: '<i class="fa-solid fa-star fa-2x" style="color: #facc15; text-shadow: 1px 1px 3px rgba(0,0,0,0.5); font-size: 24px;"></i>',
    className: 'custom-star-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});

const dpenMarker = L.marker([33.899868044613605, -5.526798366916536], { icon: starIcon }).addTo(map);
dpenMarker.bindPopup('<div style="direction: rtl; text-align: center;"><strong>المديرية الإقليمية لوزارة التربية الوطنية بمكناس</strong><br><span style="direction: ltr; display: block; margin-top: 5px; font-size: 12px; color: #666;">Direction Provinciale de l\'Education Nationale Meknès</span></div>');

const borderLayer = L.featureGroup().addTo(map);
const habitableLayer = L.featureGroup().addTo(map);

const schoolsPrimaryLayer = L.featureGroup().addTo(map);
const schoolsSecondaryLayer = L.featureGroup().addTo(map);
const schoolsHighLayer = L.featureGroup().addTo(map);

const bufferPrimaryLayer = L.featureGroup();
const bufferSecondaryLayer = L.featureGroup();
const bufferHighLayer = L.featureGroup();

let heatLayer;
let heatPoints = [];
let allMarkers = [];

const RADII = {
    'primary': 1.5,
    'secondary': 2.5,
    'high': 3.5
};

async function init() {
    try {
        document.getElementById('loading-text').innerText = "Chargement de la frontière...";
        try {
            const borderResponse = await fetch("border.json");
            if (borderResponse.ok) {
                const borderData = await borderResponse.json();
                const borderGeoJSON = osmtogeojson(borderData);
                L.geoJSON(borderGeoJSON, {
                    filter: function(feature) { return feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon' || feature.geometry.type === 'LineString'); },
                    style: { color: '#0f172a', weight: 4, fill: false, opacity: 0.8 },
                    interactive: false
                }).addTo(borderLayer);
            }
        } catch (e) { }

        document.getElementById('loading-text').innerText = "Chargement des zones habitables...";
        try {
            const resResponse = await fetch("residential.json");
            if (resResponse.ok) {
                const resData = await resResponse.json();
                const residentialGeoJSON = osmtogeojson(resData);
                L.geoJSON(residentialGeoJSON, {
                    filter: function(feature) { return feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon'); },
                    style: { color: '#ef4444', weight: 1, fillOpacity: 0.6 },
                    interactive: false
                }).addTo(habitableLayer);
            }
        } catch (e) { }

        document.getElementById('loading-indicator').classList.add('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');

    } catch (error) {
        console.error(error);
        document.getElementById('loading-text').innerText = "Erreur de chargement.";
    }
}

// Security / Decryption Logic
const loginBtn = document.getElementById('login-btn');
const loginKeyInput = document.getElementById('login-key');
const loginError = document.getElementById('login-error');
const loginOverlay = document.getElementById('login-overlay');
const loginSpinner = document.getElementById('login-spinner');
const loginBtnText = document.getElementById('login-btn-text');

loginBtn.addEventListener('click', async () => {
    const key = loginKeyInput.value.trim();
    if (!key) return;

    loginError.innerText = "";
    loginBtn.disabled = true;
    loginSpinner.classList.remove('hidden');
    loginBtnText.classList.add('hidden');

    try {
        const response = await fetch("data.enc");
        if (!response.ok) throw new Error("Fichier chiffré introuvable");
        const encryptedData = await response.text();

        // Decrypt using CryptoJS
        const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
        const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

        if (!decryptedString) {
            throw new Error("Clé incorrecte");
        }

        // Hide login and parse data
        loginOverlay.style.opacity = "0";
        setTimeout(() => loginOverlay.classList.add('hidden'), 500);

        Papa.parse(decryptedString, {
            header: true,
            skipEmptyLines: true,
            complete: function (results) {
                processCSVData(results.data);
            },
            error: function (err) {
                console.error("CSV Parse Error:", err);
                alert("Erreur de format des données.");
            }
        });

    } catch (err) {
        loginError.innerText = "Clé incorrecte ou erreur réseau.";
        loginBtn.disabled = false;
        loginSpinner.classList.add('hidden');
        loginBtnText.classList.remove('hidden');
    }
});

// Allow Enter key to submit
loginKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

function processCSVData(data) {
    const parentCycles = {};

    data.forEach(row => {
        const parent = row['المؤسسة'];
        const cycle = row['السلك التعليمي'];
        if (!parent) return;

        if (!parentCycles[parent]) parentCycles[parent] = 'primary';

        if (cycle && cycle.includes("تأهيلي")) {
            parentCycles[parent] = 'high';
        } else if (cycle && cycle.includes("إعدادي") && parentCycles[parent] !== 'high') {
            parentCycles[parent] = 'secondary';
        }
    });

    const primaryColor = '#3b82f6';
    const secondaryColor = '#22c55e';
    const highColor = '#ef4444';

    const buffers = { primary: [], secondary: [], high: [] };

    data.forEach(row => {
        let rawLat = row['االإحداثيات العشرية خطوط العرض'] || row['خط العرض 1'] || "";
        let rawLng = row['االإحداثيات العشرية خطوط الطول'] || row['خط الطول 1'] || "";
        
        rawLat = rawLat.replace(',', '.');
        rawLng = rawLng.replace(',', '.');

        const lat = parseFloat(rawLng);
        const lng = parseFloat(rawLat);

        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

        const parent = row['المؤسسة'];
        const subSchool = row['المؤسسة  الوحدة 2'] || row['المؤسسة الوحدة 2'];
        const cycle = row['السلك التعليمي'];
        const capacity = parseInt(row['Internal_Residence_Capacity']) || 0;
        const latinName = row['Latin_Name'] || "";
        
        const tier = parentCycles[parent] || 'primary';
        let color = primaryColor;
        let radiusKm = RADII.primary;
        let targetLayer = schoolsPrimaryLayer;

        if (tier === 'high') {
            color = highColor;
            radiusKm = RADII.high;
            targetLayer = schoolsHighLayer;
        } else if (tier === 'secondary') {
            color = secondaryColor;
            radiusKm = RADII.secondary;
            targetLayer = schoolsSecondaryLayer;
        }

        const markerName = subSchool || parent;
        let isSpecial = false;
        let specialIconHTML = '';
        let specialColor = '';

        if (markerName.includes('العسكرية')) {
            isSpecial = true;
            specialColor = '#8b5cf6';
            specialIconHTML = '<i class="fa-solid fa-shield-halved fa-2x" style="color: #8b5cf6; text-shadow: 1px 1px 3px rgba(0,0,0,0.5); font-size: 20px;"></i>';
        } else if (markerName.includes('المكفوفين')) {
            isSpecial = true;
            specialColor = '#06b6d4';
            specialIconHTML = '<i class="fa-solid fa-eye-slash fa-2x" style="color: #06b6d4; text-shadow: 1px 1px 3px rgba(0,0,0,0.5); font-size: 20px;"></i>';
        }

        let marker;
        if (isSpecial) {
            const specialIcon = L.divIcon({
                html: specialIconHTML,
                className: 'custom-special-icon',
                iconSize: [20, 20],
                iconAnchor: [10, 10],
                popupAnchor: [0, -10]
            });
            marker = L.marker([lat, lng], {
                icon: specialIcon,
                _hasInternat: capacity > 0,
                _capacity: capacity,
                _originalColor: specialColor,
                _searchName: (markerName + " " + latinName).toLowerCase(),
                _displayName: markerName,
                _latinName: latinName,
                _isSpecial: true
            });
        } else {
            marker = L.circleMarker([lat, lng], {
                radius: 7,
                fillColor: color,
                color: '#ffffff',
                weight: 1,
                fillOpacity: 0.9,
                _hasInternat: capacity > 0,
                _capacity: capacity,
                _originalColor: color,
                _searchName: (markerName + " " + latinName).toLowerCase(),
                _displayName: markerName,
                _latinName: latinName,
                _isSpecial: false
            });
        }

        marker.bindPopup(`
            <div class="popup-content" style="direction: rtl; text-align: right;">
                <h3 style="margin-bottom: 5px;">${markerName}</h3>
                ${latinName ? `<p style="direction: ltr; text-align: left; font-weight: bold; margin-bottom: 5px;">${latinName}</p>` : ''}
                <p><strong>Établissement Mère:</strong> ${parent}</p>
                <p><strong>Adresse:</strong> ${row['العنوان']}</p>
                <p><strong>Cycle:</strong> ${cycle}</p>
                <p><strong>Capacité de l'Internat:</strong> ${capacity}</p>
            </div>
        `);

        marker.addTo(targetLayer);
        allMarkers.push(marker);
        heatPoints.push([lat, lng, 1]); // equal intensity

        try {
            const pt = turf.point([lng, lat]);
            const buffer = turf.buffer(pt, radiusKm, { units: 'kilometers' });
            buffers[tier].push(buffer);
        } catch (e) { }
    });

    if (buffers.primary.length > 0) {
        L.geoJSON(turf.featureCollection(buffers.primary), { style: { color: primaryColor, weight: 0, fillOpacity: 0.15 }, interactive: false }).addTo(bufferPrimaryLayer);
    }
    if (buffers.secondary.length > 0) {
        L.geoJSON(turf.featureCollection(buffers.secondary), { style: { color: secondaryColor, weight: 0, fillOpacity: 0.15 }, interactive: false }).addTo(bufferSecondaryLayer);
    }
    if (buffers.high.length > 0) {
        L.geoJSON(turf.featureCollection(buffers.high), { style: { color: highColor, weight: 0, fillOpacity: 0.15 }, interactive: false }).addTo(bufferHighLayer);
    }

    // Initialize Heatmap Layer
    heatLayer = L.heatLayer(heatPoints, {radius: 25, blur: 15, maxZoom: 15});

    updateDashboard(); // Initial calculation
}

// Search Functionality
const searchInput = document.getElementById('school-search');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    searchResults.innerHTML = '';
    
    if (term.length === 0) {
        searchResults.classList.add('hidden');
        return;
    }
    
    // Fuzzy match on _searchName (Arabic + Latin)
    const matches = allMarkers.filter(m => m.options._searchName.includes(term)).slice(0, 5);
    
    if (matches.length > 0) {
        searchResults.classList.remove('hidden');
        matches.forEach(marker => {
            const li = document.createElement('li');
            li.style.padding = '10px';
            li.style.cursor = 'pointer';
            li.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            li.innerText = marker.options._displayName + (marker.options._latinName ? ` (${marker.options._latinName})` : '');
            
            li.addEventListener('mouseover', () => li.style.background = 'rgba(255,255,255,0.1)');
            li.addEventListener('mouseout', () => li.style.background = 'transparent');
            
            li.addEventListener('click', () => {
                map.flyTo(marker.getLatLng(), 16);
                marker.openPopup();
                searchResults.classList.add('hidden');
                searchInput.value = marker.options._displayName;
            });
            searchResults.appendChild(li);
        });
    } else {
        searchResults.classList.add('hidden');
    }
});

// Hide search on click outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        searchResults.classList.add('hidden');
    }
});

// Dynamic Dashboard Analytics
function updateDashboard() {
    if (allMarkers.length === 0) return;
    const bounds = map.getBounds();
    let visibleCount = 0;
    let visibleCapacity = 0;
    
    allMarkers.forEach(marker => {
        if (bounds.contains(marker.getLatLng())) {
            // Check if marker's layer is actually added to map
            if (map.hasLayer(schoolsPrimaryLayer) && marker.options._originalColor === '#3b82f6' ||
                map.hasLayer(schoolsSecondaryLayer) && marker.options._originalColor === '#22c55e' ||
                map.hasLayer(schoolsHighLayer) && marker.options._originalColor === '#ef4444') {
                
                visibleCount++;
                visibleCapacity += marker.options._capacity || 0;
            }
        }
    });

    document.getElementById('visible-schools').innerText = visibleCount;
    document.getElementById('visible-capacity').innerText = visibleCapacity;
}

map.on('moveend', updateDashboard);
map.on('layeradd', updateDashboard);
map.on('layerremove', updateDashboard);

// UI Toggles
document.getElementById('toggle-border').addEventListener('change', e => e.target.checked ? map.addLayer(borderLayer) : map.removeLayer(borderLayer));
document.getElementById('toggle-habitable').addEventListener('change', e => e.target.checked ? map.addLayer(habitableLayer) : map.removeLayer(habitableLayer));

document.getElementById('toggle-schools-primary').addEventListener('change', e => e.target.checked ? map.addLayer(schoolsPrimaryLayer) : map.removeLayer(schoolsPrimaryLayer));
document.getElementById('toggle-schools-secondary').addEventListener('change', e => e.target.checked ? map.addLayer(schoolsSecondaryLayer) : map.removeLayer(schoolsSecondaryLayer));
document.getElementById('toggle-schools-high').addEventListener('change', e => e.target.checked ? map.addLayer(schoolsHighLayer) : map.removeLayer(schoolsHighLayer));

document.getElementById('toggle-buffers-primary').addEventListener('change', e => e.target.checked ? map.addLayer(bufferPrimaryLayer) : map.removeLayer(bufferPrimaryLayer));
document.getElementById('toggle-buffers-secondary').addEventListener('change', e => e.target.checked ? map.addLayer(bufferSecondaryLayer) : map.removeLayer(bufferSecondaryLayer));
document.getElementById('toggle-buffers-high').addEventListener('change', e => e.target.checked ? map.addLayer(bufferHighLayer) : map.removeLayer(bufferHighLayer));

// Internal Residence Highlight Toggle
document.getElementById('toggle-internal-residence').addEventListener('change', e => {
    const isChecked = e.target.checked;
    
    allMarkers.forEach(marker => {
        if (isChecked) {
            if (marker.options._hasInternat) {
                if (typeof marker.setStyle === 'function') {
                    marker.setStyle({
                        color: '#facc15',
                        weight: 3,
                        radius: 10,
                        fillOpacity: 1
                    });
                } else if (marker.options._isSpecial) {
                    marker._icon.style.filter = "drop-shadow(0px 0px 5px yellow)";
                }
            } else {
                if (typeof marker.setStyle === 'function') {
                    marker.setStyle({ fillOpacity: 0.1, weight: 0 });
                } else if (marker.options._isSpecial) {
                    marker._icon.style.opacity = "0.2";
                }
            }
        } else {
            if (typeof marker.setStyle === 'function') {
                marker.setStyle({
                    color: '#ffffff',
                    weight: 1,
                    radius: 7,
                    fillOpacity: 0.9,
                    fillColor: marker.options._originalColor
                });
            } else if (marker.options._isSpecial) {
                marker._icon.style.filter = "none";
                marker._icon.style.opacity = "1";
            }
        }
    });
});

// Heatmap Toggle
document.getElementById('toggle-heatmap').addEventListener('change', e => {
    if (e.target.checked) {
        map.addLayer(heatLayer);
        // Dim the markers so heatmap is visible
        allMarkers.forEach(m => {
            if (typeof m.setStyle === 'function') {
                m.setStyle({opacity: 0, fillOpacity: 0});
            } else if (m.options._isSpecial) {
                m._icon.style.opacity = "0";
            }
        });
    } else {
        map.removeLayer(heatLayer);
        // Restore markers
        allMarkers.forEach(m => {
            if (typeof m.setStyle === 'function') {
                m.setStyle({opacity: 1, fillOpacity: 0.9});
            } else if (m.options._isSpecial) {
                m._icon.style.opacity = "1";
            }
        });
        // Retrigger internal residence check if it's on
        const internatToggle = document.getElementById('toggle-internal-residence');
        if (internatToggle.checked) internatToggle.dispatchEvent(new Event('change'));
    }
});

init();
