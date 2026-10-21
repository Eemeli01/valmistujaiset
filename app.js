// Aseta tähän GitHubin Personal Access Token (PAT), jotta tiedosto voidaan tallentaa suoraan repoosi
// const GITHUB_TOKEN = "";
const GITHUB_OWNER = "Eemeli01";
const GITHUB_REPO = "valmistujaiset";
const GITHUB_PATH = "responses.json";
const RSVP_ENDPOINT = "https://formspree.io/f/xaeqgelv";

let colorIdx = 0;
let lastBeat = 0;
let beamIntensity = 0.5;
let wormAngle = 0;
let timeScale = 0;
let textHue = 190;

let audioCtx = null;
let analyser = null;
let dataArray = null;

const audio = document.getElementById("club-audio");
const overlay = document.getElementById("overlay");
const enterBtn = document.getElementById("enter-btn");
// const muteBtn = document.getElementById("mute-btn");
const vipGreeting = document.getElementById("vip-greeting");
const nameInput = document.getElementById("guest-name");
const rsvpForm = document.getElementById("rsvp-form");
const rsvpSuccess = document.getElementById("rsvp-success");
const deadlineRow = document.getElementById("deadline-row");

const inviteCard = document.getElementById("invite-card");
const wormBorder = document.querySelector(".worm-border");
const wormSpinner = document.getElementById("worm-spinner");
const sideSigns = document.querySelectorAll(".side-sign");
const topLights = document.querySelectorAll(".blinder-top .blinder-light");
const bottomLights = document.querySelectorAll(".blinder-bottom .blinder-light");

// Pehmeästi väriä vaihtavat tekstielementit ja nappi
const badgeEl = document.querySelector(".badge");
const partyTitleEl = document.querySelector(".party-title");
const submitBtnEl = document.getElementById("submit-btn");

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
  // muteBtn.classList.remove("hidden");

  requestAnimationFrame(renderLoop);
}

enterBtn.addEventListener("click", initAudioAndVisuals);

//muteBtn.addEventListener("click", () => {
//  audio.muted = !audio.muted;
//  muteBtn.textContent = audio.muted ? "🔇" : "🔊";
//});

function getAverageRange(arr, startIdx, endIdx) {
  let sum = 0;
  for (let i = startIdx; i <= endIdx; i++) {
    sum += arr[i];
  }
  return sum / (endIdx - startIdx + 1);
}

// Kalenteritiedoston (.ics) luonti ja lataus
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "add-to-calendar") {
    e.preventDefault();
    const icsData = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "SUMMARY:Eemelin valmistujaiset",
      "LOCATION:Otakaari 15, Espoo",
      "DESCRIPTION:Eemelin DI-valmistujaisbileet Otaniemessä.",
      "DTSTART:20270109T180000",
      "DTEND:20270110T000000",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "eemelin-valmistujaiset.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
});

// Neon-klubipaletti
const PALETTE = [
  { p: "0, 240, 255", s: "255, 0, 127" },
  { p: "112, 0, 255", s: "0, 255, 102" },
  { p: "255, 0, 85",  s: "0, 240, 255" },
  { p: "255, 230, 0", s: "112, 0, 255" },
  { p: "0, 255, 204", s: "255, 51, 0" }
];

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

// Piirtää valkoisen hohtavan pallon (rx === ry) tai soikion (rx !== ry)
function drawWhiteOrb(x, y, rx, ry, rotRad, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotRad);
  ctx.scale(rx, ry);

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
  grad.addColorStop(0.55, `rgba(245, 250, 255, ${alpha * 0.75})`);
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
let prevWhiteTheme = false;

function renderLoop() {
  analyser.getByteFrequencyData(dataArray);

  const subBass = getAverageRange(dataArray, 1, 4) / 255;
  const mids    = getAverageRange(dataArray, 5, 15) / 255;
  const treble  = getAverageRange(dataArray, 20, 48) / 255;

  const now = performance.now();
  const currentTime = audio.currentTime;

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, cw, ch);

  ctx.globalCompositeOperation = "lighter";

  // Kovakoodatut erikoisjaksot
  const isWhiteClubFlash    = (currentTime >= 3.95 && currentTime <= 4.73);
  const isSteadyClubSection = (currentTime >= 31.4 && currentTime <= 42.4);
  const isWhiteOrbsSection  = (currentTime >= 43.7 && currentTime <= 55.2);

  const isActualBreakdown = (currentTime < 2.0) || 
                            (currentTime >= 16.5 && currentTime <= 17.5) || 
                            (currentTime >= 57.0 && currentTime <= 68.5);
  const totalVolume = subBass * 0.5 + mids * 0.3 + treble * 0.2;
  const isQuietMoment = !isSteadyClubSection && !isWhiteClubFlash && (isActualBreakdown || (totalVolume < 0.16 && currentTime < 120.0));

  // Valkoinen teema on päällä, kun pelkät valkoiset spottivalot tai valkoiset pallot ovat päällä
  const isWhiteTheme = isQuietMoment || isWhiteOrbsSection;

  // Vaihda valomadon väri valkoiseksi/neonväriseksi vain tilan muuttuessa (0% lisäkuorma)
  if (isWhiteTheme !== prevWhiteTheme) {
    if (isWhiteTheme) {
      wormSpinner.style.background = `conic-gradient(
        from 0deg at 50% 50%,
        transparent 0deg,
        rgba(255, 255, 255, 0.55) 10deg,
        #ffffff 24deg,
        rgba(255, 255, 255, 0.55) 38deg,
        transparent 52deg,
        transparent 180deg,
        rgba(255, 255, 255, 0.55) 190deg,
        #ffffff 204deg,
        rgba(255, 255, 255, 0.55) 218deg,
        transparent 232deg
      )`;
      if (wormBorder) wormBorder.style.boxShadow = "0 0 18px rgba(255, 255, 255, 0.35)";
    } else {
      wormSpinner.style.background = "";
      if (wormBorder) wormBorder.style.boxShadow = "";
      if (badgeEl) badgeEl.style.backgroundImage = "none";
    }
    prevWhiteTheme = isWhiteTheme;
  }

  const speedMultiplier = 1 + subBass * 1.8 + treble * 0.8;
  timeScale += 0.012 * speedMultiplier;

  // Eksponentiaalinen intensiteetti: rauhallisissa kohdissa pieni, kovissa dropeissa huippukorkea
  const rawEnergy = Math.min(1, subBass * 0.52 + mids * 0.33 + treble * 0.15);
  const highIntensity = Math.pow(rawEnergy, 2.6);

  // --- TEKSTIEN JA PAINIKKEEN VÄRI / VALKOINEN KIMMELLYS ---
  if (isWhiteTheme) {
    // Rauhallinen valkoinen kimmellys spottivalojen aikana
    const sPos = (50 + Math.sin(now * 0.0024) * 42).toFixed(1);
    const sLow = Math.max(0, Number(sPos) - 26).toFixed(1);
    const sHigh = Math.min(100, Number(sPos) + 26).toFixed(1);

    const bPos = (50 - Math.sin(now * 0.0024) * 42).toFixed(1);
    const bLow = Math.max(0, Number(bPos) - 28).toFixed(1);
    const bHigh = Math.min(100, Number(bPos) + 28).toFixed(1);

    const wGlow = (0.28 + 0.22 * Math.sin(now * 0.003)).toFixed(2);

    if (badgeEl) {
      badgeEl.style.color = "#ffffff";
      badgeEl.style.backgroundColor = "rgba(255, 255, 255, 0.10)";
      badgeEl.style.backgroundImage = `linear-gradient(105deg, rgba(255,255,255,0.03) ${sLow}%, rgba(255,255,255,0.32) ${sPos}%, rgba(255,255,255,0.03) ${sHigh}%)`;
      badgeEl.style.textShadow = `0 0 8px rgba(255, 255, 255, ${wGlow})`;
    }
    if (partyTitleEl) {
      partyTitleEl.style.backgroundImage = `linear-gradient(105deg, #98a2b3 0%, #aab4c6 ${sLow}%, #ffffff ${sPos}%, #aab4c6 ${sHigh}%, #98a2b3 100%)`;
    }
    if (submitBtnEl) {
      submitBtnEl.style.backgroundImage = `linear-gradient(105deg, #b4bccb 0%, #cfd6e6 ${bLow}%, #ffffff ${bPos}%, #cfd6e6 ${bHigh}%, #b4bccb 100%)`;
      submitBtnEl.style.boxShadow = `0 0 14px rgba(255, 255, 255, ${wGlow})`;
    }
  } else {
    // Kovakoodatussa 31.4-42.4s kohdassa hidas liuku, intensiivisissä kohdissa nopea
    let hueStep;
    if (isSteadyClubSection) {
      hueStep = 0.16 + rawEnergy * 0.25;
    } else {
      hueStep = 0.22 + highIntensity * 8.5;
    }

    textHue = (textHue + hueStep) % 360;
    const h1 = textHue.toFixed(1);
    const h2 = ((textHue + 70) % 360).toFixed(1);
    const h3 = ((textHue + 140) % 360).toFixed(1);
    const glowAlpha = (0.35 + subBass * 0.45).toFixed(2);

    if (badgeEl) {
      badgeEl.style.color = `hsl(${h1}, 100%, 62%)`;
      badgeEl.style.backgroundColor = `hsla(${h1}, 100%, 50%, 0.16)`;
      badgeEl.style.textShadow = `0 0 8px hsla(${h1}, 100%, 60%, ${glowAlpha})`;
    }
    if (partyTitleEl) {
      // Koko teksti (myös alkuosan VALM) vaihtaa väriä 0% -> 50% -> 100%
      partyTitleEl.style.backgroundImage = `linear-gradient(90deg, hsl(${h1}, 100%, 64%) 0%, hsl(${h2}, 100%, 66%) 50%, hsl(${h3}, 100%, 64%) 100%)`;
    }
    if (submitBtnEl) {
      submitBtnEl.style.backgroundImage = `linear-gradient(135deg, hsl(${h1}, 100%, 55%), hsl(${h2}, 100%, 55%))`;
      submitBtnEl.style.boxShadow = `0 0 14px hsla(${h1}, 100%, 55%, ${glowAlpha})`;
    }
  }

  const maxLen = Math.hypot(cw, ch) * 0.58;

  if (isWhiteOrbsSection) {
    // 43.7 - 55.2 s: Rauhalliset valkoiset hohtavat soikiot ja pallot
    const oT = now * 0.00075;
    drawWhiteOrb(cw * (0.24 + 0.18 * Math.sin(oT * 1.1)), ch * (0.22 + 0.14 * Math.cos(oT * 0.9)), 46, 22, oT * 0.6, 0.95);
    drawWhiteOrb(cw * (0.76 + 0.16 * Math.cos(oT * 0.85)), ch * (0.28 + 0.15 * Math.sin(oT * 1.05)), 30, 30, 0, 0.90);
    drawWhiteOrb(cw * (0.22 + 0.15 * Math.cos(oT * 0.95 + 1.2)), ch * (0.74 + 0.14 * Math.sin(oT * 0.8 + 0.5)), 32, 32, 0, 0.90);
    drawWhiteOrb(cw * (0.78 + 0.15 * Math.sin(oT * 0.75 + 2.0)), ch * (0.72 + 0.16 * Math.cos(oT * 1.15 + 1.0)), 50, 24, -oT * 0.5, 0.95);
    drawWhiteOrb(cw * (0.50 + 0.28 * Math.sin(oT * 0.65)), ch * (0.16 + 0.10 * Math.sin(oT * 1.3)), 42, 20, Math.sin(oT * 0.7) * 0.8, 0.88);
    drawWhiteOrb(cw * (0.50 + 0.26 * Math.cos(oT * 0.7)), ch * (0.84 + 0.10 * Math.cos(oT * 1.2)), 28, 28, 0, 0.88);
    drawWhiteOrb(cw * (0.50 + 0.30 * Math.sin(oT * 0.55 + 2.5)), ch * (0.50 + 0.24 * Math.cos(oT * 0.65 + 1.4)), 48, 22, oT * 0.4, 0.85);
  } else if (!isQuietMoment) {
    let alpha;

    if (isSteadyClubSection) {
      // 31.4 - 42.4 s: Välkkyminen ja värin vaihto pois, liike pysyy ennallaan
      beamIntensity += (0.72 - beamIntensity) * 0.1;
      alpha = beamIntensity * 0.85;
    } else {
      const beatEnergy = Math.max(subBass * 1.3, mids * 1.15, treble * 1.05);
      if ((subBass > 0.68 || mids > 0.65) && now - lastBeat > 180) {
        colorIdx = (colorIdx + 1) % PALETTE.length;
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
      alpha = Math.min(1, (beamIntensity + subtleSparkle) * strobeGate * 0.85);
    }

    // 3.95 - 4.73 s: Kaikki klubivalot ovat valkoisia
    const colP = isWhiteClubFlash ? "255, 255, 255" : PALETTE[colorIdx].p;
    const colS = isWhiteClubFlash ? "255, 255, 255" : PALETTE[colorIdx].s;
    if (isWhiteClubFlash) {
      alpha = Math.max(alpha, 0.85);
    }

    const t = timeScale;

    drawBeam(0, 0,       45 + Math.sin(t * 0.72) * 55 + Math.cos(t * 0.32) * 35, 42, colP, alpha, maxLen);
    drawBeam(cw, 0,     135 + Math.cos(t * 0.65) * 55 - Math.sin(t * 0.28) * 35, 42, colS, alpha, maxLen);
    drawBeam(0, ch,     -45 - Math.sin(t * 0.68) * 55 + Math.cos(t * 0.42) * 35, 44, colS, alpha, maxLen);
    drawBeam(cw, ch,   -135 - Math.cos(t * 0.78) * 55 + Math.sin(t * 0.36) * 35, 44, colP, alpha, maxLen);

    drawBeam(cw * 0.5, 0,  90 + Math.sin(t * 0.92 + 1.2) * 65, 36, colS, alpha * 0.8, maxLen);
    drawBeam(cw * 0.5, ch, -90 - Math.cos(t * 0.85 + 0.8) * 65, 36, colP, alpha * 0.8, maxLen);
    drawBeam(0, ch * 0.5,   0 + Math.cos(t * 0.68 + 2.1) * 60, 38, colP, alpha * 0.75, maxLen);
    drawBeam(cw, ch * 0.5, 180 - Math.sin(t * 0.88 + 1.7) * 60, 38, colS, alpha * 0.75, maxLen);
  } else {
    const wT = now * 0.0006;
    const whiteCol = "255, 255, 255";
    drawBeam(0, 0,         45 + Math.sin(wT * 0.8) * 45, 18, whiteCol, 0.75, maxLen);
    drawBeam(cw, ch,     -135 - Math.cos(wT * 0.7) * 45, 18, whiteCol, 0.70, maxLen);
    drawBeam(cw * 0.8, 0,  95 + Math.sin(wT * 1.1 + 1.5) * 45, 20, whiteCol, 0.65, maxLen);
    drawBeam(cw * 0.2, ch, -85 - Math.sin(wT * 0.9 + 2.0) * 45, 18, whiteCol, 0.70, maxLen);
    drawBeam(cw * 0.4, 0,  85 + Math.cos(wT * 0.65) * 50, 22, whiteCol, 0.60, maxLen);
  }

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

  const isBassHit = !isQuietMoment && !isSteadyClubSection && !isWhiteOrbsSection && (subBass > 0.80);
  const currentBlinderState = isWhiteOrbsSection
    ? "off"
    : ((buildupActive || isSingingLights) ? `step-${activeStep}` : (isBassHit ? "bass-on" : "off"));

  if (currentBlinderState !== prevBlinderState) {
    if (!isWhiteOrbsSection && (buildupActive || isSingingLights)) {
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

  let wormDir = 1;
  for (const [start] of lightIntervals) {
    if (currentTime >= start) wormDir *= -1;
  }

  // Valomadon nopeus: rauhallisissa ja kovakoodatuissa kohdissa hidas, kovissa kohdissa hurjan nopea
  let wormSpeed;
  if (isQuietMoment || isWhiteOrbsSection) {
    wormSpeed = 0.20 + rawEnergy * 0.20;
  } else if (isSteadyClubSection) {
    wormSpeed = 0.32 + rawEnergy * 0.45;
  } else {
    wormSpeed = 0.35 + highIntensity * 13.5;
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
  const attendance = formData.get("attendance"); // "attending" tai "declined"
  const payload = {
    name: formData.get("name"),
    avec: formData.get("avec") || "",
    attendance: attendance,
    message: formData.get("message") || "",
    timestamp: new Date().toISOString()
  };

  if (RSVP_ENDPOINT.includes("YOUR_FORM_ID")) {
    setTimeout(() => {
      showSuccess(attendance);
    }, 500);
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
      showSuccess(attendance);
    } else {
      alert("Ilmoittautumisen lähetys epäonnistui. Yritä uudelleen!");
      submitBtn.disabled = false;
      submitBtn.textContent = "LÄHETÄ VASTAUS";
    }
  } catch (err) {
    showSuccess(attendance);
  }
});

function showSuccess(attendance) {
  rsvpForm.classList.add("hidden");
  rsvpSuccess.classList.remove("hidden");

  const successTitle = rsvpSuccess.querySelector("h3");
  const successText = rsvpSuccess.querySelector("p");
  const checkIcon = rsvpSuccess.querySelector(".check-icon");

  if (attendance === "declined") {
    checkIcon.textContent = "🤝";
    successTitle.textContent = "Valinta tallennettu!";
    successText.textContent = "Pysytään yhteyksissä!";
    
    const cardHeader = inviteCard.querySelector(".card-header");
    const eventDetails = inviteCard.querySelector(".event-details");
    if (cardHeader) cardHeader.style.display = "none";
    if (eventDetails) eventDetails.style.display = "none";
  } else {
    checkIcon.textContent = "✨";
    successTitle.textContent = "Olet listalla!";
    successText.textContent = "Vastauksesi on tallennettu. Nähdään Otaniemessä 9. tammikuuta!";

    if (deadlineRow) {
      deadlineRow.innerHTML = `
        <span class="icon">🗓️</span>
        <div>
          <strong>Kalenteri</strong>
          <p><a href="#" id="add-to-calendar" style="color: var(--active-color); text-decoration: underline; cursor: pointer;">Lisää kalenteriin</a></p>
        </div>
      `;
    }
  }
}