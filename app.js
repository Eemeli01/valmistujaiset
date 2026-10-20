const RSVP_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";

// Neon-klubipaletti
const PALETTE = [
  { primary: "#00f0ff", secondary: "#ff007f" },
  { primary: "#7000ff", secondary: "#00ff66" },
  { primary: "#ff0055", secondary: "#00f0ff" },
  { primary: "#ffe600", secondary: "#7000ff" },
  { primary: "#00ffcc", secondary: "#ff3300" }
];

let colorIdx = 0;
let lastBeat = 0;
let beamIntensity = 0.5;

let wormAngle = 0; // Valomatojen kulma-asema

// Ajan integraattori liikeradoille
let timeScale = 0;

let audioCtx = null;
let analyser = null;
let dataArray = null;

const audio = document.getElementById("club-audio");
const overlay = document.getElementById("overlay");
const enterBtn = document.getElementById("enter-btn");
const muteBtn = document.getElementById("mute-btn");
const vipGreeting = document.getElementById("vip-greeting");
const nameInput = document.getElementById("guest-name");
const rsvpForm = document.getElementById("rsvp-form");
const rsvpSuccess = document.getElementById("rsvp-success");

const sideSigns = document.querySelectorAll(".side-sign");
const topLights = document.querySelectorAll(".blinder-top .blinder-light");
const bottomLights = document.querySelectorAll(".blinder-bottom .blinder-light");

// 1. VIP-nimen alustus URL-parametrista
window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const guest = urlParams.get("guest");
  if (guest) {
    const cleanGuest = decodeURIComponent(guest).trim();
    vipGreeting.textContent = `VIP-sisäänpääsy: ${cleanGuest}`;
    if (nameInput) nameInput.value = cleanGuest;
  }
});

// 2. Äänen ja Web Audio API:n alustus
async function initAudioAndVisuals() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    const source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.70; // Nopeampi vaste

    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    dataArray = new Uint8Array(analyser.frequencyBinCount);
  }

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  try {
    await audio.play();
  } catch (err) {
    console.warn("Autoplay estetty:", err);
  }

  overlay.classList.add("fade-out");
  muteBtn.classList.remove("hidden");

  requestAnimationFrame(renderLoop);
}

enterBtn.addEventListener("click", initAudioAndVisuals);

muteBtn.addEventListener("click", () => {
  audio.muted = !audio.muted;
  muteBtn.textContent = audio.muted ? "🔇" : "🔊";
});

function getAverageRange(arr, startIdx, endIdx) {
  let sum = 0;
  for (let i = startIdx; i <= endIdx; i++) {
    sum += arr[i];
  }
  return sum / (endIdx - startIdx + 1);
}

// "ALL OF THE LIGHTS" -aikaleimat
const lightIntervals = [
  [4.6, 5.9],
  [17.5, 18.8],
  [30.1, 31.4],
  [42.4, 43.7],
  [55.2, 56.5],
  [81.4, 82.7],
  [107.2, 108.5],
  [119.0, 120.3]
];

// 3. Reaaliaikainen valo- ja rytmisilmukka
function renderLoop() {
  analyser.getByteFrequencyData(dataArray);

  const subBass = getAverageRange(dataArray, 1, 7) / 255;
  const mids    = getAverageRange(dataArray, 10, 30) / 255;
  const treble  = getAverageRange(dataArray, 40, 95) / 255;

  const root = document.documentElement;
  const now = performance.now();
  const currentTime = audio.currentTime;

  // --- RAUHALLISEN KOHDAN TUNNISTUS ---
  const isActualBreakdown = (currentTime < 2.0) || 
                            (currentTime >= 16.5 && currentTime <= 17.5) || 
                            (currentTime >= 57.0 && currentTime <= 68.5);
  const totalVolume = subBass * 0.5 + mids * 0.3 + treble * 0.2;
  const isQuietMoment = isActualBreakdown || (totalVolume < 0.16 && currentTime < 120.0);

  document.body.classList.toggle("quiet-mode", isQuietMoment);
  root.style.setProperty("--color-lights-opacity", isQuietMoment ? "0" : "1");

  // Aika etenee musiikin energian mukaan
  const speedMultiplier = 1 + subBass * 1.8 + treble * 0.8;
  timeScale += 0.012 * speedMultiplier;

  // --- 8 KPL KLUBISPOTTIEN PALJON LAAJEMMAT LISSAJOUS-LIIKERADAT ---
  const t = timeScale;
  const rotTL = Math.sin(t * 0.72) * 85 + Math.cos(t * 0.32) * 55;
  const rotTR = Math.cos(t * 0.65) * 90 - Math.sin(t * 0.28) * 50;
  const rotBL = -Math.sin(t * 0.68) * 85 + Math.cos(t * 0.42) * 50;
  const rotBR = -Math.cos(t * 0.78) * 80 + Math.sin(t * 0.36) * 60;

  const rotTC = Math.sin(t * 0.92 + 1.2) * 85 + Math.cos(t * 0.42) * 50;
  const rotBC = -Math.cos(t * 0.85 + 0.8) * 85 - Math.sin(t * 0.38) * 50;
  const rotML = Math.cos(t * 0.68 + 2.1) * 80 + Math.sin(t * 0.48) * 55;
  const rotMR = -Math.sin(t * 0.88 + 1.7) * 85 + Math.cos(t * 0.35) * 50;

  // 5 valkoisen hakuspotin pehmeät liikkeet
  const wT = now * 0.0006;
  const whiteRot1 = Math.sin(wT * 0.8) * 65 + (now * 0.008) % 360;
  const whiteRot2 = -Math.cos(wT * 0.7) * 70 - (now * 0.007) % 360;
  const whiteRot3 = Math.sin(wT * 1.1 + 1.5) * 55 + Math.cos(wT * 0.5) * 40;
  const whiteRot4 = -Math.sin(wT * 0.9 + 2.0) * 60 - Math.sin(wT * 0.4) * 40;
  const whiteRot5 = Math.cos(wT * 0.65) * 75;

  // --- VÄRIEN VAIHTO MUSIIKIN TAHDIKKAASTI (PALAUTETTU & HERKISTETTY) ---
  const beatEnergy = Math.max(subBass * 1.3, mids * 1.15, treble * 1.05);

  if (!isQuietMoment && (subBass > 0.68 || mids > 0.65) && now - lastBeat > 180) {
    colorIdx = (colorIdx + 1) % PALETTE.length;
    root.style.setProperty("--active-color", PALETTE[colorIdx].primary);
    root.style.setProperty("--secondary-color", PALETTE[colorIdx].secondary);
    lastBeat = now;
  }

// --- HALLITTU STROBO & VÄLKE ---
  // Peruskirkkaus: valot loistavat vakaasti
  if (beatEnergy > 0.70) {
    beamIntensity = 0.85 + Math.random() * 0.15;
  } else {
    beamIntensity = Math.max(0.40, beamIntensity * 0.92);
  }

  let strobeGate = 1.0;

  if (!isQuietMoment) {
    // 1. Build-up ennen droppia (73.5s - 81.4s): asteittain kiihtyvä strobo
    if (currentTime >= 73.5 && currentTime <= 81.4) {
      const p = (currentTime - 73.5) / (81.4 - 73.5);
      const cycleMs = 85 - p * 52; // 85ms -> 33ms
      strobeGate = (Math.floor(now / cycleMs) % 2 === 0) ? 1.0 : 0.0;
    }
    // 2. Vain kaikkein voimakkaimmat aksentti-iskut ja dropit (kynnys nostettu 0.84:ään)
    else if (subBass > 0.84 && mids > 0.70) {
      // Lyhyt, napakka leikkaus vain iskun harjalla
      strobeGate = (Math.floor(now / 38) % 2 === 0) ? 1.0 : 0.15;
    }
    // 3. Normaali tanssirytmi: EI stroboa, valot loistavat täysillä
    else {
      strobeGate = 1.0;
    }
  } else {
    strobeGate = 0.0;
  }

  // Diskantin hento kimmellys
  const subtleSparkle = treble > 0.50 ? (treble - 0.50) * 0.5 : 0.0;

  // --- 1. AJASTUS: 2.5 SEKUNTIA ENNEN "ALL OF THE LIGHTS" ---
  let isSingingLights = false;
  let buildupActive = false;
  let activeStep = -1;

  for (const [start, end] of lightIntervals) {
    const countdownStart = start - 2.5;

    if (currentTime >= countdownStart && currentTime < start) {
      buildupActive = true;
      const elapsed = currentTime - countdownStart;
      activeStep = Math.min(5, Math.floor(elapsed / 0.5));
      break;
    } else if (currentTime >= start && currentTime <= end) {
      isSingingLights = true;
      activeStep = 5;
      break;
    }
  }

  sideSigns.forEach(sign => {
    sign.classList.toggle("illuminated", isSingingLights);
  });

// --- 2. LAVAVALOJEN SYTYTTÄMINEN ---
  if (buildupActive || isSingingLights) {
    // ALL OF THE LIGHTS -vaihe:
    // Syttyvät 2.5s aikana vuorotellen ja loistavat laulun ajan
    topLights.forEach((light, i) => {
      light.classList.remove("solid-on");
      light.classList.toggle("active", i <= activeStep);
    });

    bottomLights.forEach((light, i) => {
      light.classList.remove("solid-on");
      light.classList.toggle("active", (5 - i) <= activeStep);
    });

  } else {
    // ALL OF THE LIGHTS -kohtien ulkopuolella:
    // Kaikki 12 lamppua välähtävät yhtenäisesti VAIN matalan bassoniskun (subBass > 0.80) kohdalla
    const isBassHit = !isQuietMoment && (subBass > 0.80);

    topLights.forEach(light => {
      light.classList.remove("active");
      light.classList.toggle("solid-on", isBassHit);
    });

    bottomLights.forEach(light => {
      light.classList.remove("active");
      light.classList.toggle("solid-on", isBassHit);
    });
  }


// --- KORTIN ÄÄRIVIIVOJA KIERTÄVÄT VALOMATOT ---
  // 1. Kiertosuunta vaihtuu jokaisen "ALL OF THE LIGHTS" -kohdan kohdalla
  let wormDir = 1; // 1 = myötäpäivään, -1 = vastapäivään
  for (const [start] of lightIntervals) {
    if (currentTime >= start) {
      wormDir *= -1; // Käännetään suunta jokaisesta ohitetusta kohdasta
    }
  }

  // 2. Nopeus: rauhallisissa kohdissa hyvin hiljainen, intensiivisissä kova vauhti
  let wormSpeed = 0.25; // Rauhallinen perusnopeus
  if (!isQuietMoment) {
    const energy = subBass * 2.4 + mids * 1.5 + treble * 0.8;
    wormSpeed = 0.55 + energy * 2.2;
  }

  // Päivitetään kulma (varmistetaan aina positiivinen asteluku 0–360)
  wormAngle = (wormAngle + wormDir * wormSpeed + 360000) % 360;
  root.style.setProperty("--worm-rot", `${wormAngle.toFixed(2)}deg`);


  // CSS-muuttujat animaatioille
  root.style.setProperty("--bass-intensity", subBass.toFixed(3));
  const punchyBass = Math.pow(subBass, 1.4);
  const scaleValue = 1 + punchyBass * 0.09;
  root.style.setProperty("--bass-scale", scaleValue.toFixed(4));
  root.style.setProperty("--spot-beam-intensity", beamIntensity.toFixed(3));
  root.style.setProperty("--sparkle-factor", subtleSparkle.toFixed(3));
  root.style.setProperty("--strobe-gate", strobeGate.toFixed(2));

  // 8 värispotin kulmat
  root.style.setProperty("--spot-rot-tl", `${rotTL.toFixed(1)}deg`);
  root.style.setProperty("--spot-rot-tr", `${rotTR.toFixed(1)}deg`);
  root.style.setProperty("--spot-rot-bl", `${rotBL.toFixed(1)}deg`);
  root.style.setProperty("--spot-rot-br", `${rotBR.toFixed(1)}deg`);
  root.style.setProperty("--spot-rot-tc", `${rotTC.toFixed(1)}deg`);
  root.style.setProperty("--spot-rot-bc", `${rotBC.toFixed(1)}deg`);
  root.style.setProperty("--spot-rot-ml", `${rotML.toFixed(1)}deg`);
  root.style.setProperty("--spot-rot-mr", `${rotMR.toFixed(1)}deg`);

  // 5 valkoisen spottivalon kulmat
  root.style.setProperty("--white-rot-1", `${whiteRot1.toFixed(1)}deg`);
  root.style.setProperty("--white-rot-2", `${whiteRot2.toFixed(1)}deg`);
  root.style.setProperty("--white-rot-3", `${whiteRot3.toFixed(1)}deg`);
  root.style.setProperty("--white-rot-4", `${whiteRot4.toFixed(1)}deg`);
  root.style.setProperty("--white-rot-5", `${whiteRot5.toFixed(1)}deg`);

  requestAnimationFrame(renderLoop);
}

// 4. RSVP-lomakkeen käsittely
rsvpForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "LÄHETETÄÄN...";

const formData = new FormData(rsvpForm);
  const payload = {
    name: formData.get("name"),
    avec: formData.get("avec") || "",
    attendance: formData.get("attendance"),
    message: formData.get("message") || ""
  };

  if (RSVP_ENDPOINT.includes("YOUR_FORM_ID")) {
    setTimeout(() => {
      showSuccess();
    }, 600);
    return;
  }

  try {
    const res = await fetch(RSVP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showSuccess();
    } else {
      alert("Ilmoittautumisen lähetys epäonnistui. Yritä uudelleen!");
      submitBtn.disabled = false;
      submitBtn.textContent = "LÄHETÄ VASTAUS";
    }
  } catch {
    alert("Yhteysvirhe. Tarkista verkkoyhteys!");
    submitBtn.disabled = false;
    submitBtn.textContent = "LÄHETÄ VASTAUS";
  }
});

function showSuccess() {
  rsvpForm.classList.add("hidden");
  rsvpSuccess.classList.remove("hidden");
}