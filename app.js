// Aseta tähän GitHubin Personal Access Token (PAT), jotta tiedosto voidaan tallentaa suoraan repoosi
const GITHUB_TOKEN = "V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";
const GITHUB_OWNER = "Eemeli01";
const GITHUB_REPO = "valmistujaiset";
const GITHUB_PATH = "responses.json";

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
const deadlineRow = document.getElementById("deadline-row");

const inviteCard = document.getElementById("invite-card");
const wormSpinner = document.getElementById("worm-spinner");
const sideSigns = document.querySelectorAll(".side-sign");
const topLights = document.querySelectorAll(".blinder-top .blinder-light");
const bottomLights = document.querySelectorAll(".blinder-bottom .blinder-light");

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

// Funktio vastausten tallentamiseksi suoraan GitHubiin (responses.json)
async function saveResponseToGitHub(payload) {
  if (GITHUB_TOKEN.includes("VAIHDA")) return; // Ohitetaan jos tokenia ei ole asetettu

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
  try {
    let sha = null;
    let existingData = [];

    const getRes = await fetch(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      try {
        existingData = JSON.parse(atob(fileData.content));
      } catch (e) {
        existingData = [];
      }
    }

    existingData.push(payload);

    const contentEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(existingData, null, 2))));

    await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `RSVP response from ${payload.name}`,
        content: contentEncoded,
        sha: sha
      })
    });
  } catch (err) {
    console.error("GitHub save error:", err);
  }
}

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

  const isActualBreakdown = (currentTime < 2.0) || 
                            (currentTime >= 16.5 && currentTime <= 17.5) || 
                            (currentTime >= 57.0 && currentTime <= 68.5);
  const totalVolume = subBass * 0.5 + mids * 0.3 + treble * 0.2;
  const isQuietMoment = isActualBreakdown || (totalVolume < 0.16 && currentTime < 120.0);

  const speedMultiplier = 1 + subBass * 1.8 + treble * 0.8;
  timeScale += 0.012 * speedMultiplier;

  const maxLen = Math.hypot(cw, ch) * 0.58;

  if (!isQuietMoment) {
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
    const alpha = Math.min(1, (beamIntensity + subtleSparkle) * strobeGate * 0.85);

    const colP = PALETTE[colorIdx].p;
    const colS = PALETTE[colorIdx].s;
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
  const attendance = formData.get("attendance"); // "attending" tai "declined"
  const payload = {
    name: formData.get("name"),
    avec: formData.get("avec") || "",
    attendance: attendance,
    message: formData.get("message") || "",
    timestamp: new Date().toISOString()
  };

  // Tallennetaan tiedosto GitHubiin taustalla
  saveResponseToGitHub(payload);

  if (RSVP_ENDPOINT.includes("YOUR_FORM_ID")) {
    setTimeout(() => {
      showSuccess(attendance);
    }, 600);
    return;
  }

  try {
    await fetch(RSVP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });
    showSuccess(attendance);
  } catch {
    showSuccess(attendance); // Näytetään silti onnistumisviesti käyttäjälle
  }
});

function showSuccess(attendance) {
  rsvpForm.classList.add("hidden");
  rsvpSuccess.classList.remove("hidden");

  const successTitle = rsvpSuccess.querySelector("h3");
  const successText = rsvpSuccess.querySelector("p");
  const checkIcon = rsvpSuccess.querySelector(".check-icon");

  if (attendance === "declined") {
    // Jos käyttäjä ei pääse, kortti näyttää vain kättely-emojin ja halutun tekstin ilman ylimääräisiä tervetuloja
    checkIcon.textContent = "🤝";
    successTitle.textContent = "Valinta tallennettu!";
    successText.textContent = "Pysytään yhteyksissä!";
    
    // Piilotetaan kortin yläosan header ja event-details kokonaan, jotta näkymä on siisti
    const cardHeader = inviteCard.querySelector(".card-header");
    const eventDetails = inviteCard.querySelector(".event-details");
    if (cardHeader) cardHeader.style.display = "none";
    if (eventDetails) eventDetails.style.display = "none";
  } else {
    // Jos pääsee paikalle: deadline korvataan kalenterilinkillä
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