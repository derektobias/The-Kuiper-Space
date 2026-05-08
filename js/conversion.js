const units = {

length:{

// --- Imperial / US ---
in:{factor:0.0254,label:"Inches (in)"},
ft:{factor:0.3048,label:"Feet (ft)"},
yd:{factor:0.9144,label:"Yards (yd)"},
fur:{factor:201.168,label:"Furlongs (fur)"},
mi:{factor:1609.34,label:"Miles (mi)"},
nmi:{factor:1852,label:"Nautical Miles (nmi)"},

// --- Astronomical ---
"Lunar radii":{factor:1.737e6,label:"Lunar Radii (R☽)"},
"Earth radii":{factor:6.371e6,label:"Earth Radii (R⊕)"},
"Jupiter radii":{factor:6.9911e7,label:"Jupiter Radii (R♃)"},
"Solar radii":{factor:6.957e8,label:"Solar Radii (R☉)"},
AU:{factor:1.496e11,label:"Astronomical Units (AU)"},
ly:{factor:9.461e15,label:"Light Years (ly)"},
pc:{factor:3.0857e16,label:"Parsecs (pc)"},

// --- Subatomic / Quantum ---
fm:{factor:1e-15,label:"Femtometers (fm)"},
pm:{factor:1e-12,label:"Picometers (pm)"},
Å:{factor:1e-10,label:"Angstroms (Å)"},
nm:{factor:1e-9,label:"Nanometers (nm)"},
µm:{factor:1e-6,label:"Micrometers (µm)"},

// --- Metric ---
mm:{factor:0.001,label:"Millimeters (mm)"},
cm:{factor:0.01,label:"Centimeters (cm)"},
m:{factor:1,label:"Meters (m)"},
km:{factor:1000,label:"Kilometers (km)"}

},

area:{

// --- Other ---
ha:{factor:10000,label:"Hectares (ha)"},
b:{factor:1e-28,label:"Barns (b)"},

// --- Imperial / US ---
ac:{factor:4046.86,label:"Acres (ac)"},
"mi²":{factor:2.59e6,label:"Square Miles (mi²)"},
"in²":{factor:0.00064516,label:"Square Inches (in²)"},
"ft²":{factor:0.092903,label:"Square Feet (ft²)"},
"yd²":{factor:0.836127,label:"Square Yards (yd²)"},

// --- Metric ---
"mm²":{factor:1e-6,label:"Square Millimeters (mm²)"},
"cm²":{factor:0.0001,label:"Square Centimeters (cm²)"},
"m²":{factor:1,label:"Square Meters (m²)"},
"km²":{factor:1e6,label:"Square Kilometers (km²)"}

},

volume:{

// --- Imperial / US ---
cup:{factor:0.000236588,label:"Cups (cup)"},
pt:{factor:0.000473176,label:"Pints (pt)"},
qt:{factor:0.000946353,label:"Quarts (qt)"},
gal:{factor:0.00378541,label:"US Gallons (gal)"},
bbl:{factor:0.158987,label:"Barrels (bbl)"},
"in³":{factor:1.6387e-5,label:"Cubic Inches (in³)"},
"ft³":{factor:0.0283168,label:"Cubic Feet (ft³)"},

// --- Metric ---
"cm³":{factor:1e-6,label:"Cubic Centimeters (cm³)"},
mL:{factor:1e-6,label:"Milliliters (mL)"},
L:{factor:0.001,label:"Liters (L)"},
"m³":{factor:1,label:"Cubic Meters (m³)"}

},

mass:{

// --- Imperial / US ---
oz:{factor:0.0283495,label:"Ounces (oz)"},
lbs:{factor:0.453592,label:"Pounds (lbs)"},
tn:{factor:907.185,label:"U.S. Tons (tn)"},

// --- Astronomical ---
"Lunar masses":{factor:7.342e22,label:"Lunar Masses (M☽)"},
"Earth masses":{factor:5.972e24,label:"Earth Masses (M⊕)"},
"Jupiter masses":{factor:1.898e27,label:"Jupiter Masses (M♃)"},
"Solar masses":{factor:1.989e30,label:"Solar Masses (M☉)"},

// --- Metric ---
mg:{factor:1e-6,label:"Milligrams (mg)"},
g:{factor:0.001,label:"Grams (g)"},
kg:{factor:1,label:"Kilograms (kg)"},
t:{factor:1000,label:"Metric Tonnes (t)"}

},

time:{

// --- Subatomic / Scientific ---
fs:{factor:1e-15,label:"Femtoseconds (fs)"},
ps:{factor:1e-12,label:"Picoseconds (ps)"},
ns:{factor:1e-9,label:"Nanoseconds (ns)"},
µs:{factor:1e-6,label:"Microseconds (µs)"},
ms:{factor:0.001,label:"Milliseconds (ms)"},

// --- Standard ---
s:{factor:1,label:"Seconds (s)"},
min:{factor:60,label:"Minutes (min)"},
hr:{factor:3600,label:"Hours (hr)"},
day:{factor:86400,label:"Days (day)"},
yr:{factor:3.154e7,label:"Years (yr)"},

// --- Geological / Astronomical ---
kyr:{factor:3.154e10,label:"Thousand Years (kyr)"},
Myr:{factor:3.154e13,label:"Million Years (Myr)"},
Gyr:{factor:3.154e16,label:"Billion Years (Gyr)"}

},

speed:{

// --- Nautical ---
kn:{factor:0.514444,label:"Knots (kn)"},

// --- Imperial / US ---
"ft/s":{factor:0.3048,label:"Feet per Second (ft/s)"},
mph:{factor:0.44704,label:"Miles per Hour (mph)"},
"mi/s":{factor:1609.34,label:"Miles per Second (mi/s)"},

// --- Physical ---
Mach:{factor:343,label:"Mach (Mach)"},
c:{factor:299792458,label:"Speed of Light (c)"},

// --- Metric ---
"m/s":{factor:1,label:"Meters per Second (m/s)"},
"km/s":{factor:1000,label:"Kilometers per Second (km/s)"},
"km/h":{factor:0.277778,label:"Kilometers per Hour (km/h)"}

},

energy:{

// --- Subatomic ---
eV:{factor:1.602e-19,label:"Electron Volts (eV)"},
keV:{factor:1.602e-16,label:"Kiloelectron Volts (keV)"},
MeV:{factor:1.602e-13,label:"Megaelectron Volts (MeV)"},
GeV:{factor:1.602e-10,label:"Gigaelectron Volts (GeV)"},

// --- Other ---
"ft·lbf":{factor:1.35582,label:"Foot-Pounds (ft·lbf)"},
cal:{factor:4.184,label:"Calories (cal)"},
kcal:{factor:4184,label:"Kilocalories (kcal)"},
BTU:{factor:1055.06,label:"British Thermal Units (BTU)"},
kWh:{factor:3.6e6,label:"Kilowatt Hours (kWh)"},
erg:{factor:1e-7,label:"Ergs (erg)"},

// --- Subatomic / Scientific ---
fJ:{factor:1e-15,label:"Femtojoules (fJ)"},
pJ:{factor:1e-12,label:"Picojoules (pJ)"},
nJ:{factor:1e-9,label:"Nanojoules (nJ)"},
µJ:{factor:1e-6,label:"Microjoules (µJ)"},
mJ:{factor:0.001,label:"Millijoules (mJ)"},

// --- Metric ---
J:{factor:1,label:"Joules (J)"},
kJ:{factor:1000,label:"Kilojoules (kJ)"},
MJ:{factor:1e6,label:"Megajoules (MJ)"},
GJ:{factor:1e9,label:"Gigajoules (GJ)"}

},

power:{

// --- Other ---
hp:{factor:745.7,label:"Horsepower (hp)"},
"BTU/hr":{factor:0.29307,label:"BTU per Hour (BTU/hr)"},
"ft·lbf/s":{factor:1.35582,label:"Foot-Pounds per Second (ft·lbf/s)"},
"ft·lbf/min":{factor:0.0225970,label:"Foot-Pounds per Minute (ft·lbf/min)"},
"ft·lbf/hr":{factor:0.000376617,label:"Foot-Pounds per Hour (ft·lbf/hr)"},

// --- Subatomic / Scientific ---
fW:{factor:1e-15,label:"Femtowatts (fW)"},
pW:{factor:1e-12,label:"Picowatts (pW)"},
nW:{factor:1e-9,label:"Nanowatts (nW)"},
µW:{factor:1e-6,label:"Microwatts (µW)"},
mW:{factor:0.001,label:"Milliwatts (mW)"},

// --- Metric ---
W:{factor:1,label:"Watts (W)"},
kW:{factor:1000,label:"Kilowatts (kW)"},
MW:{factor:1e6,label:"Megawatts (MW)"},
GW:{factor:1e9,label:"Gigawatts (GW)"},
TW:{factor:1e12,label:"Terawatts (TW)"}

},

temperature:{

// --- Historical ---
Re:{label:"Réaumur (°Re)"},

// --- Common ---
C:{label:"Celsius (°C)"},
F:{label:"Fahrenheit (°F)"},

// --- Absolute ---
K:{label:"Kelvin (K)"},
Ra:{label:"Rankine (°Ra)"}

},

magnetic:{

// --- CGS ---
nG:{factor:1e-13,label:"Nanogauss (nG)"},
µG:{factor:1e-10,label:"Microgauss (µG)"},
mG:{factor:1e-7,label:"Milligauss (mG)"},
G:{factor:1e-4,label:"Gauss (G)"},
Oe:{factor:1e-4,label:"Oersted (Oe)"},

// --- SI ---
"A/m":{factor:1.2566e-6,label:"Amperes per Meter (A/m)"},
nT:{factor:1e-9,label:"Nanotesla (nT)"},
µT:{factor:1e-6,label:"Microtesla (µT)"},
mT:{factor:0.001,label:"Millitesla (mT)"},
T:{factor:1,label:"Tesla (T)"}

},

pressure:{

// --- Imperial / US ---
Torr:{factor:133.322,label:"Torr (Torr)"},
mmHg:{factor:133.322,label:"Millimeters of Mercury (mmHg)"},
psi:{factor:6894.76,label:"Pounds per Square Inch (psi)"},

// --- Common ---
mbar:{factor:100,label:"Millibars (mbar)"},
bar:{factor:100000,label:"Bars (bar)"},
atm:{factor:101325,label:"Atmospheres (atm)"},

// --- Micro / Scientific ---
fPa:{factor:1e-15,label:"Femtopascals (fPa)"},
pPa:{factor:1e-12,label:"Picopascals (pPa)"},
nPa:{factor:1e-9,label:"Nanopascals (nPa)"},
µPa:{factor:1e-6,label:"Micropascals (µPa)"},
mPa:{factor:0.001,label:"Millipascals (mPa)"},

// --- Metric ---
Pa:{factor:1,label:"Pascals (Pa)"},
kPa:{factor:1000,label:"Kilopascals (kPa)"},
MPa:{factor:1e6,label:"Megapascals (MPa)"},
GPa:{factor:1e9,label:"Gigapascals (GPa)"}

},

density:{

// --- Imperial / US ---
"lb/ft³":{factor:16.0185,label:"Pounds per Cubic Foot (lb/ft³)"},
"lb/in³":{factor:27679.9,label:"Pounds per Cubic Inch (lb/in³)"},

// --- Metric ---
"kg/m³":{factor:1,label:"Kilograms per Cubic Meter (kg/m³)"},
"kg/L":{factor:1000,label:"Kilograms per Liter (kg/L)"},
"g/cm³":{factor:1000,label:"Grams per Cubic Centimeter (g/cm³)"},
"g/mL":{factor:1000,label:"Grams per Milliliter (g/mL)"},
"g/L":{factor:1,label:"Grams per Liter (g/L)"}

}

};

function convertTemp(value, from, to) {

// Convert input to Kelvin first
let K;
if(from === "K")  K = value;
if(from === "C")  K = value + 273.15;
if(from === "F")  K = (value - 32) * 5/9 + 273.15;
if(from === "Ra") K = value * 5/9;
if(from === "Re") K = value * 1.25 + 273.15;

if(K < 0) return undefined;

// Convert Kelvin to output
if(to === "K")  return K;
if(to === "C")  return K - 273.15;
if(to === "F")  return (K - 273.15) * 9/5 + 32;
if(to === "Ra") return K * 9/5;
if(to === "Re") return (K - 273.15) * 0.8;

}

function formatNumber(num){

if(num === undefined || num === null) return "";

if(Math.abs(num)>=1e6 || Math.abs(num)<1e-4){
return Number(num).toExponential(4);
}

return Number(num.toFixed(4));

}

function convert(value, type, fromUnit, toUnit){

if(type === "temperature"){
return convertTemp(value, fromUnit, toUnit);
}

let fromFactor = units[type][fromUnit]?.factor;
let toFactor   = units[type][toUnit]?.factor;

if(fromFactor == null || toFactor == null) return;

let base = value * fromFactor;
return base / toFactor;

}

document.querySelectorAll(".converter").forEach(box=>{

let selectedFrom = null;
let selectedTo = null;

const type = box.dataset.type;

const from = box.querySelector(".unitFrom");
const to = box.querySelector(".unitTo");

const searchFrom = box.querySelector(".unitSearchFrom");
const searchTo = box.querySelector(".unitSearchTo");

const input = box.querySelector(".inputValue");
const output = box.querySelector(".outputValue");
const swap = box.querySelector(".swapBtn");

function populateDropdown(container){

container.innerHTML="";

Object.keys(units[type]).forEach(key=>{

let label = units[type][key].label || key;

let item = document.createElement("div");
item.className = "dropdownItem";
item.textContent = label;
item.dataset.value = key;

container.appendChild(item);

});

}

populateDropdown(from);
populateDropdown(to);

selectedFrom = Object.keys(units[type])[0];
selectedTo   = Object.keys(units[type])[1];

setupDropdown(searchFrom, from, true);
setupDropdown(searchTo, to, false);

/* Clear buttons */

box.querySelector(".clearFrom").onclick=()=>{
searchFrom.value="";
selectedFrom = null;
populateDropdown(from);          // 🔥 FULL RESET
filterList(searchFrom, from);
from.style.display="block";
searchFrom.focus();
};

box.querySelector(".clearTo").onclick=()=>{
searchTo.value="";
selectedTo = null;
populateDropdown(to);            // 🔥 FULL RESET
filterList(searchTo, to);
to.style.display="block";
searchTo.focus();
};

function filterList(input, list){

let filter = input.value.toLowerCase();
let items = [...list.children];

/* Always rebuild from original dataset */
let allKeys = Object.keys(units[type]);

list.innerHTML = "";

let matches = [];

allKeys.forEach(key => {

let label = units[type][key].label || key;
let lower = label.toLowerCase();

if(lower.includes(filter)){
matches.push({key, label});
}

});

/* ❗ If no matches → show ALL (this fixes backspace issue) */
if(matches.length === 0){
matches = allKeys.map(key => ({
key,
label: units[type][key].label || key
}));
}

/* Sort matches */
matches.sort((a,b)=>{
if(a.label.toLowerCase().startsWith(filter)) return -1;
if(b.label.toLowerCase().startsWith(filter)) return 1;
return a.label.localeCompare(b.label);
});

/* Render */
matches.forEach(itemData => {

let item = document.createElement("div");
item.className = "dropdownItem";
item.dataset.value = itemData.key;

/* Highlight */
if(filter !== ""){
let regex = new RegExp(`(${filter})`, "gi");
item.innerHTML = itemData.label.replace(regex, `<span class="highlight">$1</span>`);
}else{
item.textContent = itemData.label;
}

list.appendChild(item);

});

/* ✅ ALWAYS keep dropdown visible */
list.style.display = "block";

}

function setupDropdown(input, list, isFrom){

input.addEventListener("click", ()=>{
list.style.display="block";
filterList(input, list); // SHOW ALL IMMEDIATELY
});

input.addEventListener("input", ()=>{
filterList(input, list);

/* reset keyboard selection when typing */
currentIndex = -1;
});

input.addEventListener("focus", ()=>{
list.style.display = "block";
filterList(input, list);
});

list.addEventListener("click",(e)=>{

if(!e.target.classList.contains("dropdownItem")) return;

input.value = e.target.textContent;

if(isFrom){
selectedFrom = e.target.dataset.value;
}else{
selectedTo = e.target.dataset.value;
}

list.style.display="none";

calculate();

});

/* close if clicking outside */
document.addEventListener("click",(e)=>{
if(!list.parentElement.contains(e.target)){
list.style.display="none";
}
});

let currentIndex = -1;

input.addEventListener("keydown",(e)=>{

let items = [...list.children];

if(e.key==="ArrowDown"){

e.preventDefault();
currentIndex = (currentIndex + 1) % items.length;

items.forEach(i=>i.classList.remove("active"));
items[currentIndex].classList.add("active");

}

if(e.key==="ArrowUp"){

e.preventDefault();
currentIndex = (currentIndex - 1 + items.length) % items.length;

items.forEach(i=>i.classList.remove("active"));
items[currentIndex].classList.add("active");

}

if(e.key==="Enter"){

let items = [...list.children];

/* If arrow-selected */
if(currentIndex >= 0){
items[currentIndex].click();
return;
}

/* Otherwise pick BEST MATCH automatically */
let inputText = input.value.toLowerCase();

let match = items.find(item =>
item.textContent.toLowerCase().includes(inputText)
);

if(match){
match.click();
}

}

});

}

function parseScientificInput(str){

if(!str) return NaN;

str = str.replace(/×/g,"x");

let match = str.match(/^([0-9.+-]+)\s*x\s*10\^([+-]?\d+)$/i);

if(match){
return parseFloat(match[1]) * Math.pow(10,parseInt(match[2]));
}

return parseFloat(str);

}

function calculate(){

let value = parseScientificInput(input.value);
if(isNaN(value)) return;

/* Determine units */
let fromUnit = selectedFrom || from.value;
let toUnit   = selectedTo   || to.value;

if(!fromUnit || !toUnit) return;

/* Convert */
let result = convert(value, type, fromUnit, toUnit);

if(result === undefined){
output.value = "undefined";
return;
}

output.value = formatNumber(result);

}

input.addEventListener("input",calculate);
from.addEventListener("change",calculate);
to.addEventListener("change",calculate);

swap.onclick = ()=>{

/* swap selected values */
let tempVal = selectedFrom;
selectedFrom = selectedTo;
selectedTo = tempVal;

/* swap visible text */
let tempText = searchFrom.value;
searchFrom.value = searchTo.value;
searchTo.value = tempText;

calculate();

};

});