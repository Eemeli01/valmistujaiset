const RSVP_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";

// Neon-klubipaletti (RGB-muodossa nopeaan Canvas-piirtoon)
const PALETTE = [
  { p: "0, 240, 255", s: "255, 0, 127" },
  { p: "112, 0, 255", s: "0, 255, 102" },
  { p: "255, 0, 85",  s: "0, 240, 255" },
  { p: "255, 230, 0", s: "112, 0, 255" },
  { p: "0, 255, 204", s: "255, 51, 0" }
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

const inviteCard = document.getElementById("invite-card");
const wormSpinner = document.getElementById("worm-spinner");
const sideSigns = document.querySelectorAll(".side-sign");
const topLights = document.querySelectorAll(".blinder-top .blinder-light");
const bottomLights = document.querySelectorAll(".blinder-bottom .blinder-light");

// Canvas-alustus (Matala sisäinen resoluutio = ilmainen pehmeä sumennus & 120 FPS mobiilissa)
const canvas = document.getElementById("light-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
let cw = 240;
let ch = 420;

function resizeCanvas() {
  const aspect = window.innerWidth / window.innerHeight;
  ch = 360;
  cw = Math.round(ch * aspect);
  canvas.width = cw;
  canvas.height = ch;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

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

// Apufunktio pehmeän valokeilan piirtämiseen Canvasille
function drawBeam(x, y, angleDeg, spreadDeg, rgb, alpha, length) {
  if (alpha <= 0.01) return;
  const rad = (angleDeg * Math.PI) / 180;
  const halfSpread = ((spreadDeg / 2) * Math.PI) / 180;

  const grad = ctx.createRadialGradient(x, y, 2, x, y, length);
  grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  grad.addColorStop(0.6, `rgba(${rgb}, ${alpha * 0.45})`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, length, rad - halfSpread, rad + halfSpread);
  ctx.closePath();
  ctx.fill();
}

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

let prevIlluminated = false;
let prevBlinderState = "";

// 3. Huippunopea renderöintisilmukka
function renderLoop() {
  analyser.getByteFrequencyData(dataArray);

  const subBass = getAverageRange(dataArray, 1, 4) / 255;
  const mids    = getAverageRange(dataArray, 5, 15) / 255;
  const treble  = getAverageRange(dataArray, 20, 48) / 255;

  const now = performance.now();
  const currentTime = audio.currentTime;

  // Tyhjennetään Canvas tummalla klubitaustalla
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, cw, ch);

  // Valokeilat sekoittuvat kirkkaasti keskenään ("screen"/"lighter")
  ctx.globalCompositeOperation = "lighter";

  const isActualBreakdown = (currentTime < 2.0) || 
                            (currentTime >= 16.5 && currentTime <= 17.5) || 
                            (currentTime >= 57.0 && currentTime <= 68.5);
  const totalVolume = subBass * 0.5 + mids * 0.3 + treble * 0.2;
  const isQuietMoment = isActualBreakdown || (totalVolume < 0.16 && currentTime < 120.0);

  const speedMultiplier = 1 + subBass * 1.8 + treble * 0.8;
  timeScale += 0.012 * speedMultiplier;

  const maxLen = Math.hypot(cw, ch) * 0.58;

if (!isQuietMoment) {
    // Rauhallisempi värien vaihto (vähintään 420ms väli, vain selkeissä iskuissa)
    if ((subBass > 0.76 || mids > 0.74) && now - lastBeat > 420) {
      colorIdx = (colorIdx + 1) % PALETTE.length;
      lastBeat = now;
    }

    // Pehmeä kirkkauden seuranta ilman satunnaista sähinää
    const targetIntensity = Math.min(0.85, 0.38 + subBass * 0.45 + mids * 0.2);
    beamIntensity += (targetIntensity - beamIntensity) * 0.15;

    // Hallittu, rauhallisempi strobo vain selkeässä build-upin loppuhuipennuksessa ja kovimmassa dropissa
    let strobeGate = 1.0;
    if (currentTime >= 75.5 && currentTime <= 81.4) {
      const p = (currentTime - 75.5) / (81.4 - 75.5);
      const cycleMs = 95 - p * 45; // Hillitympi taajuus
      strobeGate = (Math.floor(now / cycleMs) % 2 === 0) ? 1.0 : 0.25;
    } else if (subBass > 0.88 && mids > 0.78) {
      // Ei täyttä mustaa leikkausta, vaan miellyttävä sykähdys
      strobeGate = (Math.floor(now / 45) % 2 === 0) ? 1.0 : 0.45;
    }

    const alpha = Math.min(0.9, beamIntensity * strobeGate);

    const colP = PALETTE[colorIdx].p;
    const colS = PALETTE[colorIdx].s;
    const t = timeScale;

    // 8 kpl pehmeitä klubispotteja
    drawBeam(0, 0,       45 + Math.sin(t * 0.72) * 55 + Math.cos(t * 0.32) * 35, 42, colP, alpha, maxLen);
    drawBeam(cw, 0,     135 + Math.cos(t * 0.65) * 55 - Math.sin(t * 0.28) * 35, 42, colS, alpha, maxLen);
    drawBeam(0, ch,     -45 - Math.sin(t * 0.68) * 55 + Math.cos(t * 0.42) * 35, 44, colS, alpha, maxLen);
    drawBeam(cw, ch,   -135 - Math.cos(t * 0.78) * 55 + Math.sin(t * 0.36) * 35, 44, colP, alpha, maxLen);

    drawBeam(cw * 0.5, 0,  90 + Math.sin(t * 0.92 + 1.2) * 65, 36, colS, alpha * 0.8, maxLen);
    drawBeam(cw * 0.5, ch, -90 - Math.cos(t * 0.85 + 0.8) * 65, 36, colP, alpha * 0.8, maxLen);
    drawBeam(0, ch * 0.5,   0 + Math.cos(t * 0.68 + 2.1) * 60, 38, colP, alpha * 0.75, maxLen);
    drawBeam(cw, ch * 0.5, 180 - Math.sin(t * 0.88 + 1.7) * 60, 38, colS, alpha * 0.75, maxLen);
  } else {
    // 5 kpl valkoisia hakuspotteja rauhallisissa kohdissa
    const wT = now * 0.0006;
    const whiteCol = "255, 255, 255";
    drawBeam(0, 0,         45 + Math.sin(wT * 0.8) * 45, 18, whiteCol, 0.75, maxLen);
    drawBeam(cw, ch,     -135 - Math.cos(wT * 0.7) * 45, 18, whiteCol, 0.70, maxLen);
    drawBeam(cw * 0.8, 0,  95 + Math.sin(wT * 1.1 + 1.5) * 45, 20, whiteCol, 0.65, maxLen);
    drawBeam(cw * 0.2, ch, -85 - Math.sin(wT * 0.9 + 2.0) * 45, 18, whiteCol, 0.70, maxLen);
    drawBeam(cw * 0.4, 0,  85 + Math.cos(wT * 0.65) * 50, 22, whiteCol, 0.60, maxLen);
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

  // --- 2. LAVAVALOT (Päivitetään DOM vain kun tila oikeasti muuttuu!) ---
  const isBassHit = !isQuietMoment && (subBass > 0.80);
  const currentBlinderState = (buildupActive || isSingingLights) 
    ? `step-${activeStep}` 
    : (isBassHit ? "bass-on" : "off");

  if (currentBlinderState !== prevBlinderState) {
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
      topLights.forEach(light => {
        light.classList.remove("active");
        light.classList.toggle("solid-on", isBassHit);
      });
      bottomLights.forEach(light => {
        light.classList.remove("active");
        light.classList.toggle("solid-on", isBassHit);
      });
    }
    prevBlinderState = currentBlinderState;
  }

  // --- 3. KORTIN SYKKIMINEN & VALOMATOT ---
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

  const scaleValue = 1 + Math.pow(subBass, 1.4) * 0.08;
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