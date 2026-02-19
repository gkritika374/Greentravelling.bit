// ---------- Data: States, Cities, Routes (extended Gorakhpur routes) ----------
const STATES = {
  "Uttar Pradesh": {
    "Gorakhpur": [
      // Many daily-life local routes (name and simple lat/lon path)
      { name:"GIDA → Khalilabad", path:[[26.780,83.375],[26.850,83.450],[26.930,83.520]] },
      { name:"GIDA → Gorakhnath", path:[[26.780,83.375],[26.800,83.350],[26.830,83.300]] },
      { name:"GIDA → Shashtri Chowk", path:[[26.780,83.375],[26.750,83.400],[26.720,83.420]] },
      { name:"Bit → Sehjwanwa", path:[[26.770,83.370],[26.780,83.340],[26.790,83.300]] },
      { name:"Sector-23 → Dharamshala", path:[[26.740,83.350],[26.750,83.320],[26.760,83.300]] },
      { name:"Shashtri Chowk → Dharamshala", path:[[26.720,83.420],[26.740,83.400],[26.760,83.380]] },

      // Additional daily routes inside Gorakhpur
      { name:"Golghar → Railway Station", path:[[26.760,83.370],[26.754,83.375],[26.748,83.382]] },
      { name:"Railway Station → BRD Medical College", path:[[26.748,83.382],[26.757,83.393],[26.763,83.398]] },
      { name:"Gorakhnath Temple → Shashtri Chowk", path:[[26.790,83.360],[26.760,83.380],[26.720,83.420]] },
      { name:"MMMUT → Golghar", path:[[26.735,83.365],[26.745,83.370],[26.760,83.370]] },
      { name:"Rapti Nagar → Gorakhnath Temple", path:[[26.768,83.347],[26.780,83.360],[26.790,83.360]] },
      { name:"Transport Nagar → Golghar", path:[[26.748,83.355],[26.755,83.365],[26.760,83.370]] },
      { name:"Mohaddipur → Shashtri Chowk", path:[[26.732,83.342],[26.738,83.356],[26.720,83.420]] },
      { name:"GIDA → MMMUT", path:[[26.780,83.375],[26.745,83.370]] },
      { name:"Medical College → Railway Station", path:[[26.763,83.398],[26.748,83.382]] }
    ],
    "Lucknow": [
      { name:"Charbagh → Hazratganj", path:[[26.8467,80.9462],[26.850,80.950],[26.850,80.920]] },
      { name:"Alambagh → Gomti Nagar", path:[[26.8467,80.9462],[26.840,80.950],[26.830,80.970]] }
    ]
  },

  "Bihar": {
    "Patna": [
      { name:"Gandhi Maidan → Danapur", path:[[25.60,85.12],[25.57,85.10],[25.55,85.09]] },
      { name:"Patna Junction → AIIMS", path:[[25.60,85.12],[25.61,85.15],[25.62,85.18]] }
    ]
  },

  "Delhi": {
    "Delhi": [
      { name:"ISBT → Connaught Place", path:[[28.61,77.23],[28.62,77.21],[28.63,77.20]] },
      { name:"Saket → Airport", path:[[28.52,77.21],[28.55,77.20],[28.58,77.22]] }
    ]
  }
};

// ---------- Globals ----------
let map;
let buses = [];        // {id, company, routeName, path, progress, seatsTotal, seatsTaken, rate, departure}
let busMarkers = {};
const COMPANY_NAMES = ["EcoRide","GreenWheels","ElectroBus","LeafLine"];

// ---------- Initialization ----------
window.addEventListener("load", () => {
  initMap();
  initDropdowns();
  seedBuses();
  drawRoutePolylines();
  renderBusMarkers();     // markers will be updated by movement
  hookEvents();
  startMovementLoop();
  loadProfileFromStorage();
});

// ---------- Map ----------
function initMap(){
  map = L.map("map").setView([26.78,83.38],13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19, attribution:"© OpenStreetMap"}).addTo(map);
}

// ---------- Dropdowns ----------
function initDropdowns(){
  const stateSel = document.getElementById("state");
  const citySel = document.getElementById("city");
  const routeSel = document.getElementById("route");

  Object.keys(STATES).forEach(st => stateSel.add(new Option(st, st)));
  stateSel.value = "Uttar Pradesh";

  function updateCities(){
    citySel.innerHTML = "";
    const cities = STATES[stateSel.value];
    Object.keys(cities).forEach(ct => citySel.add(new Option(ct, ct)));
    citySel.value = Object.keys(cities)[0];
    updateRoutes();
  }
  function updateRoutes(){
    routeSel.innerHTML = "";
    const routes = STATES[stateSel.value][citySel.value];
    routes.forEach(r => routeSel.add(new Option(r.name, r.name)));
    if(routes[0]) routeSel.value = routes[0].name;
  }

  stateSel.addEventListener("change", updateCities);
  citySel.addEventListener("change", updateRoutes);

  updateCities();
  document.getElementById("date").valueAsDate = new Date();
}

// ---------- Seed buses (two per route) ----------
function seedBuses(){
  buses = [];
  let id = 1;
  Object.keys(STATES).forEach(state => {
    Object.keys(STATES[state]).forEach(city => {
      STATES[state][city].forEach(routeObj => {
        // create 2 buses per route
        for(let n=0;n<2;n++){
          const rate = 30 + Math.floor(Math.random()*31); // 30-60
          buses.push({
            id: "EB" + (id++),
            company: COMPANY_NAMES[Math.floor(Math.random()*COMPANY_NAMES.length)],
            routeName: routeObj.name,
            path: routeObj.path,
            progress: Math.random(),
            seatsTotal: 20,
            seatsTaken: Math.floor(Math.random()*15),
            rate,
            departure: new Date(Date.now() + Math.floor(Math.random()*5)*3600000).toLocaleTimeString()
          });
        }
      });
    });
  });
}

// ---------- Draw polylines for routes ----------
function drawRoutePolylines(){
  Object.keys(STATES).forEach(state => {
    Object.keys(STATES[state]).forEach(city => {
      STATES[state][city].forEach(routeObj => {
        L.polyline(routeObj.path, {color:"#14a76c", weight:4, opacity:0.6}).addTo(map);
      });
    });
  });
}

// ---------- Movement: move buses along their paths ----------
function startMovementLoop(){
  // initial markers
  buses.forEach(b => {
    const pt = getPointAlongPath(b.path, b.progress);
    const marker = L.circleMarker(pt, {radius:7, fillColor:"#14a76c", color:"#0b6b3a", fillOpacity:1}).addTo(map);
    marker.bindPopup(popupContentForBus(b));
    busMarkers[b.id] = marker;
  });
  // animate
  setInterval(() => {
    buses.forEach(b => {
      b.progress += 0.01 + Math.random()*0.01; // vary speed a bit
      if(b.progress > 1) b.progress = 0;
      const pt = getPointAlongPath(b.path, b.progress);
      const marker = busMarkers[b.id];
      if(marker) {
        marker.setLatLng(pt);
        marker.setPopupContent(popupContentForBus(b));
      }
    });
  }, 900);
}

function popupContentForBus(b){
  return `<b>${b.company} (${b.id})</b><br>${b.routeName}<br>Seats free: ${b.seatsTotal - b.seatsTaken}<br>Fare: ₹${b.rate}<br>Dep: ${b.departure}<br><div style="margin-top:6px"><button onclick="openBooking('${b.id}')" style="padding:6px;border-radius:6px;border:none;background:#14a76c;color:white;cursor:pointer">Book</button></div>`;
}

// ---------- Helpers: get point along polyline ----------
function getPointAlongPath(path, t){
  if(!path || path.length === 0) return [0,0];
  if(path.length === 1) return path[0];
  // compute segment lengths
  let segLengths = [];
  let total = 0;
  for(let i=0;i<path.length-1;i++){
    const a = path[i], b = path[i+1];
    const d = distKm(a[0],a[1],b[0],b[1]);
    segLengths.push(d);
    total += d;
  }
  let remaining = t * total;
  for(let i=0;i<segLengths.length;i++){
    if(remaining <= segLengths[i]){
      const a = path[i], b = path[i+1];
      const ratio = segLengths[i] === 0 ? 0 : (remaining / segLengths[i]);
      const lat = a[0] + (b[0]-a[0]) * ratio;
      const lon = a[1] + (b[1]-a[1]) * ratio;
      return [lat, lon];
    }
    remaining -= segLengths[i];
  }
  return path[path.length-1];
}
function toRad(x){return x*Math.PI/180;}
function distKm(lat1,lon1,lat2,lon2){
  const R = 6371;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ---------- Render initial markers placeholder (movement loop creates markers) ----------
function renderBusMarkers(){ /* marker creation handled in startMovementLoop */ }

// ---------- UI: Search & Results ----------
function hookEvents(){
  document.getElementById("searchBtn").addEventListener("click", () => {
    const routeName = document.getElementById("route").value;
    const found = buses.filter(b => b.routeName === routeName);
    showBusList(found);
    // center map on route midpoint if possible
    centerMapOnRoute(routeName);
  });

  document.getElementById("locBtn").addEventListener("click", () => {
    if(!navigator.geolocation) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      L.circleMarker([lat,lon],{radius:8,fillColor:'#14a76c',color:'#0b6b3a',fillOpacity:1}).addTo(map);
      map.setView([lat,lon],13);
      updateNearbyCount(lat,lon);
      detectNearestCity(lat,lon);
    }, err => alert("Location not available"));
  });
}

function showBusList(list){
  const container = document.getElementById("busItems");
  container.innerHTML = "";
  if(list.length === 0){
    container.textContent = "No buses found on this route right now.";
    return;
  }
  list.forEach(b => {
    const div = document.createElement("div");
    div.className = "bus-item";
    div.innerHTML = `
      <div>
        <div class="bus-title">${b.company} (${b.id})</div>
        <div class="small">Route: ${b.routeName}</div>
        <div class="small">Departs: ${b.departure}</div>
        <div class="small">Fare: ₹${b.rate}</div>
        <div class="pill">${b.seatsTotal - b.seatsTaken} seats available</div>
      </div>
      <button class="primary" onclick="openBooking('${b.id}')">Book</button>
    `;
    container.appendChild(div);
  });
}

function centerMapOnRoute(routeName){
  // find route path
  let foundPath = null;
  for(const st in STATES){
    for(const ct in STATES[st]){
      const route = STATES[st][ct].find(r=>r.name===routeName);
      if(route){ foundPath = route.path; break; }
    }
    if(foundPath) break;
  }
  if(foundPath){
    const mid = foundPath[Math.floor(foundPath.length/2)];
    map.setView(mid,13);
  }
}

function updateNearbyCount(lat,lon){
  const nearby = buses.filter(b => {
    // compute closest point on path distance to user; simple check using first point
    const p = b.path[0];
    const d = distKm(lat,lon,p[0],p[1]);
    return d <= 10; // within 10 km
  }).length;
  document.getElementById("nearCount").textContent = nearby;
}
function detectNearestCity(lat,lon){
  // naive nearest among route start points
  let nearest = null, nd = Infinity;
  for(const st in STATES){
    for(const ct in STATES[st]){
      STATES[st][ct].forEach(r => {
        const p = r.path[0];
        const d = distKm(lat,lon,p[0],p[1]);
        if(d < nd){ nd = d; nearest = ct; }
      });
    }
  }
  document.getElementById("detectedCity").textContent = nearest || "-";
}

// ---------- Booking modal & payment simulation ----------
let currentBus = null;
function openBooking(busId){
  currentBus = buses.find(b=>b.id===busId);
  if(!currentBus) return alert("Bus not found");
  document.getElementById("modalTitle").textContent = `${currentBus.company} (${currentBus.id})`;
  document.getElementById("modalRoute").textContent = currentBus.routeName;
  document.getElementById("modalDep").textContent = currentBus.departure;
  document.getElementById("modalFare").textContent = `₹${currentBus.rate}`;
  buildSeats();
  document.getElementById("paymentResult").textContent = "";
  document.getElementById("modal").style.display = "flex";
  document.getElementById("modal").setAttribute("aria-hidden","false");
}

function closeModal(){
  document.getElementById("modal").style.display = "none";
  document.getElementById("modal").setAttribute("aria-hidden","true");
  currentBus = null;
}

function buildSeats(){
  const area = document.getElementById("seatsArea");
  area.innerHTML = "";
  for(let i=1;i<=currentBus.seatsTotal;i++){
    const d = document.createElement("div");
    d.className = "seat" + (i <= currentBus.seatsTaken ? " taken" : "");
    d.textContent = i;
    d.dataset.seat = i;
    if(i > currentBus.seatsTaken){
      d.addEventListener("click", () => {
        d.classList.toggle("selected");
        updateConfirmButton();
      });
    }
    area.appendChild(d);
  }
  updateConfirmButton();
}

function selectedSeats(){
  return Array.from(document.querySelectorAll(".seat.selected")).map(s=>parseInt(s.dataset.seat));
}

function updateConfirmButton(){
  const seats = selectedSeats();
  const btn = document.getElementById("confirmPay");
  if(seats.length === 0){
    btn.textContent = "Select seats";
    btn.disabled = true;
  } else {
    btn.textContent = `Pay ₹${seats.length * currentBus.rate} (${seats.length} seats)`;
    btn.disabled = false;
  }
}

document.getElementById("paymentMethods").addEventListener("click", (e)=>{
  if(e.target.tagName !== "BUTTON") return;
  document.querySelectorAll("#paymentMethods button").forEach(b=>b.classList.remove("selected-method"));
  e.target.classList.add("selected-method");
});

document.getElementById("confirmPay").addEventListener("click", ()=>{
  const seats = selectedSeats();
  if(seats.length === 0) return alert("Select seats first");
  const method = document.querySelector("#paymentMethods button.selected-method");
  if(!method) return alert("Choose payment method");
  const res = document.getElementById("paymentResult");
  res.textContent = "Processing payment...";
  setTimeout(()=>{
    // mark seats as booked in demo
    currentBus.seatsTaken += seats.length;
    res.innerHTML = `<div style="color:var(--brand-green);font-weight:800">Booking confirmed</div><div class="small">Ref: GT${Math.floor(Math.random()*900000+100000)}</div>`;
    showToast(`Booked ${seats.length} seat(s) • ₹${seats.length * currentBus.rate}`);
    closeModal();
    // refresh search results if open
    document.getElementById("searchBtn").click();
  }, 1100);
});

// ---------- Profile modal (uses localStorage) ----------
function openProfile(){
  document.getElementById("profileModal").style.display = "flex";
  document.getElementById("profileModal").setAttribute("aria-hidden","false");
  // load existing values if any
  const p = JSON.parse(localStorage.getItem("gt_profile") || "{}");
  document.getElementById("profileName").value = p.name || "";
  document.getElementById("profileEmail").value = p.email || "";
  document.getElementById("profilePhone").value = p.phone || "";
}
function closeProfile(){
  document.getElementById("profileModal").style.display = "none";
  document.getElementById("profileModal").setAttribute("aria-hidden","true");
}
function saveProfile(){
  const name = document.getElementById("profileName").value.trim();
  const email = document.getElementById("profileEmail").value.trim();
  const phone = document.getElementById("profilePhone").value.trim();
  if(!name || !email || !phone){ alert("Please fill all fields"); return; }
  const obj = {name, email, phone};
  localStorage.setItem("gt_profile", JSON.stringify(obj));
  document.getElementById("profileInitial").textContent = name[0].toUpperCase();
  showToast("Profile saved");
  closeProfile();
}
function clearProfile(){
  localStorage.removeItem("gt_profile");
  document.getElementById("profileName").value = "";
  document.getElementById("profileEmail").value = "";
  document.getElementById("profilePhone").value = "";
  document.getElementById("profileInitial").textContent = "A";
  showToast("Profile cleared");
  closeProfile();
}
function loadProfileFromStorage(){
  const p = JSON.parse(localStorage.getItem("gt_profile") || "{}");
  if(p && p.name) document.getElementById("profileInitial").textContent = p.name[0].toUpperCase();
}

// ---------- Toast helper ----------
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(()=> t.style.display = "none", 2600);
}
