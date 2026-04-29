const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const playerSpriteSheet = new Image();
playerSpriteSheet.src = '../assets/sprites/knight.png';

const playerSpriteGridCols = 8;
const playerSpriteGridRows = 8;
const playerSpriteFallbackTileSize = 32;

function getPlayerSpriteTileSize() {
    if (playerSpriteSheet.complete && playerSpriteSheet.naturalWidth > 0 && playerSpriteSheet.naturalHeight > 0) {
        return Math.floor(Math.min(
            playerSpriteSheet.naturalWidth / playerSpriteGridCols,
            playerSpriteSheet.naturalHeight / playerSpriteGridRows
        ));
    }
    return playerSpriteFallbackTileSize;
}

function buildFrameList(specs) {
    const frames = [];
    for (const spec of specs) {
        if (spec.cols) {
            for (const col of spec.cols) {
                frames.push({ row: spec.row, col });
            }
        } else {
            const step = spec.startCol <= spec.endCol ? 1 : -1;
            for (let col = spec.startCol; step > 0 ? col <= spec.endCol : col >= spec.endCol; col += step) {
                frames.push({ row: spec.row, col });
            }
        }
    }
    return frames;
}

const playerSpriteAnimations = {
    // 0-based mapping from user-provided 1-based sheet notes.
    idle: {
        frames: buildFrameList([{ row: 0, cols: [0, 1, 2] }]),
        frameHold: 10
    },
    run: {
        frames: buildFrameList([
            { row: 2, startCol: 0, endCol: 7 },
            { row: 3, startCol: 0, endCol: 7 }
        ]),
        frameHold: 5
    },
    jump: {
        frames: buildFrameList([{ row: 2, startCol: 1, endCol: 4 }]),
        frameHold: 8
    },
    dash: {
        frames: buildFrameList([{ row: 5, startCol: 0, endCol: 7 }]),
        frameHold: 3
    },
    hit: {
        frames: buildFrameList([{ row: 6, startCol: 0, endCol: 4 }]),
        frameHold: 8
    },
    death: {
        frames: buildFrameList([{ row: 7, startCol: 0, endCol: 4 }]),
        frameHold: 10
    }
};

function getAnimationDurationFrames(name, loops = 1) {
    const clip = playerSpriteAnimations[name];
    if (!clip) return 1;
    return Math.max(1, clip.frames.length * clip.frameHold * loops);
}

const playerActionTimings = {
    dashDuration: getAnimationDurationFrames('dash'),
    hitDuration: getAnimationDurationFrames('hit'),
    deathDuration: getAnimationDurationFrames('death')
};

// Track current animation to avoid flickering
let currentPlayerAnimation = 'idle';
let playerAnimationFrame = 0;
let playerAnimationTick = 0;

function getPlayerSpriteFrame(animationName) {
    const clip = playerSpriteAnimations[animationName] || playerSpriteAnimations.idle;
    const totalFrames = Math.max(1, clip.frames.length);

    if (currentPlayerAnimation !== animationName) {
        currentPlayerAnimation = animationName;
        playerAnimationFrame = 0;
        playerAnimationTick = 0;
    } else {
        playerAnimationTick++;
        if (playerAnimationTick >= clip.frameHold) {
            playerAnimationTick = 0;
            playerAnimationFrame = (playerAnimationFrame + 1) % totalFrames;
        }
    }

    const frame = clip.frames[playerAnimationFrame] || { row: 0, col: 0 };
    const tileSize = getPlayerSpriteTileSize();

    return {
        sx: frame.col * tileSize,
        sy: frame.row * tileSize,
        sw: tileSize,
        sh: tileSize
    };
}

// Function to determine which animation should be played
function getPlayerAnimation() {
    // Death has highest priority
    if (deathFreezeTimer > 0) {
        return 'death';
    }
    
    // Getting hit
    if (player.immunity > 0 && player.immunitySource !== 'dash') {
        return 'hit';
    }
    
    // Dashing
    if (player.dashing) {
        return 'dash';
    }
    
    // In air (jumping/falling)
    if (!player.onGround) {
        return 'jump';
    }
    
    // Moving
    if (Math.abs(player.velocityX) > 0.5) {
        return 'run';
    }
    
    // Idle
    return 'idle';
}

// Player object
const player = {
    x: 100,
    y: 500,
    width: 50,
    height: 50,
    velocityX: 0,
    velocityY: 0,
    speed: 8,
    jumpPower: -18,
    gravity: 0.8,
    onGround: false,
    health: 3,
    immunity: 0,
    immunitySource: null,
    facing: 1,
    dashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    dashTargetX: 0,
    dashTargetY: 0,
    dashVelocityX: 0,
    dashVelocityY: 0,
    attackState: null,
    attackTimer: 0,
    attackEffect: null,
    heavyCooldown: 0,
    specialCooldown: 0,
    specialCooldownMax: 360,
    points: 0,
    style: 0,
    lastAttackType: null,
    kills: 0
};

// Camera
let cameraX = 0;
let deathFreezeTimer = 0;
const deathFreezeDuration = playerActionTimings.deathDuration;

// Game state
let gameState = 'title'; // 'title', 'playing', 'gameOver'

// Message system
let messages = [
    { text: "hi. hello. hi.", duration: 300 }, // frames
    { text: "is this reaching you?", duration: 300 }
];
let currentMessageIndex = -1;
let messageTypingIndex = 0;
let messageTimer = 0;
let messageActive = false;
let killThresholds = [10, 20, 30, 40];
let nextKillThresholdIndex = 0;
let killThresholdMessageActive = false;
let killThresholdMessagePhase = 0;
let killThresholdMessageIndex = -1;
let killThresholdMessageTypingIndex = 0;
const killThresholdMessageParts = [
    ['getting there.', 'keep going'],
    ['c\'mon.', 'can\'t stop now.'],
    ['so close.', 'i can feel it.'],
    ['we\'re here']
];
let killThresholdMessageTimer = 0;
let killThresholdMessageDuration = 0;

// Platforms and enemies
let platforms = [];
let enemies = [];
let projectiles = [];
let healthPacks = [];

// Keys
const keys = {
    left: false,
    right: false,
    jump: false,
    down: false,
    shift: false,
    up: false,
    j: false,
    k: false,
    l: false,
    e: false
};

// Event listeners
document.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = true;
            break;
        case 'ArrowUp':
        case 'KeyW':
            keys.up = true;
            break;
        case 'Space':
            keys.jump = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = true;
            break;
        case 'ControlLeft':
            keys.ctrl = true;
            break;
        case 'ShiftLeft':
            keys.shift = true;
            break;
        case 'KeyQ':
            keys.q = true;
            break;
        case 'KeyJ':
            keys.j = true;
            break;
        case 'KeyK':
            if (!e.repeat) startPlayerAttack('light');
            keys.k = true;
            break;
        case 'KeyL':
            if (!e.repeat) startPlayerAttack('heavy');
            keys.l = true;
            break;
        case 'KeyE':
            if (!e.repeat) startPlayerAttack('special');
            keys.e = true;
            break;
        case 'KeyR':
            if (gameState === 'gameOver') reset();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = false;
            break;
        case 'ArrowUp':
        case 'KeyW':
            keys.up = false;
            break;
        case 'Space':
            keys.jump = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = false;
            break;
        case 'ControlLeft':
            keys.ctrl = false;
            break;
        case 'ShiftLeft':
            keys.shift = false;
            break;
        case 'KeyQ':
            keys.q = false;
            break;
        case 'KeyJ':
            keys.j = false;
            break;
        case 'KeyK':
            keys.k = false;
            break;
        case 'KeyL':
            keys.l = false;
            break;
        case 'KeyE':
            keys.e = false;
            break;
    }
});

// Mouse event listener for buttons
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (gameState === 'title') {
        // Play button: centered, below title
        const playX = canvas.width / 2 - 50;
        const playY = canvas.height / 2 + 50;
        const playWidth = 100;
        const playHeight = 40;
        if (x >= playX && x <= playX + playWidth && y >= playY && y <= playY + playHeight) {
            startGame();
        }
        // Quit button: below play
        const quitX = canvas.width / 2 - 50;
        const quitY = canvas.height / 2 + 110;
        const quitWidth = 100;
        const quitHeight = 40;
        if (x >= quitX && x <= quitX + quitWidth && y >= quitY && y <= quitY + quitHeight) {
            if (confirm('Are you sure you want to quit?')) {
                window.close();
            }
        }
    } else if (gameState === 'gameOver') {
        // Restart button
        const restartX = canvas.width / 2 - 50;
        const restartY = canvas.height / 2 + 50;
        const restartWidth = 100;
        const restartHeight = 40;
        if (x >= restartX && x <= restartX + restartWidth && y >= restartY && y <= restartY + restartHeight) {
            reset();
        }
        // Title button
        const titleX = canvas.width / 2 - 50;
        const titleY = canvas.height / 2 + 110;
        const titleWidth = 100;
        const titleHeight = 40;
        if (x >= titleX && x <= titleX + titleWidth && y >= titleY && y <= titleY + titleHeight) {
            gameState = 'title';
        }
        // Quit button
        const quitX = canvas.width / 2 - 50;
        const quitY = canvas.height / 2 + 170;
        const quitWidth = 100;
        const quitHeight = 40;
        if (x >= quitX && x <= quitX + quitWidth && y >= quitY && y <= quitY + quitHeight) {
            if (confirm('Are you sure you want to quit?')) {
                window.close();
            }
        }
    }
});

// Collision detection
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Generate platform
function generatePlatform(x) {
    const y = Math.random() * 200 + 300; // Random y between 300-500
    const width = Math.random() * 100 + 100; // 100-200
    const height = 20;
    platforms.push({ x, y, width, height });

    // Rare chance to generate a health pack
    if (Math.random() < 0.05) {
        healthPacks.push({ x: x + Math.random() * (width - 20), y: y - 20, width: 20, height: 20 });
    }
}

// Generate enemy
function generateEnemy(x, y, type = 'melee', onFloor = false) {
    const size = 40;
    const onPlatform = !onFloor;
    const startY = onPlatform ? y - size : y - size;
    const health = type === 'melee' ? 2 : 1;
    const speed = type === 'melee' ? 2.5 : 0;
    const attackCooldown = 0;
    const shootCooldown = type === 'ranged' ? 90 : 0;
    enemies.push({
        x: x + Math.random() * 100,
        y: startY,
        width: size,
        height: size,
        health,
        speed,
        direction: 1,
        facing: 1,
        type,
        attacking: false,
        attackState: null,
        attackTimer: 0,
        velocityY: 0,
        gravity: 0.8,
        jumpPower: -15,
        onGround: false,
        onPlatform,
        attackCooldown,
        shootCooldown,
        damageFlash: 0,
        deathTimer: 0
    });
}

function spawnProjectile(x, y, vx, vy) {
    projectiles.push({ x, y, vx, vy, width: 20, height: 20, life: 120 });
}

function getPlayerInvincibilityColor() {
    if (player.immunitySource === 'dash' || player.immunitySource === 'special') {
        return '#A020F0';
    }
    if (player.immunitySource === 'damage') {
        return '#8B0000';
    }
    return '#FFFF00';
}

function resolveCharacterEnemyCollision(enemy) {
    if (player.dashing || enemy.health <= 0 || !checkCollision(player, enemy)) return;

    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const enemyCenterX = enemy.x + enemy.width / 2;
    const enemyCenterY = enemy.y + enemy.height / 2;
    const overlapX = player.width / 2 + enemy.width / 2 - Math.abs(playerCenterX - enemyCenterX);
    const overlapY = player.height / 2 + enemy.height / 2 - Math.abs(playerCenterY - enemyCenterY);

    if (overlapX <= 0 || overlapY <= 0) return;

    if (overlapX < overlapY) {
        const playerPushRatio = enemy.type === 'melee' ? 0.75 : 0.5;
        const enemyPushRatio = 1 - playerPushRatio;
        const playerPush = overlapX * playerPushRatio;
        const enemyPush = overlapX * enemyPushRatio;
        if (playerCenterX < enemyCenterX) {
            player.x -= playerPush;
            enemy.x += enemyPush;
        } else {
            player.x += playerPush;
            enemy.x -= enemyPush;
        }
        player.velocityX = 0;
        enemy.velocityX = 0;
    } else {
        const playerPushRatio = enemy.type === 'melee' ? 0.75 : 0.5;
        const enemyPushRatio = 1 - playerPushRatio;
        const playerPush = overlapY * playerPushRatio;
        const enemyPush = overlapY * enemyPushRatio;
        if (playerCenterY < enemyCenterY) {
            player.y -= playerPush;
            enemy.y += enemyPush;
            player.velocityY = 0;
            player.onGround = true;
        } else {
            player.y += playerPush;
            enemy.y -= enemyPush;
            if (player.velocityY < 0) {
                player.velocityY = 0;
            }
        }
        enemy.velocityY = Math.max(0, enemy.velocityY);
    }

    player.x = Math.max(cameraX, player.x);
}

function triggerPlayerDeath() {
    if (deathFreezeTimer > 0) return;

    deathFreezeTimer = deathFreezeDuration;
    player.velocityX = 0;
    player.velocityY = 0;
    player.immunitySource = null;
    player.dashing = false;
    player.dashTimer = 0;
    player.dashVelocityX = 0;
    player.dashVelocityY = 0;
    player.attackState = null;
    player.attackTimer = 0;
    player.attackEffect = null;
}

function applyPlayerAttack(type) {
    let damage = 0;
    let attackBox = null;
    let radius = 0;
    if (type === 'light') {
        damage = 1;
        if (keys.up) {
            attackBox = {
                x: player.x - 20,
                y: player.y - 50,
                width: player.width + 40,
                height: 50
            };
        } else if (keys.down) {
            attackBox = {
                x: player.x - 20,
                y: player.y + player.height,
                width: player.width + 40,
                height: 50
            };
        } else {
            const attackWidth = 50;
            attackBox = {
                x: player.x + (player.facing === 1 ? player.width : -attackWidth),
                y: player.y - 20,
                width: attackWidth,
                height: player.height + 40
            };
        }
    } else if (type === 'heavy') {
        damage = 2;
        if (keys.up) {
            attackBox = {
                x: player.x - 20,
                y: player.y - 70,
                width: player.width + 40,
                height: 70
            };
        } else if (keys.down) {
            attackBox = {
                x: player.x - 20,
                y: player.y + player.height,
                width: player.width + 40,
                height: 70
            };
        } else {
            const attackWidth = 70;
            attackBox = {
                x: player.x + (player.facing === 1 ? player.width : -attackWidth),
                y: player.y - 20,
                width: attackWidth,
                height: player.height + 40
            };
        }
    } else if (type === 'special') {
        damage = 2;
        radius = 120;
    }

    for (let e of enemies) {
        if (e.health <= 0) continue;
        let hit = false;
        if (attackBox) {
            hit = checkCollision(attackBox, e);
        } else {
            const cx = player.x + player.width / 2;
            const cy = player.y + player.height / 2;
            const ex = e.x + e.width / 2;
            const ey = e.y + e.height / 2;
            const dist = Math.hypot(cx - ex, cy - ey);
            hit = dist <= radius;
        }
        if (hit) {
            e.health -= damage;
            e.damageFlash = 16; // Flash white for 16 frames
            if (e.health <= 0) {
                if (e.deathTimer <= 0) {
                    e.deathTimer = 12;
                }
                player.kills++;
                if (nextKillThresholdIndex < killThresholds.length && player.kills === killThresholds[nextKillThresholdIndex]) {
                    killThresholdMessageIndex = nextKillThresholdIndex;
                    killThresholdMessagePhase = 0;
                    killThresholdMessageTypingIndex = 0;
                    killThresholdMessageDuration = messages[0].duration;
                    killThresholdMessageTimer = 0;
                    killThresholdMessageActive = true;
                    nextKillThresholdIndex++;
                }
                player.points += 10;
                player.style = Math.min(100, player.style + (player.lastAttackType === type ? 5 : 10));
                player.lastAttackType = type;
            }
        }
    }
}

function startPlayerAttack(type) {
    if (deathFreezeTimer > 0) return;
    if (player.attackState) return;
    if (type === 'heavy' && player.heavyCooldown > 0) return;
    if (type === 'special' && player.specialCooldown > 0) return;

    let direction = 'horizontal';
    if (keys.up) direction = 'up';
    else if (keys.down) direction = 'down';

    if (type === 'light') {
        player.attackState = 'light';
        player.attackTimer = 18;
        player.attackEffect = { type: 'light', duration: 18, direction };
        applyPlayerAttack('light');
    } else if (type === 'heavy') {
        player.attackState = 'heavy';
        player.attackTimer = 24;
        player.attackEffect = { type: 'heavy', duration: 24, direction };
        player.heavyCooldown = 24;
        applyPlayerAttack('heavy');
    } else if (type === 'special') {
        player.attackState = 'special';
        player.attackTimer = 28;
        player.attackEffect = { type: 'special', duration: 28 };
        player.specialCooldown = player.specialCooldownMax;
        player.immunity = player.attackTimer; // Invincible for the duration of the special
        player.immunitySource = 'special';
        applyPlayerAttack('special');
    }
}

// Update function
function update() {
    if (gameState !== 'playing') return;

    if (deathFreezeTimer > 0) {
        deathFreezeTimer--;
        if (deathFreezeTimer <= 0) {
            gameState = 'gameOver';
        }
        return;
    }

    // Handle message typing
    if (messageActive) {
        if (messageTypingIndex < messages[currentMessageIndex].text.length) {
            messageTypingIndex++;
        } else {
            messageTimer++;
            if (messageTimer >= messages[currentMessageIndex].duration) {
                currentMessageIndex++;
                if (currentMessageIndex < messages.length) {
                    messageTypingIndex = 0;
                    messageTimer = 0;
                } else {
                    messageActive = false;
                    currentMessageIndex = -1;
                }
            }
        }
    }
    if (killThresholdMessageActive) {
        const parts = killThresholdMessageParts[killThresholdMessageIndex] || [];
        const currentText = parts[killThresholdMessagePhase] || '';
        if (killThresholdMessageTypingIndex < currentText.length) {
            killThresholdMessageTypingIndex++;
        } else {
            killThresholdMessageTimer++;
            if (killThresholdMessageTimer >= killThresholdMessageDuration) {
                if (killThresholdMessagePhase === 0 && parts.length > 1) {
                    killThresholdMessagePhase = 1;
                    killThresholdMessageTypingIndex = 0;
                    killThresholdMessageTimer = 0;
                } else {
                    killThresholdMessageActive = false;
                    killThresholdMessageIndex = -1;
                }
            }
        }
    }

    if (player.attackState === 'special') {
        player.velocityX = 0;
        player.velocityY = 0;
        player.immunity = Math.max(player.immunity, 1);
    } else {
        // Horizontal movement
        let currentSpeed = player.speed;
        if (keys.left) {
            player.velocityX = -currentSpeed;
            player.facing = -1;
        } else if (keys.right) {
            player.velocityX = currentSpeed;
            player.facing = 1;
        } else {
            // Ease to stop
            player.velocityX *= 0.8;
        }

        // Dashing
        if (keys.j && player.dashCooldown == 0 && !player.dashing) {
            player.dashing = true;
            player.dashTimer = playerActionTimings.dashDuration;
            player.immunity = playerActionTimings.dashDuration; // Temporary immunity during dash
            player.immunitySource = 'dash';
            let xDir = 0;
            let yDir = 0;
            if (keys.right) xDir += 1;
            if (keys.left) xDir -= 1;
            if (keys.jump) yDir -= 1;
            if (keys.up) yDir -= 1;
            if (keys.down) yDir += 1;
            if (xDir === 0 && yDir === 0) {
                xDir = 1; // Default to right
            }
            let dashStrength = 15;
            const directVertical = xDir === 0 && yDir !== 0;
            if (directVertical) {
                dashStrength += 8;
            }
            if (keys.left || keys.right) {
                dashStrength += 10;
            }
            const length = Math.sqrt(xDir * xDir + yDir * yDir);
            if (length > 0) {
                player.dashTargetX = (xDir / length) * dashStrength;
                player.dashTargetY = (yDir / length) * dashStrength;
            } else {
                player.dashTargetX = dashStrength;
                player.dashTargetY = 0;
            }
            player.dashVelocityX = player.dashTargetX;
            player.dashVelocityY = player.dashTargetY;
            player.dashCooldown = 40;
        }
    }
    if (player.dashing) {
        // Strong initial dash, then ease out at the end
        player.velocityX = player.dashVelocityX;
        player.velocityY = player.dashVelocityY;
        if (player.dashTimer <= 4) {
            player.dashVelocityX *= 0.86;
            player.dashVelocityY *= 0.86;
        }
        player.dashTimer--;
        if (player.dashTimer <= 0) {
            player.dashing = false;
            player.dashTargetX = 0;
            player.dashTargetY = 0;
            player.dashVelocityX = 0;
            player.dashVelocityY = 0;
        }
    }
    if (player.dashCooldown > 0) {
        player.dashCooldown--;
    }

    // Jumping
    if (!player.dashing && player.attackState !== 'special') {
        if (keys.jump && player.onGround) {
            player.velocityY = player.jumpPower;
            player.onGround = false;
            if (keys.ctrl) {
                player.velocityX += player.facing * 3;
            }
        }

        // Apply gravity
        player.velocityY += player.gravity;

        // Faster fall if down pressed
        if (keys.down) {
            player.velocityY += 0.8;
        }
    }

    // Update position
    player.x += player.velocityX;
    player.y += player.velocityY;
    player.x = Math.max(cameraX, player.x);

    // Update immunity
    if (player.immunity > 0) {
        player.immunity--;
        if (player.immunity <= 0) {
            player.immunitySource = null;
        }
    }

    // Update cooldowns
    if (player.heavyCooldown > 0) player.heavyCooldown--;
    if (player.specialCooldown > 0) player.specialCooldown--;
    if (player.attackTimer > 0) {
        player.attackTimer--;
        if (player.attackTimer <= 0) {
            player.attackState = null;
            player.attackEffect = null;
        }
    }

    // Update style decay
    if (player.style > 0) {
        player.style = Math.max(0, player.style - 0.05);
    }

    // Update camera
    cameraX = Math.max(cameraX, player.x - canvas.width / 2, 0);

    // Generate platforms
    while (platforms.length === 0 || platforms[platforms.length - 1].x < cameraX + canvas.width + 200) {
        const lastX = platforms.length > 0 ? platforms[platforms.length - 1].x + platforms[platforms.length - 1].width + Math.random() * 100 + 20 : 0;
        generatePlatform(lastX);
        // Chance to generate a platform enemy
        if (Math.random() < 0.6) {
            const type = Math.random() < 0.5 ? 'melee' : 'ranged';
            generateEnemy(lastX, platforms[platforms.length - 1].y, type, false);
        }
        // Chance to generate a melee floor enemy
        if (Math.random() < 0.2) {
            generateEnemy(lastX, canvas.height - 20, 'melee', true);
        }
    }

    // Remove off-screen platforms
    platforms = platforms.filter(p => p.x + p.width > cameraX - 100);

    // Remove off-screen or dead enemies after death flash is finished
    enemies = enemies.filter(e => (e.health > 0 || e.deathTimer > 0) && e.x + e.width > cameraX - 100 && e.y < canvas.height + 100);

    // Remove off-screen health packs
    healthPacks = healthPacks.filter(pack => pack.x + pack.width > cameraX - 100);

    // Update projectiles
    for (let p of projectiles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (checkCollision(p, player) && player.immunity == 0) {
            player.health--;
            player.style = Math.max(0, player.style - 10);
            player.immunity = playerActionTimings.hitDuration;
            player.immunitySource = 'damage';
            p.life = 0;
            if (player.health <= 0) {
                triggerPlayerDeath();
            }
        }
    }
    projectiles = projectiles.filter(p => p.life > 0 && p.x + p.width > cameraX - 100 && p.x < cameraX + canvas.width + 100 && p.y < canvas.height + 100);

    // Platform collisions
    player.onGround = false;
    const passThroughPlatform = keys.down || (player.dashing && player.dashTargetY > 0);
    for (let p of platforms) {
        if (checkCollision(player, p) && !passThroughPlatform) {
            if (player.velocityY > 0 && player.y < p.y) {
                player.y = p.y - player.height;
                player.velocityY = 0;
                player.onGround = true;
            }
        }
    }

    for (let e of enemies) {
        resolveCharacterEnemyCollision(e);
    }

    // Health pack collisions
    healthPacks = healthPacks.filter(pack => {
        if (checkCollision(player, pack)) {
            player.health = Math.min(3, player.health + 1);
            return false; // Remove the pack
        }
        return true;
    });

    // Enemy collisions
    for (let e of enemies) {
        if (e.type === 'melee' && e.attackState === 'attack' && checkCollision(player, e) && player.immunity == 0) {
            const attackDirectionMatch = (player.x >= e.x && e.facing === 1) || (player.x < e.x && e.facing === -1);
            if (attackDirectionMatch) {
                player.health--;
                player.style = Math.max(0, player.style - 10);
                player.immunity = playerActionTimings.hitDuration;
                player.immunitySource = 'damage';
                e.attackCooldown = 60;
                e.attackState = null;
                e.attacking = false;
                if (player.health <= 0) {
                    triggerPlayerDeath();
                }
                e.x += 50;
            }
        }
    }

    // Update enemies
    for (let e of enemies) {
        // Handle dead enemies during their flash timer
        if (e.health <= 0) {
            if (e.deathTimer > 0) {
                e.deathTimer--;
            }
            if (e.damageFlash > 0) {
                e.damageFlash--;
            }
            continue;
        }

        // Apply gravity
        e.velocityY += e.gravity;
        e.y += e.velocityY;

        // Platform collisions
        e.onGround = false;
        for (let p of platforms) {
            if (checkCollision(e, p) && e.velocityY > 0 && e.y < p.y) {
                e.y = p.y - e.height;
                e.velocityY = 0;
                e.onGround = true;
                e.onPlatform = true;
            }
        }

        // Floor collision
        if (e.y + e.height >= canvas.height - 20) {
            e.y = canvas.height - 20 - e.height;
            e.velocityY = 0;
            e.onGround = true;
            e.onPlatform = false;
        }

        if (e.attackCooldown > 0) {
            e.attackCooldown--;
        }
        if (e.shootCooldown > 0) {
            e.shootCooldown--;
        }
        if (e.damageFlash > 0) {
            e.damageFlash--;
        }

        if (e.type === 'melee') {
            let distX = player.x - e.x;
            let distY = player.y - e.y;
            let dist = Math.hypot(distX, distY);
            let playerOnRight = distX >= 0;
            let canAttack = Math.abs(distY) < 80 && Math.abs(distX) < 200;

            if (e.attackCooldown <= 0 && !e.attackState && canAttack) {
                e.attackState = 'windup';
                e.attackTimer = 18;
                e.velocityX = 0;
                e.attacking = true;
                e.facing = playerOnRight ? 1 : -1;
                e.direction = e.facing;
            }

            if (e.attackState === 'windup') {
                e.velocityX = 0;
                if (e.attackTimer <= 0) {
                    e.attackState = 'attack';
                    e.attackTimer = 8;
                }
            }

            if (e.attackState === 'attack') {
                e.attacking = true;
                if (e.attackTimer <= 0) {
                    e.attackState = null;
                    e.attackCooldown = 60;
                    e.attacking = false;
                }
            }

            if (e.attackState && e.attackTimer > 0) {
                e.attackTimer--;
            }

            if (!e.attackState) {
                if (dist < 200) {
                    if (e.x < player.x) {
                        e.x += e.speed;
                    } else {
                        e.x -= e.speed;
                    }
                    if (e.onGround && Math.random() < 0.01) {
                        e.velocityY = e.jumpPower;
                        e.onGround = false;
                    }
                    e.attacking = false;
                } else if (e.onPlatform) {
                    e.x += e.direction * e.speed;
                    let plat = platforms.find(p => e.x >= p.x && e.x + e.width <= p.x + p.width && Math.abs((e.y + e.height) - p.y) < 5);
                    if (!plat || e.x < plat.x || e.x + e.width > plat.x + plat.width) {
                        e.direction *= -1;
                        e.facing = e.direction;
                    }
                    e.attacking = false;
                } else {
                    if (e.x < player.x) {
                        e.x += e.speed;
                    } else {
                        e.x -= e.speed;
                    }
                    e.attacking = false;
                }
            }
        } else if (e.type === 'ranged') {
            // Ranged enemies stay put and shoot
            const rangeX = Math.abs(player.x - e.x);
            const rangeY = Math.abs(player.y - e.y);
            if (rangeX < 250 && rangeY < 200 && e.shootCooldown <= 0) {
                const dx = player.x - e.x;
                const dy = player.y - e.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0) {
                    const speed = 4;
                    spawnProjectile(e.x + e.width / 2, e.y + e.height / 2, (dx / len) * speed, (dy / len) * speed);
                    e.shootCooldown = 90;
                }
            }
        }

        resolveCharacterEnemyCollision(e);
    }

    // Update projectiles
    if (player.y + player.height >= canvas.height - 20) {
        player.y = canvas.height - 20 - player.height;
        player.velocityY = 0;
        player.onGround = true;
    }
}

// Draw function
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'title') {
        // Draw title screen background
        ctx.fillStyle = '#FFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw title screen
        ctx.fillStyle = '#000';
        ctx.font = '50px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Metal May Cry', canvas.width / 2, canvas.height / 2 - 50);
        ctx.textAlign = 'left';

        // Play button
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(canvas.width / 2 - 50, canvas.height / 2 + 50, 100, 40);
        ctx.fillStyle = '#FFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Play', canvas.width / 2, canvas.height / 2 + 75);
        ctx.textAlign = 'left';

        // Quit button
        ctx.fillStyle = '#F44336';
        ctx.fillRect(canvas.width / 2 - 50, canvas.height / 2 + 110, 100, 40);
        ctx.fillStyle = '#FFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Quit', canvas.width / 2, canvas.height / 2 + 135);
        ctx.textAlign = 'left';
    } else if (gameState === 'playing') {
        const deathFreezeRatio = deathFreezeTimer / deathFreezeDuration;
        const shakeStrength = deathFreezeTimer > 0 ? Math.max(2, Math.ceil(deathFreezeRatio * 10)) : 0;
        const shakeX = shakeStrength > 0 ? (Math.random() * 2 - 1) * shakeStrength : 0;
        const shakeY = shakeStrength > 0 ? (Math.random() * 2 - 1) * shakeStrength : 0;

        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Save context for camera
        ctx.save();
        ctx.translate(-cameraX, 0);

        // Draw platforms
        ctx.fillStyle = '#8B4513';
        for (let p of platforms) {
            ctx.fillRect(p.x, p.y, p.width, p.height);
        }

        // Draw health packs
        ctx.fillStyle = '#FF69B4'; // Pink
        for (let pack of healthPacks) {
            ctx.fillRect(pack.x, pack.y, pack.width, pack.height);
        }

        // Draw floor
        ctx.fillStyle = '#654321';
        ctx.fillRect(cameraX, canvas.height - 20, canvas.width, 20);

        // Draw enemies
        for (let e of enemies) {
            if (e.damageFlash > 0) {
                ctx.fillStyle = '#FFFFFF'; // Flash white when damaged
            } else if (e.type === 'melee') {
                ctx.fillStyle = '#FF4500'; // melee enemies are orange-red
            } else if (e.type === 'ranged') {
                ctx.fillStyle = '#3399FF'; // ranged enemies are blue
            } else {
                ctx.fillStyle = '#00FF00';
            }
            ctx.fillRect(e.x, e.y, e.width, e.height);

            if (e.type === 'melee' && e.attacking) {
                ctx.strokeStyle = '#FFFF00';
                ctx.lineWidth = 3;
                ctx.strokeRect(e.x - 2, e.y - 2, e.width + 4, e.height + 4);

                const attackWidth = 30;
                const attackX = e.x + (e.facing === 1 ? e.width : -attackWidth);
                ctx.fillStyle = 'rgba(255, 255, 0, 0.35)';
                ctx.fillRect(attackX, e.y + 8, attackWidth, e.height - 16);
            }
        }

        // Draw player attack visuals
        if (player.attackEffect) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            if (player.attackEffect.type === 'light') {
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 4;
                if (player.attackEffect.direction === 'up') {
                    ctx.strokeRect(player.x - 20, player.y - 50, player.width + 40, 50);
                } else if (player.attackEffect.direction === 'down') {
                    ctx.strokeRect(player.x - 20, player.y + player.height, player.width + 40, 50);
                } else {
                    const x = player.x + (player.facing === 1 ? player.width : -50);
                    ctx.strokeRect(x, player.y - 20, 50, player.height + 40);
                }
            } else if (player.attackEffect.type === 'heavy') {
                ctx.strokeStyle = '#FF8C00';
                ctx.lineWidth = 4;
                if (player.attackEffect.direction === 'up') {
                    ctx.strokeRect(player.x - 20, player.y - 70, player.width + 40, 70);
                } else if (player.attackEffect.direction === 'down') {
                    ctx.strokeRect(player.x - 20, player.y + player.height, player.width + 40, 70);
                } else {
                    const x = player.x + (player.facing === 1 ? player.width : -70);
                    ctx.strokeRect(x, player.y - 20, 70, player.height + 40);
                }
            } else if (player.attackEffect.type === 'special') {
                ctx.strokeStyle = '#7CFC00';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 120, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Draw projectiles
        ctx.fillStyle = '#FF00FF';
        for (let p of projectiles) {
            ctx.fillRect(p.x, p.y, p.width, p.height);
        }

        // Draw player
        const playerAnimationName = getPlayerAnimation();
        const frame = getPlayerSpriteFrame(playerAnimationName);
        
        // Draw the animation with proper scaling and mirroring
        ctx.save();
        
        if (playerSpriteSheet.complete && playerSpriteSheet.naturalWidth > 0) {
            const previousSmoothing = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = false;

            // Apply horizontal flip based on facing direction
            if (player.facing === -1) {
                ctx.scale(-1, 1);
                ctx.drawImage(
                    playerSpriteSheet,
                    frame.sx,
                    frame.sy,
                    frame.sw,
                    frame.sh,
                    -player.x - player.width,
                    player.y,
                    player.width,
                    player.height
                );
            } else {
                ctx.drawImage(
                    playerSpriteSheet,
                    frame.sx,
                    frame.sy,
                    frame.sw,
                    frame.sh,
                    player.x,
                    player.y,
                    player.width,
                    player.height
                );
            }

            ctx.imageSmoothingEnabled = previousSmoothing;
        } else {
            // Fallback while images are loading or if a file path is invalid
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(player.x, player.y, player.width, player.height);
        }
        
        ctx.restore();

        // Restore context
        ctx.restore();

        // Draw UI
        ctx.fillStyle = '#000';
        ctx.font = '20px Arial';
        ctx.fillText(`Health: ${player.health}`, 10, 30);
        ctx.fillText(`Kills: ${player.kills}`, 10, 120);

        // Style bar UI
        const styleWidth = 160;
        const styleHeight = 18;
        const styleX = 10;
        const styleY = 60;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(styleX, styleY, styleWidth, styleHeight);
        const styleRatio = player.style / 100;
        ctx.fillStyle = '#FFD700'; // Gold color for style
        ctx.fillRect(styleX + 1, styleY + 1, (styleWidth - 2) * styleRatio, styleHeight - 2);
        ctx.fillStyle = '#000';
        ctx.font = '14px Arial';
        ctx.fillText(`Style: ${Math.floor(player.style)}`, styleX + 6, styleY + 14);

        // Special attack cooldown UI (moved below)
        const cooldownWidth = 160;
        const cooldownHeight = 18;
        const cooldownX = 10;
        const cooldownY = 90;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(cooldownX, cooldownY, cooldownWidth, cooldownHeight);
        if (player.specialCooldown > 0) {
            const ratio = 1 - player.specialCooldown / player.specialCooldownMax;
            ctx.fillStyle = '#7CFC00';
            ctx.fillRect(cooldownX + 1, cooldownY + 1, Math.max(0, (cooldownWidth - 2) * ratio), cooldownHeight - 2);
            ctx.fillStyle = '#000';
            ctx.font = '14px Arial';
            ctx.fillText(`Special: ${Math.ceil(player.specialCooldown / 60)}s`, cooldownX + 6, cooldownY + 14);
        } else {
            ctx.fillStyle = '#7CFC00';
            ctx.fillRect(cooldownX + 1, cooldownY + 1, cooldownWidth - 2, cooldownHeight - 2);
            ctx.fillStyle = '#000';
            ctx.font = '14px Arial';
            ctx.fillText('Special Ready', cooldownX + 6, cooldownY + 14);
        }

        // Draw message if active
        if (messageActive && currentMessageIndex >= 0) {
            const msgX = canvas.width - 300;
            const msgY = 20;
            const msgWidth = 280;
            const msgHeight = 60;
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(msgX, msgY, msgWidth, msgHeight);
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 2;
            ctx.strokeRect(msgX, msgY, msgWidth, msgHeight);
            ctx.fillStyle = '#FFF';
            ctx.font = '16px Arial';
            const typedText = messages[currentMessageIndex].text.substring(0, messageTypingIndex);
            ctx.fillText(typedText, msgX + 10, msgY + 30);
            // Placeholder icon
            ctx.fillStyle = '#CCC';
            ctx.fillRect(msgX + msgWidth - 40, msgY + 10, 30, 40);
        }
        if (killThresholdMessageActive) {
            const msgX = canvas.width - 300;
            const msgY = messageActive && currentMessageIndex >= 0 ? 90 : 20;
            const msgWidth = 280;
            const msgHeight = 60;
            const parts = killThresholdMessageParts[killThresholdMessageIndex] || [];
            const currentText = parts[killThresholdMessagePhase] || '';
            const typedText = currentText.substring(0, killThresholdMessageTypingIndex);
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(msgX, msgY, msgWidth, msgHeight);
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 2;
            ctx.strokeRect(msgX, msgY, msgWidth, msgHeight);
            ctx.fillStyle = '#FFF';
            ctx.font = '16px Arial';
            ctx.fillText(typedText, msgX + 10, msgY + 30);
            ctx.fillStyle = '#CCC';
            ctx.fillRect(msgX + msgWidth - 40, msgY + 10, 30, 40);
        }
        if (deathFreezeTimer > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * deathFreezeRatio})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = `rgba(180, 0, 0, ${0.35 * deathFreezeRatio})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.restore();
    } else if (gameState === 'gameOver') {
        // Draw game over screen
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 50);
        ctx.font = '24px Arial';
        ctx.fillText(`Kills: ${player.kills}`, canvas.width / 2, canvas.height / 2 + 10);
        ctx.textAlign = 'left';

        // Restart button
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(canvas.width / 2 - 50, canvas.height / 2 + 50, 100, 40);
        ctx.fillStyle = '#FFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Restart', canvas.width / 2, canvas.height / 2 + 75);
        ctx.textAlign = 'left';

        // Title button
        ctx.fillStyle = '#2196F3';
        ctx.fillRect(canvas.width / 2 - 50, canvas.height / 2 + 110, 100, 40);
        ctx.fillStyle = '#FFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Title', canvas.width / 2, canvas.height / 2 + 135);
        ctx.textAlign = 'left';

        // Quit button
        ctx.fillStyle = '#F44336';
        ctx.fillRect(canvas.width / 2 - 50, canvas.height / 2 + 170, 100, 40);
        ctx.fillStyle = '#FFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Quit', canvas.width / 2, canvas.height / 2 + 195);
        ctx.textAlign = 'left';
    }
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Reset function
function reset() {
    player.x = 100;
    player.y = 500;
    player.velocityX = 0;
    player.velocityY = 0;
    player.health = 3;
    player.immunity = 0;
    player.immunitySource = null;
    player.facing = 1;
    player.dashing = false;
    player.dashTimer = 0;
    player.dashCooldown = 0;
    player.dashVelocityX = 0;
    player.dashVelocityY = 0;
    player.attackState = null;
    player.attackTimer = 0;
    player.attackEffect = null;
    player.heavyCooldown = 0;
    player.specialCooldown = 0;
    player.points = 0;
    player.style = 0;
    player.lastAttackType = null;
    player.kills = 0;
    nextKillThresholdIndex = 0;
    killThresholdMessageActive = false;
    killThresholdMessagePhase = 0;
    killThresholdMessageIndex = -1;
    killThresholdMessageTypingIndex = 0;
    killThresholdMessageTimer = 0;
    killThresholdMessageDuration = 0;
    cameraX = 0;
    deathFreezeTimer = 0;
    gameState = 'playing';
    platforms = [];
    enemies = [];
    projectiles = [];
    healthPacks = [];
    // Start message
    currentMessageIndex = 0;
    messageTypingIndex = 0;
    messageTimer = 0;
    messageActive = true;
    // regenerate
    for (let i = 0; i < 10; i++) {
        generatePlatform(i * 300);
    }
}

function startGame() {
    reset();
}

// Start game
gameLoop();