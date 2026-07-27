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
                <li style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 3px; background-color: #0f172a; display: inline-block;"></span> Frontière Préfecture</li>
                <li style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 3px; background-color: #0284c7; border-bottom: 2px dashed #38bdf8; display: inline-block;"></span> Ville de Meknès</li>
                <li style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 3px; background-color: #64748b; border-bottom: 2px dotted #cbd5e1; display: inline-block;"></span> Communes Rur./Urb.</li>
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
const cityLayer = L.featureGroup().addTo(map);
const communesLayer = L.featureGroup().addTo(map);
const routeLayer = L.featureGroup().addTo(map);

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
                let dissolvedRes = residentialGeoJSON;
                try {
                    const polys = residentialGeoJSON.features.filter(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
                    if (polys.length > 0) {
                        dissolvedRes = turf.dissolve(turf.featureCollection(polys));
                    }
                } catch (e) { console.warn("Dissolve residential error:", e); }
                L.geoJSON(dissolvedRes, {
                    style: { color: '#ef4444', weight: 0.5, fillOpacity: 0.25 },
                    interactive: false
                }).addTo(habitableLayer);
            }
        } catch (e) { }

        document.getElementById('loading-text').innerText = "Chargement des limites de la ville...";
        try {
            const cityResponse = await fetch("city.json");
            if (cityResponse.ok) {
                const cityData = await cityResponse.json();
                const cityGeoJSON = osmtogeojson(cityData);
                cityGeoJSON.features.forEach(f => {
                    if (f.geometry && f.geometry.type === 'Polygon' && f.geometry.coordinates.length > 1) {
                        f.geometry.coordinates = [f.geometry.coordinates[0]];
                    } else if (f.geometry && f.geometry.type === 'MultiPolygon') {
                        f.geometry.coordinates = f.geometry.coordinates.map(poly => poly.length > 0 ? [poly[0]] : poly);
                    }
                });
                L.geoJSON(cityGeoJSON, {
                    filter: function(feature) { return feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon' || feature.geometry.type === 'LineString'); },
                    style: { color: '#0284c7', weight: 3, dashArray: '8, 6', fill: false, opacity: 0.85 },
                    interactive: false
                }).addTo(cityLayer);
            }
        } catch (e) { console.warn("City border error:", e); }

        document.getElementById('loading-text').innerText = "Chargement des communes...";
        try {
            const commResponse = await fetch("communes.json");
            if (commResponse.ok) {
                const commData = await commResponse.json();
                const commGeoJSON = osmtogeojson(commData);
                L.geoJSON(commGeoJSON, {
                    filter: function(feature) {
                        if (!feature.geometry || !(feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon' || feature.geometry.type === 'LineString')) return false;
                        const str = JSON.stringify(feature).toLowerCase();
                        if (str.includes('2561177') || str.includes('2561178') || str.includes('machouar') || str.includes('المشور')) return false;
                        if (feature.properties && feature.properties.tags) {
                            const name = (feature.properties.tags['name:fr'] || feature.properties.tags['name'] || '').toLowerCase();
                            if (name === 'meknès' || name === 'meknes' || name.includes('machouar') || name.includes('stinia')) return false;
                        }
                        return true;
                    },
                    style: { color: '#64748b', weight: 1.5, dashArray: '4, 4', fill: false, opacity: 0.6 },
                    onEachFeature: function(feature, layer) {
                        if (feature.properties && feature.properties.tags) {
                            const name = feature.properties.tags['name:fr'] || feature.properties.tags['name'] || feature.properties.tags['name:ar'];
                            if (name) {
                                layer.bindTooltip(name, { sticky: true, className: 'commune-tooltip' });
                            }
                        }
                    }
                }).addTo(communesLayer);
            }
        } catch (e) { console.warn("Communes border error:", e); }

        document.getElementById('loading-indicator').classList.add('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');

        const secureData = sessionStorage.getItem('secureData');
        if (!secureData) {
            window.location.href = 'index.html';
            return;
        }

        Papa.parse(secureData, {
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

    } catch (error) {
        console.error(error);
        document.getElementById('loading-text').innerText = "Erreur de chargement.";
    }
}

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
        const latinAddress = row['Latin_Address'] || "";
        const phone = row['Phone_Number'] || row['Phone'] || "";
        
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

        const popupHTML = `
            <div class="popup-content" style="direction: rtl; text-align: right; font-family: 'Inter', 'Segoe UI', sans-serif; min-width: 260px; color: #f8fafc;">
                <h3 style="margin: 0 0 4px 0; font-size: 1.15rem; color: #ffffff; border-bottom: 2px solid ${color}; padding-bottom: 6px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${markerName}</h3>
                ${latinName ? `<div style="direction: ltr; text-align: left; font-weight: 600; font-size: 0.9rem; color: #cbd5e1; margin-bottom: 10px;">${latinName}</div>` : ''}
                
                <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem; color: #e2e8f0; margin-top: 8px;">
                    <div style="display: flex; align-items: baseline; gap: 6px;">
                        <strong style="color: #94a3b8; min-width: 95px;">المؤسسة الأم:</strong> 
                        <span style="font-weight: 500; color: #ffffff;">${parent}</span>
                    </div>
                    <div style="display: flex; align-items: baseline; gap: 6px;">
                        <strong style="color: #94a3b8; min-width: 95px;">العنوان (عربي):</strong> 
                        <span style="color: #cbd5e1;">${row['العنوان'] || '---'}</span>
                    </div>
                    ${latinAddress ? `
                    <div style="direction: ltr; text-align: left; background: rgba(59, 130, 246, 0.15); padding: 8px 10px; border-radius: 6px; border-left: 3px solid #3b82f6; margin: 4px 0;">
                        <div style="font-size: 0.75rem; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;"><i class="fa-solid fa-map-location-dot" style="color: #60a5fa; margin-right: 4px;"></i> Adresse Latin</div>
                        <div style="font-size: 0.85rem; color: #ffffff; font-weight: 500;">${latinAddress}</div>
                    </div>` : ''}
                    ${phone ? `
                    <div style="direction: ltr; text-align: left; display: flex; align-items: center; gap: 8px; background: rgba(34, 197, 94, 0.15); padding: 8px 10px; border-radius: 6px; border-left: 3px solid #22c55e; margin: 2px 0;">
                        <i class="fa-solid fa-phone" style="color: #4ade80;"></i>
                        <strong style="color: #86efac; font-size: 0.85rem;">Tél:</strong> 
                        <a href="tel:${phone}" style="color: #ffffff; font-weight: 600; text-decoration: none;">${phone}</a>
                    </div>` : ''}
                    <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 4px;">
                        <strong style="color: #94a3b8; min-width: 95px;">السلك التعليمي:</strong> 
                        <span style="background: rgba(255, 255, 255, 0.15); color: #ffffff; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; border: 1px solid rgba(255,255,255,0.2);">${cycle}</span>
                    </div>
                    ${capacity > 0 ? `
                    <div style="display: flex; align-items: center; gap: 6px; background: rgba(250, 204, 21, 0.15); border: 1px solid rgba(250, 204, 21, 0.3); padding: 6px 10px; border-radius: 6px; color: #fde047; font-weight: bold; margin-top: 4px;">
                        <i class="fa-solid fa-bed" style="color: #facc15;"></i> capacité de l'internat: ${capacity}
                    </div>` : ''}
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.15); display: flex; justify-content: center;">
                        <button onclick="drawRouteToAdmin(${lat}, ${lng}, '${markerName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" style="width: 100%; padding: 10px 14px; background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; border: 1px solid rgba(255,255,255,0.25); border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4); transition: all 0.2s;">
                            <i class="fa-solid fa-route" style="color: #38bdf8; font-size: 1rem;"></i>
                            <span>مسار نحو المديرية / Route vers la Direction</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        marker.bindPopup(popupHTML);

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
        const dissolvedPrimary = turf.dissolve(turf.featureCollection(buffers.primary));
        L.geoJSON(dissolvedPrimary, { style: { color: primaryColor, weight: 1, fillOpacity: 0.2 }, interactive: false }).addTo(bufferPrimaryLayer);
    }
    if (buffers.secondary.length > 0) {
        const dissolvedSecondary = turf.dissolve(turf.featureCollection(buffers.secondary));
        L.geoJSON(dissolvedSecondary, { style: { color: secondaryColor, weight: 1, fillOpacity: 0.2 }, interactive: false }).addTo(bufferSecondaryLayer);
    }
    if (buffers.high.length > 0) {
        const dissolvedHigh = turf.dissolve(turf.featureCollection(buffers.high));
        L.geoJSON(dissolvedHigh, { style: { color: highColor, weight: 1, fillOpacity: 0.2 }, interactive: false }).addTo(bufferHighLayer);
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
document.getElementById('toggle-city').addEventListener('change', e => e.target.checked ? map.addLayer(cityLayer) : map.removeLayer(cityLayer));
document.getElementById('toggle-communes').addEventListener('change', e => e.target.checked ? map.addLayer(communesLayer) : map.removeLayer(communesLayer));

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

// Mobile UI Toggle Logic
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.getElementById('sidebar');
const mobileOverlay = document.getElementById('mobile-overlay');

if (mobileMenuBtn && sidebar && mobileOverlay) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('show-sidebar');
        mobileOverlay.classList.add('active');
    });

    mobileOverlay.addEventListener('click', () => {
        sidebar.classList.remove('show-sidebar');
        mobileOverlay.classList.remove('active');
    });
}

// Route Construction to Administration (DPEN)
async function drawRouteToAdmin(schoolLat, schoolLng, schoolName) {
    const dpenLat = 33.899868044613605;
    const dpenLng = -5.526798366916536;
    
    routeLayer.clearLayers();
    map.closePopup();
    
    const routeCard = document.getElementById('route-card');
    const routeDetails = document.getElementById('route-details');
    if (routeCard && routeDetails) {
        routeCard.classList.remove('hidden');
        routeDetails.innerHTML = `<div style="display: flex; align-items: center; gap: 10px; color: #38bdf8; padding: 10px 0;"><div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div> <span>جاري حساب المسار... / Calcul de l'itinéraire...</span></div>`;
    }
    
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${schoolLng},${schoolLat};${dpenLng},${dpenLat}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        let distanceKm = 0;
        let durationMin = 0;
        
        if (response.ok) {
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                distanceKm = (route.distance / 1000).toFixed(1);
                durationMin = Math.round(route.duration / 60);
                
                // Outer glow
                L.geoJSON(route.geometry, {
                    style: { color: '#38bdf8', weight: 12, opacity: 0.35, lineCap: 'round', lineJoin: 'round' },
                    interactive: false
                }).addTo(routeLayer);
                
                // Main route line
                L.geoJSON(route.geometry, {
                    style: { color: '#0284c7', weight: 5, opacity: 0.95, dashArray: '12, 10', lineCap: 'round', lineJoin: 'round' },
                    interactive: false
                }).addTo(routeLayer);
            }
        }
        
        // Fallback if OSRM fails or returns no route
        if (routeLayer.getLayers().length === 0) {
            const line = L.polyline([[schoolLat, schoolLng], [dpenLat, dpenLng]], {
                color: '#0284c7', weight: 5, opacity: 0.9, dashArray: '12, 10'
            }).addTo(routeLayer);
            distanceKm = (turf.distance([schoolLng, schoolLat], [dpenLng, dpenLat])).toFixed(1);
            durationMin = Math.round(distanceKm * 2);
        }
        
        // Add start and end pulsing circle markers
        L.circleMarker([schoolLat, schoolLng], {
            radius: 8, fillColor: '#22c55e', color: '#ffffff', weight: 2, fillOpacity: 1
        }).addTo(routeLayer).bindTooltip(`<b>الإنطلاق:</b> ${schoolName}`, { direction: 'top', sticky: true });
        
        L.circleMarker([dpenLat, dpenLng], {
            radius: 9, fillColor: '#ef4444', color: '#ffffff', weight: 2, fillOpacity: 1
        }).addTo(routeLayer).bindTooltip('<b>الوجهة:</b> المديرية الإقليمية بمكناس', { direction: 'top', sticky: true });
        
        // Fit map bounds to show entire route with smooth padding
        map.fitBounds(routeLayer.getBounds(), { padding: [70, 70], maxZoom: 15, animate: true });
        
        if (routeCard && routeDetails) {
            routeDetails.innerHTML = `
                <div style="font-weight: 600; color: #ffffff; margin-bottom: 8px; font-size: 0.95rem; border-bottom: 1px dashed rgba(255,255,255,0.15); padding-bottom: 6px;">🏫 ${schoolName}</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(0,0,0,0.3); padding: 10px 12px; border-radius: 8px; margin-top: 6px; border: 1px solid rgba(255,255,255,0.08);">
                    <div style="text-align: center; border-left: 1px solid rgba(255,255,255,0.1);">
                        <span style="color: #94a3b8; font-size: 0.75rem; display: block; margin-bottom: 2px;">المسافة / Distance</span>
                        <strong style="color: #38bdf8; font-size: 1.1rem; font-weight: 700;">${distanceKm} كم</strong>
                    </div>
                    <div style="text-align: center;">
                        <span style="color: #94a3b8; font-size: 0.75rem; display: block; margin-bottom: 2px;">المدة / Durée approx.</span>
                        <strong style="color: #4ade80; font-size: 1.1rem; font-weight: 700;">~${durationMin} دقيقة</strong>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        console.error("Route error:", e);
        if (routeCard && routeDetails) {
            routeDetails.innerHTML = `<div style="color: #ef4444; padding: 10px 0;">تعذر حساب المسار. / Erreur de calcul.</div>`;
        }
    }
}

function clearRouteToAdmin() {
    routeLayer.clearLayers();
    const routeCard = document.getElementById('route-card');
    if (routeCard) routeCard.classList.add('hidden');
}

window.drawRouteToAdmin = drawRouteToAdmin;
window.clearRouteToAdmin = clearRouteToAdmin;
