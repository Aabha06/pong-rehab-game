// ============================================================
//  PONG REHAB GAME — Wired USB Serial version
//  Controls: USB Serial (Arduino) with mouse fallback
// ============================================================

const canvas = document.getElementById("pong");
const ctx    = canvas.getContext("2d");

// ── DOM refs ─────────────────────────────────────────────────
const statusText = document.getElementById("statusText");
const statReps   = document.getElementById("statReps");
const statPeak   = document.getElementById("statPeak");
const statAngle  = document.getElementById("statAngle");
const statTime   = document.getElementById("statTime");

// ── Sounds ───────────────────────────────────────────────────
const hit       = new Audio("sounds/hit.mp3");
const wall      = new Audio("sounds/wall.mp3");
const comScore  = new Audio("sounds/comScore.mp3");
const userScore = new Audio("sounds/userScore.mp3");

// ── Ball ─────────────────────────────────────────────────────
const ball = {
    x         : canvas.width / 2,
    y         : canvas.height / 2,
    radius    : 10,
    velocityX : 5,
    velocityY : 5,
    speed     : 5,        // reduced from 7 — rehab friendly
    color     : "WHITE"
};

// ── User paddle ───────────────────────────────────────────────
const user = {
    x      : 0,
    y      : (canvas.height - 100) / 2,
    width  : 10,
    height : 60,
    score  : 0,
    color  : "WHITE"
};

// ── CPU paddle ───────────────────────────────────────────────
const com = {
    x      : canvas.width - 10,
    y      : (canvas.height - 100) / 2,
    width  : 10,
    height : 100,
    score  : 0,
    color  : "WHITE"
};

// ── Net ──────────────────────────────────────────────────────
const net = {
    x      : (canvas.width - 2) / 2,
    y      : 0,
    height : 10,
    width  : 2,
    color  : "WHITE"
};

// ── Rehab state ───────────────────────────────────────────────
let currentAngle  = 0;
let peakAngle     = 0;
let repCount      = 0;
let serialConnected = false;

const REP_UP_THRESHOLD   = 120;   // arm must reach this (degrees)
const REP_DOWN_THRESHOLD = 30;    // arm must return below this
let repArmed = false;             // true once arm crosses UP threshold

// ── Session timer ─────────────────────────────────────────────
const sessionStart = Date.now();
setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    statTime.textContent = `${mm}:${ss}`;
}, 1000);

// ============================================================
//  WEB SERIAL — Wired USB connection
// ============================================================
async function connectSerial() {
    try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });

        statusText.textContent  = "Connected ✓";
        statusText.style.color  = "#4caf50";
        serialConnected         = true;

        const decoder = new TextDecoderStream();
        port.readable.pipeTo(decoder.writable);
        const reader = decoder.readable.getReader();

        let buffer = "";
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            // Split on newlines — Arduino sends one angle per line
            const lines = buffer.split("\n");
            buffer = lines.pop();                 // keep incomplete line
            for (const line of lines) {
                const trimmed = line.trim();
                // Accept lines that are purely numeric (the angle value)
                // Ignore Serial.println lines like ">> REP 1 started" etc.
                const angle = parseFloat(trimmed);
                if (!isNaN(angle) && trimmed.match(/^\d+(\.\d+)?$/)) {
                    updatePaddleFromAngle(angle);
                }
            }
        }
    } catch (err) {
        statusText.textContent = "Serial error: " + err.message;
        statusText.style.color = "#e94560";
    }
}

// ============================================================
//  ANGLE → PADDLE MAPPING
//  0°   = arm at side  → paddle at BOTTOM
//  90°  = arm horiz    → paddle at MIDDLE
//  180° = arm overhead → paddle at TOP
// ============================================================
function updatePaddleFromAngle(angle) {
    angle = Math.max(0, Math.min(180, angle));
    currentAngle = angle;

    // Target paddle Y
    const targetY = (1 - angle / 180) * (canvas.height - user.height);

    // Smooth lerp
    user.y =targetY;

    // Update peak angle
    if (angle > peakAngle) {
        peakAngle = angle;
        statPeak.textContent = peakAngle.toFixed(1) + "°";
    }

    // Update live angle display
    statAngle.textContent = angle.toFixed(1) + "°";

    // ── Rep counting ─────────────────────────────────────────
    // Rep = arm goes UP past REP_UP_THRESHOLD then back DOWN below REP_DOWN_THRESHOLD
    if (!repArmed && angle >= REP_UP_THRESHOLD) {
        repArmed = true;
    }
    if (repArmed && angle <= REP_DOWN_THRESHOLD) {
        repArmed = false;
        repCount++;
        statReps.textContent = repCount;
    }
}

// ============================================================
//  MOUSE FALLBACK (works when serial not connected)
// ============================================================
canvas.addEventListener("mousemove", (evt) => {
    if (serialConnected) return;    // ignore mouse if Arduino connected
    const rect = canvas.getBoundingClientRect();
    user.y = evt.clientY - rect.top - user.height / 2;
});

// ============================================================
//  DRAW HELPERS
// ============================================================
function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function drawArc(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
}

function drawNet() {
    for (let i = 0; i <= canvas.height; i += 15) {
        drawRect(net.x, net.y + i, net.width, net.height, net.color);
    }
}

function drawText(text, x, y) {
    ctx.fillStyle = "#FFF";
    ctx.font      = "75px fantasy";
    ctx.fillText(text, x, y);
}

// ── ROM bar (right edge of canvas) ───────────────────────────
function drawROMBar() {
    const barX      = canvas.width - 18;
    const barH      = canvas.height - 20;
    const barY      = 10;
    const fillH     = (currentAngle / 180) * barH;

    // Background track
    ctx.fillStyle = "#333";
    ctx.fillRect(barX, barY, 8, barH);

    // Fill level
    ctx.fillStyle = currentAngle >= 90 ? "#4caf50" : "#e94560";
    ctx.fillRect(barX, barY + barH - fillH, 8, fillH);

    // Label
    ctx.fillStyle  = "#aaa";
    ctx.font       = "10px Arial";
    ctx.fillText("ROM", barX - 2, barY + barH + 12);
}

// ============================================================
//  COLLISION DETECTION
// ============================================================
function collision(b, p) {
    p.top    = p.y;
    p.bottom = p.y + p.height;
    p.left   = p.x;
    p.right  = p.x + p.width;

    b.top    = b.y - b.radius;
    b.bottom = b.y + b.radius;
    b.left   = b.x - b.radius;
    b.right  = b.x + b.radius;

    return p.left < b.right && p.top < b.bottom &&
           p.right > b.left && p.bottom > b.top;
}

// ============================================================
//  RESET BALL
// ============================================================
function resetBall() {
    ball.x         = canvas.width / 2;
    ball.y         = canvas.height / 2;
    ball.velocityX = -ball.velocityX;
    ball.speed     = 4;
}

// ============================================================
//  UPDATE
// ============================================================
function update() {
    // Scoring
    if (ball.x - ball.radius < 0) {
        com.score++;
        comScore.play();
        resetBall();
    } else if (ball.x + ball.radius > canvas.width) {
        user.score++;
        userScore.play();
        resetBall();
    }

    ball.x += ball.velocityX;
    ball.y += ball.velocityY;

    // CPU AI — easy
    com.y += (ball.y - (com.y + com.height / 2)) * 0.05;

    // Wall bounce
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.velocityY = -ball.velocityY;
        wall.play();
    }

    // Paddle collision
    const player = (ball.x + ball.radius < canvas.width / 2) ? user : com;

    if (collision(ball, player)) {
        hit.play();
        let collidePoint  = ball.y - (player.y + player.height / 2);
        collidePoint      = collidePoint / (player.height / 2);
        const angleRad    = (Math.PI / 4) * collidePoint;
        const direction   = (ball.x + ball.radius < canvas.width / 2) ? 1 : -1;
        ball.velocityX    = direction * ball.speed * Math.cos(angleRad);
        ball.velocityY    = ball.speed * Math.sin(angleRad);
        ball.speed       += 0.1;
    }
}

// ============================================================
//  RENDER
// ============================================================
function render() {
    drawRect(0, 0, canvas.width, canvas.height, "#1a1a2e");   // dark bg
    drawText(user.score, canvas.width / 4,       canvas.height / 5);
    drawText(com.score,  3 * canvas.width / 4,   canvas.height / 5);
    drawNet();
    drawRect(user.x, user.y, user.width, user.height, user.color);
    drawRect(com.x,  com.y,  com.width,  com.height,  com.color);
    drawArc(ball.x, ball.y, ball.radius, ball.color);
    drawROMBar();
}

// ============================================================
//  GAME LOOP
// ============================================================
function game() {
    update();
    render();
}

setInterval(game, 1000 / 50);   // 50 fps