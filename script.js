// Initialize canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameArea = document.getElementById('gameArea');

// Screen dimensions
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;
if (gameArea) {
    gameArea.style.width = SCREEN_WIDTH + 'px';
    gameArea.style.height = SCREEN_HEIGHT + 'px';
}

// Brick properties
const BRICK_WIDTH = 60;
const BRICK_HEIGHT = 20;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_PADDING = 10;
const BRICK_OFFSET_TOP = 35;
const BRICK_OFFSET_LEFT = 35;

// Colors
const COLOR_BLACK = 'black';
const COLOR_WHITE = 'white';
const COLOR_RED = 'red';
const COLOR_BLUE = 'blue';

// Default speeds
const DEFAULT_BALL_SPEED = 9.0;
const MAX_BALL_SPEED = 50.0;
const DEFAULT_PADDLE_SPEED = 6;
const PADDLE_SPEED_RATIO = DEFAULT_PADDLE_SPEED / DEFAULT_BALL_SPEED;

// Paddle setup
let paddle = {
    width: 100,
    height: 10,
    x: SCREEN_WIDTH / 2 - 50,
    y: SCREEN_HEIGHT - 50,
    speed: DEFAULT_PADDLE_SPEED
};

// Ball setup
let ball = {
    radius: 10,
    x: SCREEN_WIDTH / 2,
    y: SCREEN_HEIGHT / 2,
    dx: DEFAULT_BALL_SPEED * (Math.random() < 0.5 ? 1 : -1),
    dy: DEFAULT_BALL_SPEED * (Math.random() < 0.5 ? 1 : -1),
    speed: DEFAULT_BALL_SPEED
};
const initialAngleForBall = Math.atan2(ball.dy, ball.dx);
ball.dx = ball.speed * Math.cos(initialAngleForBall);
ball.dy = ball.speed * Math.sin(initialAngleForBall);


// Bricks array
let bricks = [];

// Game state variables
let score = 0;
let autoFollowMode = true;
let running = true;
let animationFrameId;
let paddleMoveDirectionTouch = 0;

// Touch Controls Visibility
let touchControlsAreVisible = true;
let touchLeftEl, touchRightEl;

// Counters
let horizontal_bounce_counter = 0;
let last_bounce_height = null;
let same_height_bounces = 0;
let consecutive_horizontal_moves = 0;
let previous_ball_centery = ball.y;

// Time variables
let global_start_time = Date.now();
let new_game_timeout_id = null;
let autoSpeedIncreaseIntervalId = null;

let showInitialAutomodeMessage = false;
let initialMessageTimeoutId = null;

// DOM Elements
const autoFollowStatusElement = document.getElementById('autoFollowStatus');

// --- HELPER FUNCTIONS ---
function manageAutoSpeedIncrease() {
    if (autoFollowMode && running) {
        if (!autoSpeedIncreaseIntervalId) {
            autoSpeedIncreaseIntervalId = setInterval(() => {
                if (autoFollowMode && running) {
                    if (ball.speed < MAX_BALL_SPEED) {
                        let oldSpeed = ball.speed;
                        ball.speed = Math.min(ball.speed + 5, MAX_BALL_SPEED);
                        // Only log and update if speed actually changed or just reached max
                        if (ball.speed > oldSpeed || (ball.speed === MAX_BALL_SPEED && oldSpeed < MAX_BALL_SPEED) ) {
                            updateBallSpeedComponents();
                            paddle.speed = PADDLE_SPEED_RATIO * ball.speed;
                            if (paddle.speed < 3) paddle.speed = 3;
                            console.log(`Auto mode: Speed increased from ${oldSpeed.toFixed(1)} to ${ball.speed.toFixed(1)}`);
                             if (ball.speed === MAX_BALL_SPEED) {
                                console.log(`Auto mode: Speed reached MAX ${ball.speed.toFixed(1)}`);
                                // Optional: Stop interval once max speed is reached
                                // clearInterval(autoSpeedIncreaseIntervalId);
                                // autoSpeedIncreaseIntervalId = null;
                            }
                        }
                    }
                } else {
                    if (autoSpeedIncreaseIntervalId) {
                        clearInterval(autoSpeedIncreaseIntervalId);
                        autoSpeedIncreaseIntervalId = null;
                        console.log("Auto mode: Speed increase stopped (mode off or game stopped).");
                    }
                }
            }, 2500);
            console.log("Auto mode: Speed increase started.");
        }
    } else {
        if (autoSpeedIncreaseIntervalId) {
            clearInterval(autoSpeedIncreaseIntervalId);
            autoSpeedIncreaseIntervalId = null;
            console.log("Auto mode: Speed increase stopped.");
        }
    }
}


function updateBallSpeedComponents() {
    const angle = Math.atan2(ball.dy, ball.dx);
    ball.dx = ball.speed * Math.cos(angle);
    ball.dy = ball.speed * Math.sin(angle);
}

function toggleAutoFollow() {
    autoFollowMode = !autoFollowMode;
    if (autoFollowStatusElement) {
        autoFollowStatusElement.textContent = `Auto-Follow: ${autoFollowMode ? 'ON' : 'OFF'}`;
    }
    if (autoFollowMode) {
        paddleMoveDirectionTouch = 0;
    }
    if (showInitialAutomodeMessage) {
        showInitialAutomodeMessage = false;
        if (initialMessageTimeoutId) {
            clearTimeout(initialMessageTimeoutId);
            initialMessageTimeoutId = null;
        }
    }
    manageAutoSpeedIncrease();
}

function calculateBallAngle() {
    let relative_intersect_x = (ball.x - paddle.x) / paddle.width - 0.5;
    let random_adjustment = Math.random() * 14 - 7;

    let angle_deg;
    if (relative_intersect_x > -0.05 && relative_intersect_x < 0.05) { // Center hit
        angle_deg = (ball.dx > 0 ? 65 : 115) + random_adjustment;
    } else if (relative_intersect_x < -0.05) { // Hit left side
        angle_deg = 130 + (relative_intersect_x + 0.5) * 40; // Angles from 110 to 150
    } else { // Hit right side
        angle_deg = 50 + (relative_intersect_x - 0.5) * 40; // Angles from 30 to 70
    }
    return angle_deg * Math.PI / 180;
}

// MODIFIED: ensureNonHorizontal function
function ensureNonHorizontal(dx, dy) {
    let current_speed = Math.sqrt(dx * dx + dy * dy);

    if (current_speed === 0) {
        console.warn("ensureNonHorizontal: dx and dy were zero. Resetting components using ball.speed.");
        let targetSpeed = ball.speed || DEFAULT_BALL_SPEED;
        if (targetSpeed === 0) targetSpeed = DEFAULT_BALL_SPEED;

        let randomAngleDeg = Math.random() * 360;
        while (randomAngleDeg % 90 === 0 || (randomAngleDeg > -5 && randomAngleDeg < 5) || (randomAngleDeg > 175 && randomAngleDeg < 185) || (randomAngleDeg > 355 || randomAngleDeg < -355) ) { // Avoid very horizontal/vertical
            randomAngleDeg = Math.random() * 360;
        }
        let randomAngleRad = randomAngleDeg * Math.PI / 180;
        
        dx = targetSpeed * Math.cos(randomAngleRad);
        dy = targetSpeed * Math.sin(randomAngleRad);
        return [dx, dy];
    }

    const minVerticalRatio = 0.10; // Minimum 10% of speed for vertical component (approx 5.7 degrees from horizontal)
    if (Math.abs(dy / current_speed) < minVerticalRatio) {
        // console.warn(`ensureNonHorizontal: dy too small (${(dy/current_speed).toFixed(3)}). Adjusting. Speed:${current_speed.toFixed(1)}`);
        
        let sign_dy_pref = Math.sign(dy);
        if (sign_dy_pref === 0) { 
            sign_dy_pref = (ball.y > SCREEN_HEIGHT / 2) ? -1 : 1; 
        }
        
        dy = sign_dy_pref * current_speed * (minVerticalRatio + Math.random() * 0.05); // 10-15% vertical
        
        let dx_squared = current_speed * current_speed - dy * dy;
        let sign_dx_pref = Math.sign(dx);
        if (sign_dx_pref === 0) sign_dx_pref = (Math.random() < 0.5 ? 1 : -1);

        dx = sign_dx_pref * Math.sqrt(Math.max(0, dx_squared));
        // console.warn(`ensureNonHorizontal: Adjusted to dx:${dx.toFixed(1)}, dy:${dy.toFixed(1)}`);
    }
    return [dx, dy];
}


function sanityCheckBallPosition(dx, dy) {
    if (ball.x - ball.radius < 0) {
        ball.x = ball.radius + 0.1; // Push out slightly
        dx = Math.abs(dx);
    } else if (ball.x + ball.radius > SCREEN_WIDTH) {
        ball.x = SCREEN_WIDTH - ball.radius - 0.1;
        dx = -Math.abs(dx);
    }
    if (ball.y - ball.radius < 0) {
        ball.y = ball.radius + 0.1;
        dy = Math.abs(dy);
    }

    if (Math.abs(ball.y - previous_ball_centery) < 1) {
        consecutive_horizontal_moves++;
    } else {
        consecutive_horizontal_moves = 0;
    }
    previous_ball_centery = ball.y;

    if (consecutive_horizontal_moves >= 4) {
        const originalSpeed = Math.sqrt(dx * dx + dy * dy);
        dy = originalSpeed * (Math.random() < 0.5 ? -0.3 : 0.3);
        let new_dx_squared = originalSpeed * originalSpeed - dy * dy;
        dx = (dx >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, new_dx_squared)); // Preserve sign of dx
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && originalSpeed > 0) {
             dx = originalSpeed * (Math.random() < 0.5 ? -1 : 1) * 0.707;
             dy = originalSpeed * (Math.random() < 0.5 ? -1 : 1) * 0.707;
        }
        consecutive_horizontal_moves = 0;
        // console.log("Sanity check: Nudged ball from horizontal lock.");
        return ensureNonHorizontal(dx, dy); // Re-check after nudge
    }
    return [dx, dy];
}

function teleportBallToPaddle() {
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius - 5;
    return [0, -ball.speed];
}

// --- DRAW FUNCTIONS ---
function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = COLOR_BLUE;
    ctx.fill();
    ctx.closePath();
}

function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_WHITE;
    ctx.fill();
    ctx.closePath();
}

function createBricks() {
    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
        bricks[r] = [];
        for (let c = 0; c < BRICK_COLS; c++) {
            bricks[r][c] = {
                x: c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT,
                y: r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP,
                width: BRICK_WIDTH,
                height: BRICK_HEIGHT,
                status: 1
            };
        }
    }
}

function drawBricks() {
    for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
            if (bricks[r][c].status === 1) {
                ctx.beginPath();
                ctx.rect(bricks[r][c].x, bricks[r][c].y, BRICK_WIDTH, BRICK_HEIGHT);
                ctx.fillStyle = COLOR_RED;
                ctx.fill();
                ctx.closePath();
            }
        }
    }
}

function drawScoreAndInfo() {
    ctx.font = '18px Arial';
    ctx.fillStyle = COLOR_WHITE;
    ctx.textAlign = 'left';
    ctx.fillText(`Speed: ${ball.speed.toFixed(1)}`, 10, 20);
    ctx.fillText(`Score: ${score}`, SCREEN_WIDTH - 100, 20);

    const global_elapsed_time = (Date.now() - global_start_time) / 1000;
    ctx.fillText(`Playtime: ${global_elapsed_time.toFixed(1)}s`, 10, SCREEN_HEIGHT - 10);

    if (showInitialAutomodeMessage) {
        ctx.font = '20px Arial';
        ctx.fillStyle = 'yellow';
        ctx.textAlign = 'center';
        ctx.fillText("Automode enabled. Press 'A' to toggle.", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 100);
    }
}


// --- COLLISION DETECTION ---
function handleBrickCollisions() {
    for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
            const brick = bricks[r][c];
            if (brick.status === 1) {
                const ballLeft = ball.x - ball.radius;
                const ballRight = ball.x + ball.radius;
                const ballTop = ball.y - ball.radius;
                const ballBottom = ball.y + ball.radius;

                if (ballRight > brick.x && ballLeft < brick.x + brick.width &&
                    ballBottom > brick.y && ballTop < brick.y + brick.height) {
                    brick.status = 0;
                    score += 10;

                    const prevBallX = ball.x - ball.dx; // Position before this frame's dx/dy were applied
                    const prevBallY = ball.y - ball.dy;

                    let hitFromLeft = (prevBallX + ball.radius <= brick.x) && (ball.x + ball.radius > brick.x);
                    let hitFromRight = (prevBallX - ball.radius >= brick.x + brick.width) && (ball.x - ball.radius < brick.x + brick.width);
                    let hitFromTop = (prevBallY + ball.radius <= brick.y) && (ball.y + ball.radius > brick.y);
                    let hitFromBottom = (prevBallY - ball.radius >= brick.y + brick.height) && (ball.y - ball.radius < brick.y + brick.height);

                    if (hitFromLeft || hitFromRight) {
                        ball.dx = -ball.dx;
                         if (hitFromLeft) ball.x = brick.x - ball.radius - 0.1;
                         else ball.x = brick.x + brick.width + ball.radius + 0.1;
                    } else if (hitFromTop || hitFromBottom) {
                        ball.dy = -ball.dy;
                        if (hitFromTop) ball.y = brick.y - ball.radius - 0.1;
                        else ball.y = brick.y + brick.height + ball.radius + 0.1;
                    } else { // Corner hit or already inside (less accurate, fallback)
                        const overlapX = (ball.radius + brick.width / 2) - Math.abs(ball.x - (brick.x + brick.width / 2));
                        const overlapY = (ball.radius + brick.height / 2) - Math.abs(ball.y - (brick.y + brick.height / 2));
                        if (overlapX < overlapY) { // Assumes side hit if X overlap is smaller
                            ball.dx = -ball.dx;
                            ball.x += ball.dx > 0 ? overlapX : -overlapX; // Nudge out
                        } else {
                            ball.dy = -ball.dy;
                            ball.y += ball.dy > 0 ? overlapY : -overlapY; // Nudge out
                        }
                    }

                    [ball.dx, ball.dy] = ensureNonHorizontal(ball.dx, ball.dy);
                    same_height_bounces = 0;

                    if (bricks.flat().every(b => b.status === 0)) {
                        if (!new_game_timeout_id) {
                            console.log("All bricks destroyed! New game in 2.5s.");
                            new_game_timeout_id = setTimeout(() => {
                                resetGame(true, ball.speed);
                                new_game_timeout_id = null;
                            }, 2500);
                        }
                    }
                    return;
                }
            }
        }
    }
}


// --- GAME LOGIC ---
function resetGame(keepScore = false, retainSpeed = null) {
    if (new_game_timeout_id) {
        clearTimeout(new_game_timeout_id);
        new_game_timeout_id = null;
    }

    if (autoFollowStatusElement) {
        autoFollowStatusElement.textContent = `Auto-Follow: ${autoFollowMode ? 'ON' : 'OFF'}`;
    }

    createBricks();
    paddle.x = SCREEN_WIDTH / 2 - paddle.width / 2;
    paddle.y = SCREEN_HEIGHT - 50;

    ball.x = SCREEN_WIDTH / 2;
    ball.y = SCREEN_HEIGHT / 2;

    if (retainSpeed !== null) {
        ball.speed = retainSpeed;
    } else {
        ball.speed = DEFAULT_BALL_SPEED;
    }
    let initialAngle = (Math.random() * 60 + 240) * Math.PI / 180;
    if (Math.random() < 0.5) initialAngle = (Math.random() * 60 + 30) * Math.PI / 180;

    ball.dx = ball.speed * Math.cos(initialAngle);
    ball.dy = ball.speed * Math.sin(initialAngle);
    if (ball.dy < 0 && initialAngle < Math.PI) ball.dy = -ball.dy; // Ensure downward if angle was in upper half initially
    else if (ball.dy > 0 && initialAngle > Math.PI) ball.dy = -ball.dy; // Ensure upward if angle was in lower half
    [ball.dx, ball.dy] = ensureNonHorizontal(ball.dx, ball.dy);


    paddle.speed = PADDLE_SPEED_RATIO * ball.speed;
    if (paddle.speed < 3) paddle.speed = 3;


    if (!keepScore) {
        score = 0;
        global_start_time = Date.now();
        showInitialAutomodeMessage = true;
        if (initialMessageTimeoutId) clearTimeout(initialMessageTimeoutId);
        initialMessageTimeoutId = setTimeout(() => {
            showInitialAutomodeMessage = false;
            initialMessageTimeoutId = null;
        }, 15000);
    } else {
        showInitialAutomodeMessage = false;
        if (initialMessageTimeoutId) {
            clearTimeout(initialMessageTimeoutId);
            initialMessageTimeoutId = null;
        }
    }


    horizontal_bounce_counter = 0;
    last_bounce_height = null;
    same_height_bounces = 0;
    consecutive_horizontal_moves = 0;
    previous_ball_centery = ball.y;
    paddleMoveDirectionTouch = 0;

    running = true;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    gameLoop();

    manageAutoSpeedIncrease();
}

let keysPressed = {};
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    keysPressed[key] = true;

    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
    }

    if (key === 'a') toggleAutoFollow();
    if (key === ' ') {
        const teleportResult = teleportBallToPaddle();
        ball.dx = teleportResult[0];
        ball.dy = teleportResult[1];
    }
    if (key === 'n') {
        resetGame(true, ball.speed);
    }
    if (key === 't') {
        toggleTouchControls();
    }
});
document.addEventListener('keyup', (e) => {
    keysPressed[e.key.toLowerCase()] = false;
});

// --- MOUSE CONTROLS ---
function handleMouseMove(e) {
    if (!autoFollowMode) {
        const rect = canvas.getBoundingClientRect();
        let mouseX = e.clientX - rect.left;
        paddle.x = mouseX - paddle.width / 2;
        if (paddle.x < 0) {
            paddle.x = 0;
        }
        if (paddle.x + paddle.width > SCREEN_WIDTH) {
            paddle.x = SCREEN_WIDTH - paddle.width;
        }
    }
}


function handleInput() {
    if (keysPressed['arrowup']) {
        ball.speed = Math.min(ball.speed + 0.1, MAX_BALL_SPEED);
        updateBallSpeedComponents();
        paddle.speed = PADDLE_SPEED_RATIO * ball.speed;
        if (paddle.speed < 3) paddle.speed = 3;
    }
    if (keysPressed['arrowdown']) {
        ball.speed = Math.max(ball.speed - 0.1, DEFAULT_BALL_SPEED * 0.5);
        updateBallSpeedComponents();
        paddle.speed = PADDLE_SPEED_RATIO * ball.speed;
        if (paddle.speed < 3) paddle.speed = 3;
    }
}


function update() {
    handleInput();

    // Store previous ball position for collision checks
    const ballPrevX = ball.x; // Store before dx/dy is applied for this frame
    const ballPrevY = ball.y;

    if (!autoFollowMode) {
        let netPaddleMovement = 0;
        if (keysPressed['arrowleft']) {
            netPaddleMovement = -1;
        } else if (keysPressed['arrowright']) {
            netPaddleMovement = 1;
        } else if (paddleMoveDirectionTouch !== 0) {
            netPaddleMovement = paddleMoveDirectionTouch;
        }

        if (netPaddleMovement !== 0) { // Keyboard/Touch overrides mouse if keys are pressed
            paddle.x += netPaddleMovement * paddle.speed;
        }
        // Mouse movement is handled by handleMouseMove which directly sets paddle.x

        if (paddle.x < 0) paddle.x = 0;
        if (paddle.x + paddle.width > SCREEN_WIDTH) paddle.x = SCREEN_WIDTH - paddle.width;
    }

    ball.x += ball.dx;
    ball.y += ball.dy;

    // --- Wall and Sanity Checks ---
    // Important: Call sanityCheckBallPosition *before* wall collision dx/dy reversals,
    // so it can detect stuck states based on pre-reversal movement.
    // However, wall collisions need to reposition the ball first.
    // Let's try: position update -> wall collision (pos + dir change) -> sanity check (dir change)

    // Wall collisions (sides)
    if (ball.x + ball.radius > SCREEN_WIDTH) {
        ball.x = SCREEN_WIDTH - ball.radius;
        ball.dx = -ball.dx;
        // Horizontal bounce counter logic
        // ... (omitted for brevity, same as before)
    } else if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.dx = -ball.dx;
        // ...
    }
    // Wall collision (top)
    if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.dy = -ball.dy; // Bounce down
        horizontal_bounce_counter = 0;
    }
    
    // Apply ensureNonHorizontal *after* any reflection that might make it horizontal
    [ball.dx, ball.dy] = ensureNonHorizontal(ball.dx, ball.dy);
    [ball.dx, ball.dy] = sanityCheckBallPosition(ball.dx, ball.dy); // And sanity check again


    // --- Game Over Check ---
    if (ball.y + ball.radius > SCREEN_HEIGHT) {
        console.log("Game Over - Ball hit the bottom!");
        running = false;
        ctx.font = "40px Arial";
        ctx.fillStyle = "orange";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20);
        ctx.font = "24px Arial";
        ctx.fillText(`Final Score: ${score}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 20);
        ctx.fillText("Press 'N' to Play Again", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 60);
        manageAutoSpeedIncrease(); // Stop auto speed increase
        return;
    }

    // --- Auto-Follow Paddle ---
    if (autoFollowMode) {
        paddle.x = ball.x - paddle.width / 2;
        if (paddle.x < 0) paddle.x = 0;
        if (paddle.x + paddle.width > SCREEN_WIDTH) paddle.x = SCREEN_WIDTH - paddle.width;
    }

    // --- Paddle Collision (MODIFIED) ---
    if (ball.dy > 0) { // Ball moving downwards
        const ballEffectivePrevY = ballPrevY; // Use ball.y from start of this frame's update cycle
        
        const ballPrevBottom = ballEffectivePrevY + ball.radius;
        const ballCurrentBottom = ball.y + ball.radius;
        const ballCurrentTop = ball.y - ball.radius;

        const paddleTop = paddle.y;
        const paddleBottom = paddle.y + paddle.height;

        // Check if ball is horizontally aligned AND its downward path intersected the paddle's top surface
        if (ball.x + ball.radius >= paddle.x && ball.x - ball.radius <= paddle.x + paddle.width) { // Horizontal check first
            if ((ballPrevBottom <= paddleTop && ballCurrentBottom >= paddleTop) || // Crossed top surface
                (ballCurrentTop < paddleBottom && ballCurrentBottom > paddleTop)) { // Or is currently overlapping
                
                const bounce_angle = calculateBallAngle();
                ball.dx = ball.speed * Math.cos(bounce_angle);
                ball.dy = -ball.speed * Math.sin(bounce_angle); // Bounce upwards
                
                // Reposition ball to be exactly on top of the paddle to prevent sinking
                ball.y = paddle.y - ball.radius - 0.1; 

                [ball.dx, ball.dy] = ensureNonHorizontal(ball.dx, ball.dy);

                horizontal_bounce_counter = 0;
                same_height_bounces = 0;
                last_bounce_height = null;

                if (autoFollowMode) {
                    ball.y -= 2; // Extra nudge for auto-follow to prevent immediate re-collision
                }
            }
        }
    }

    handleBrickCollisions(); // This also calls ensureNonHorizontal
}

function draw() {
    ctx.fillStyle = COLOR_BLACK;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    drawPaddle();
    drawBricks();
    drawBall();
    drawScoreAndInfo();
}

function gameLoop() {
    if (!running) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        return;
    }

    update();
    draw();

    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- TOUCH CONTROLS VISIBILITY ---
function updateTouchControlsAppearance() {
    if (touchLeftEl && touchRightEl) {
        if (touchControlsAreVisible) {
            touchLeftEl.classList.remove('hidden');
            touchRightEl.classList.remove('hidden');
        } else {
            touchLeftEl.classList.add('hidden');
            touchRightEl.classList.add('hidden');
        }
    }
}

function toggleTouchControls() {
    touchControlsAreVisible = !touchControlsAreVisible;
    updateTouchControlsAppearance();
}


// --- BUTTON CONTROLS SETUP ---
function setupButtonControls() {
    const btnMoveLeft = document.getElementById('btnMoveLeft');
    const btnMoveRight = document.getElementById('btnMoveRight');
    const btnIncreaseSpeed = document.getElementById('btnIncreaseSpeed');
    const btnDecreaseSpeed = document.getElementById('btnDecreaseSpeed');
    const btnToggleAutoFollow = document.getElementById('btnToggleAutoFollow');
    const btnTeleportBall = document.getElementById('btnTeleportBall');
    const btnNewGame = document.getElementById('btnNewGame');
    const btnToggleTouch = document.getElementById('btnToggleTouch');

    if (btnMoveLeft) {
        btnMoveLeft.addEventListener('click', () => {
            if (!autoFollowMode && paddle.x > 0) {
                paddle.x = Math.max(0, paddle.x - paddle.speed * 2);
            }
        });
    }
    if (btnMoveRight) {
        btnMoveRight.addEventListener('click', () => {
            if (!autoFollowMode && paddle.x + paddle.width < SCREEN_WIDTH) {
                 paddle.x = Math.min(SCREEN_WIDTH - paddle.width, paddle.x + paddle.speed * 2);
            }
        });
    }

    if (btnIncreaseSpeed) {
        btnIncreaseSpeed.addEventListener('click', () => {
            ball.speed = Math.min(ball.speed + 0.1, MAX_BALL_SPEED);
            updateBallSpeedComponents();
            paddle.speed = PADDLE_SPEED_RATIO * ball.speed;
            if (paddle.speed < 3) paddle.speed = 3;
        });
    }
    if (btnDecreaseSpeed) {
        btnDecreaseSpeed.addEventListener('click', () => {
            ball.speed = Math.max(ball.speed - 0.1, DEFAULT_BALL_SPEED * 0.5);
            updateBallSpeedComponents();
            paddle.speed = PADDLE_SPEED_RATIO * ball.speed;
            if (paddle.speed < 3) paddle.speed = 3;
        });
    }
    if (btnToggleAutoFollow) {
        btnToggleAutoFollow.addEventListener('click', toggleAutoFollow);
    }
    if (btnTeleportBall) {
        btnTeleportBall.addEventListener('click', () => {
            const teleportResult = teleportBallToPaddle();
            ball.dx = teleportResult[0];
            ball.dy = teleportResult[1];
        });
    }
    if (btnNewGame) {
        btnNewGame.addEventListener('click', () => {
            resetGame(true, ball.speed);
        });
    }
    if (btnToggleTouch) {
        btnToggleTouch.addEventListener('click', toggleTouchControls);
    }
}

// --- TOUCH CONTROLS SETUP ---
function setupTouchControls() {
    touchLeftEl = document.getElementById('touchControlLeft');
    touchRightEl = document.getElementById('touchControlRight');

    updateTouchControlsAppearance();

    if (!touchLeftEl || !touchRightEl) return;

    const handleTouchStart = (direction) => {
        if (!autoFollowMode) {
            paddleMoveDirectionTouch = direction;
        }
    };

    const handleTouchEnd = () => {
        paddleMoveDirectionTouch = 0;
    };

    touchLeftEl.addEventListener('mousedown', (e) => { e.preventDefault(); handleTouchStart(-1); });
    touchLeftEl.addEventListener('mouseup', (e) => { e.preventDefault(); handleTouchEnd(); });
    touchLeftEl.addEventListener('mouseleave', (e) => { e.preventDefault(); handleTouchEnd(); });
    touchLeftEl.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouchStart(-1); }, { passive: false });
    touchLeftEl.addEventListener('touchend', (e) => { e.preventDefault(); handleTouchEnd(); }, { passive: false });
    touchLeftEl.addEventListener('touchcancel', (e) => { e.preventDefault(); handleTouchEnd(); }, { passive: false });

    touchRightEl.addEventListener('mousedown', (e) => { e.preventDefault(); handleTouchStart(1); });
    touchRightEl.addEventListener('mouseup', (e) => { e.preventDefault(); handleTouchEnd(); });
    touchRightEl.addEventListener('mouseleave', (e) => { e.preventDefault(); handleTouchEnd(); });
    touchRightEl.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouchStart(1); }, { passive: false });
    touchRightEl.addEventListener('touchend', (e) => { e.preventDefault(); handleTouchEnd(); }, { passive: false });
    touchRightEl.addEventListener('touchcancel', (e) => { e.preventDefault(); handleTouchEnd(); }, { passive: false });
}


// --- INITIALIZE AND START GAME ---
document.addEventListener('DOMContentLoaded', () => {
    resetGame();

    setupButtonControls();
    setupTouchControls();

    canvas.addEventListener('mousemove', handleMouseMove);
});
