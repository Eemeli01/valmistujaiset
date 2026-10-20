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
let wormAngle = 0;
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

// Haetaan animoitavat DOM-elementit kerran muistiin (ei hakuja silmukassa)
const inviteCard = document.getElementById("invite-card");
const wormSpinner = document.getElementById("worm-spinner");
const sideSigns = document.querySelectorAll(".side-sign");
const topLights = document.querySelectorAll(".blinder-top .blinder-light");
const bottomLights = document.querySelectorAll(".blinder-bottom .blinder-light");

const spotTL = document.querySelector(".spot-tl");
const spotTR = document.querySelector(".spot-tr");
const spotBL = document.querySelector(".spot-bl");
const spotBR = document.querySelector(".spot-br");
const spotTC = document.querySelector(".spot-tc");
const spotBC = document.querySelector(".spot-bc");
const spotML = document.querySelector(".spot-ml");
const spotMR = document.querySelector(".spot-mr");
const allColorSpots = [spotTL, spotTR, spotBL, spotBR, spotTC, spotBC, spotML, spotMR];

const beam1 = document.querySelector(".beam-1");
const beam2 = document.querySelector(".beam-2");
const beam3 = document.querySelector(".beam-3");
const beam4 = document.querySelector(".beam-4");
const beam5 = document.querySelector(".beam-5");

// 1. VIP-nimen alustus
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
    // "playback"-vihje antaa Androidille suuren äänipuskurin, jolloin musiikki ei rätise
    audioCtx = new AudioContextClass({ latencyHint: "playback" });

    const source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.70;

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

let prevQuietMode = false;
let prevIlluminated = false;

// 3. Kevyt ja nopea renderöintisilmukka (Suorat GPU-kutsut)
function renderLoop() {
  analyser.getByteFrequencyData(dataArray);

  // Koska fftSize = 256, indeksit on skaalattu puoleen (vastaa täsmälleen aiempia taajuuksia)
  const subBass = getAverageRange(dataArray, 1, 4) / 255;
  const mids    = getAverageRange(dataArray, 5, 15) / 255;
  const treble  = getAverageRange(dataArray, 20, 48) / 255;

  const root = document.documentElement;
  const now = performance.now();
  const currentTime = audio.currentTime;

  // --- RAUHALLISEN KOHDAN TUNNISTUS ---
  const isActualBreakdown = (currentTime < 2.0) || 
                            (currentTime >= 16.5 && currentTime <= 17.5) || 
                            (currentTime >= 57.0 && currentTime <= 68.5);
  const totalVolume = subBass * 0.5 + mids * 0.3 + treble * 0.2;
  const isQuietMoment = isActualBreakdown || (totalVolume < 0.16 && currentTime < 120.0);

  if (isQuietMoment !== prevQuietMode) {
    document.body.classList.toggle("quiet-mode", isQuietMoment);
    prevQuietMode = isQuietMoment;
  }

  // Aika etenee musiikin energian mukaan
  const speedMultiplier = 1 + subBass * 1.8 + treble * 0.8;
  timeScale += 0.012 * speedMultiplier;

  if (!isQuietMoment) {
    // Päivitetään vain värilliset spotit kun ne ovat näkyvissä
    const t = timeScale;
    spotTL.style.transform = `rotate(${(Math.sin(t * 0.72) * 85 + Math.cos(t * 0.32) * 55).toFixed(1)}deg)`;
    spotTR.style.transform = `rotate(${(Math.cos(t * 0.65) * 90 - Math.sin(t * 0.28) * 50).toFixed(1)}deg)`;
    spotBL.style.transform = `rotate(${(-Math.sin(t * 0.68) * 85 + Math.cos(t * 0.42) * 50).toFixed(1)}deg)`;
    spotBR.style.transform = `rotate(${(-Math.cos(t * 0.78) * 80 + Math.sin(t * 0.36) * 60).toFixed(1)}deg)`;
    spotTC.style.transform = `rotate(${(Math.sin(t * 0.92 + 1.2) * 85 + Math.cos(t * 0.42) * 50).toFixed(1)}deg)`;
    spotBC.style.transform = `rotate(${(-Math.cos(t * 0.85 + 0.8) * 85 - Math.sin(t * 0.38) * 50).toFixed(1)}deg)`;
    spotML.style.transform = `rotate(${(Math.cos(t * 0.68 + 2.1) * 80 + Math.sin(t * 0.48) * 55).toFixed(1)}deg)`;
    spotMR.style.transform = `rotate(${(-Math.sin(t * 0.88 + 1.7) * 85 + Math.cos(t * 0.35) * 50).toFixed(1)}deg)`;

    // Värien vaihto (vain silloin kun väri oikeasti vaihtuu, max ~5 kertaa sekunnissa)
    const beatEnergy = Math.max(subBass * 1.3, mids * 1.15, treble * 1.05);
    if ((subBass > 0.68 || mids > 0.65) && now - lastBeat > 180) {
      colorIdx = (colorIdx + 1) % PALETTE.length;
      root.style.setProperty("--active-color", PALETTE[colorIdx].primary);
      root.style.setProperty("--secondary-color", PALETTE[colorIdx].secondary);
      lastBeat = now;
    }

    if (beatEnergy > 0.70) {
      beamIntensity = 0.85 + Math.random() * 0.15;
    } else {
      beamIntensity = Math.max(0.40, beamIntensity * 0.92);
    }

    let strobeGate = 1.0;
    if (currentTime >= 73.5 && currentTime <= 81.4) {
      const p = (currentTime - 73.5) / (81.4 - 73.5);
      const cycleMs = 85 - p * 52;
      strobeGate = (Math.floor(now / cycleMs) % 2 === 0) ? 1.0 : 0.0;
    } else if (subBass > 0.84 && mids > 0.70) {
      strobeGate = (Math.floor(now / 38) % 2 === 0) ? 1.0 : 0.15;
    }

    const subtleSparkle = treble > 0.50 ? (treble - 0.50) * 0.5 : 0.0;
    const finalSpotOpacity = ((beamIntensity + subtleSparkle) * strobeGate).toFixed(2);

    for (let i = 0; i < allColorSpots.length; i++) {
      allColorSpots[i].style.opacity = finalSpotOpacity;
    }
  } else {
    // Päivitetään vain valkoiset hakuspotit kun ollaan rauhallisessa kohdassa
    const wT = now * 0.0006;
    beam1.style.transform = `rotate(${(Math.sin(wT * 0.8) * 65 + (now * 0.008) % 360).toFixed(1)}deg)`;
    beam2.style.transform = `rotate(${(-Math.cos(wT * 0.7) * 70 - (now * 0.007) % 360).toFixed(1)}deg)`;
    beam3.style.transform = `rotate(${(Math.sin(wT * 1.1 + 1.5) * 55 + Math.cos(wT * 0.5) * 40).toFixed(1)}deg)`;
    beam4.style.transform = `rotate(${(-Math.sin(wT * 0.9 + 2.0) * 60 - Math.sin(wT * 0.4) * 40).toFixed(1)}deg)`;
    beam5.style.transform = `rotate(${(Math.cos(wT * 0.65) * 75).toFixed(1)}deg)`;
  }

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

  if (isSingingLights !== prevIlluminated) {
    sideSigns.forEach(sign => sign.classList.toggle("illuminated", isSingingLights));
    prevIlluminated = isSingingLights;
  }

  // --- 2. LAVAVALOJEN SYTYTTÄMINEN ---
  if (buildupActive || isSingingLights) {
    topLights.forEach((light, i) => {
      light.classList.remove("solid-on");
      light.classList.toggle("active", i <= activeStep);
    });
    bottomLights.forEach((light, i) => {
      light.classList.remove("solid-on");
      light.classList.toggle("active", (5 - i) <= activeStep);
    });
  } else {
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

  // --- 3. KORTIN SYKKIMINEN & VALOMATOT (SUORA GPU-TRANSFORMAATIO) ---
  let wormDir = 1;
  for (const [start] of lightIntervals) {
    if (currentTime >= start) wormDir *= -1;
  }

  let wormSpeed = 0.25;
  if (!isQuietMoment) {
    const energy = subBass * 2.4 + mids * 1.5 + treble * 0.8;
    wormSpeed = 0.55 + energy * 2.2;
  }

  wormAngle = (wormAngle + wormDir * wormSpeed + 360000) % 360;
  wormSpinner.style.transform = `rotate(${wormAngle.toFixed(1)}deg)`;

  const scaleValue = 1 + Math.pow(subBass, 1.4) * 0.09;
  inviteCard.style.transform = `scale(${scaleValue.toFixed(3)})`;

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