const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Player object
const player = {
    x: 100,
    y: 500,
    width: 50,
    height: 50,
    velocityX: 0,
    velocityY: 0,
    speed: 7,
    jumpPower: -18,
    gravity: 0.8,
    onGround: false,
    health: 3,
    immunity: 0,
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
    lastAttackType: null
};

// Camera
let cameraX = 0;

// Game state
let gameOver = false;

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
            if (gameOver) reset();
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
        shootCooldown
    });
}

function spawnProjectile(x, y, vx, vy) {
    projectiles.push({ x, y, vx, vy, width: 10, height: 10, life: 120 });
}

function applyPlayerAttack(type) {
    let damage = 0;
    let attackBox = null;
    let radius = 0;
    if (type === 'light') {
        damage = 1;
        if (keys.up) {
            attackBox = {
                x: player.x + 10,
                y: player.y - 70,
                width: player.width - 20,
                height: 70
            };
        } else if (keys.down) {
            attackBox = {
                x: player.x + 10,
                y: player.y + player.height,
                width: player.width - 20,
                height: 70
            };
        } else {
            attackBox = {
                x: player.x + (player.facing === 1 ? player.width : -55),
                y: player.y + 10,
                width: 55,
                height: player.height - 20
            };
        }
    } else if (type === 'heavy') {
        damage = 2;
        if (keys.up) {
            attackBox = {
                x: player.x + 5,
                y: player.y - 90,
                width: player.width - 10,
                height: 90
            };
        } else if (keys.down) {
            attackBox = {
                x: player.x + 5,
                y: player.y + player.height,
                width: player.width - 10,
                height: 90
            };
        } else {
            attackBox = {
                x: player.x + (player.facing === 1 ? player.width : -75),
                y: player.y + 5,
                width: 75,
                height: player.height - 10
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
            if (e.health <= 0) {
                player.points += 10;
                player.style = Math.min(100, player.style + (player.lastAttackType === type ? 5 : 10));
                player.lastAttackType = type;
            }
        }
    }
}

function startPlayerAttack(type) {
    if (player.attackState) return;
    if (type === 'heavy' && player.heavyCooldown > 0) return;
    if (type === 'special' && player.specialCooldown > 0) return;

    let direction = 'horizontal';
    if (keys.up) direction = 'up';
    else if (keys.down) direction = 'down';

    if (type === 'light') {
        player.attackState = 'light';
        player.attackTimer = 8;
        player.attackEffect = { type: 'light', duration: 10, direction };
        applyPlayerAttack('light');
    } else if (type === 'heavy') {
        player.attackState = 'heavy';
        player.attackTimer = 12;
        player.attackEffect = { type: 'heavy', duration: 16, direction };
        player.heavyCooldown = 60;
        applyPlayerAttack('heavy');
    } else if (type === 'special') {
        player.attackState = 'special';
        player.attackTimer = 24;
        player.attackEffect = { type: 'special', duration: 24 };
        player.specialCooldown = player.specialCooldownMax;
        applyPlayerAttack('special');
    }
}

// Update function
function update() {
    if (gameOver) return;

    // Horizontal movement
    let currentSpeed = keys.shift ? 7 : 5;
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
        player.dashTimer = 12;
        player.immunity = 12; // Temporary immunity during dash
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
        let dashStrength = 10;
        const directVertical = xDir === 0 && yDir !== 0;
        if (directVertical) {
            dashStrength += 8;
        }
        if (keys.left || keys.right) {
            dashStrength += 10;
        }
        if (keys.shift) {
            dashStrength += 20;
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
    if (!player.dashing) {
        if (keys.jump && player.onGround) {
            player.velocityY = player.jumpPower;
            player.onGround = false;
            // Longer jump if sprinting
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

    // Update immunity
    if (player.immunity > 0) player.immunity--;

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
    cameraX = Math.max(0, player.x - canvas.width / 2);

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

    // Remove off-screen or dead enemies
    enemies = enemies.filter(e => e.health > 0 && e.x + e.width > cameraX - 100 && e.y < canvas.height + 100);

    // Remove off-screen health packs
    healthPacks = healthPacks.filter(pack => pack.x + pack.width > cameraX - 100);

    // Update projectiles
    for (let p of projectiles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (checkCollision(p, player) && player.immunity == 0) {
            player.health--;
            player.immunity = 180;
            p.life = 0;
            if (player.health <= 0) {
                gameOver = true;
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
                player.immunity = 60; // 1 second at 60fps
                e.attackCooldown = 60;
                e.attackState = null;
                e.attacking = false;
                if (player.health <= 0) {
                    gameOver = true;
                }
                e.x += 50;
            }
        }
    }

    // Update enemies
    for (let e of enemies) {
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

    // Save context for camera
    ctx.save();
    ctx.translate(-cameraX, 0);

    // Draw ground (but since endless, maybe not needed, or draw as platforms)
    // For simplicity, keep ground but platforms override

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
        if (e.type === 'melee') {
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
                ctx.strokeRect(player.x + 10, player.y - 70, player.width - 20, 70);
            } else if (player.attackEffect.direction === 'down') {
                ctx.strokeRect(player.x + 10, player.y + player.height, player.width - 20, 70);
            } else {
                const x = player.x + (player.facing === 1 ? player.width : -55);
                ctx.strokeRect(x, player.y + 10, 55, player.height - 20);
            }
        } else if (player.attackEffect.type === 'heavy') {
            ctx.strokeStyle = '#FF8C00';
            ctx.lineWidth = 4;
            if (player.attackEffect.direction === 'up') {
                ctx.strokeRect(player.x + 5, player.y - 90, player.width - 10, 90);
            } else if (player.attackEffect.direction === 'down') {
                ctx.strokeRect(player.x + 5, player.y + player.height, player.width - 10, 90);
            } else {
                const x = player.x + (player.facing === 1 ? player.width : -75);
                ctx.strokeRect(x, player.y + 5, 75, player.height - 10);
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
    ctx.fillStyle = player.immunity > 0 ? '#FFFF00' : '#FF0000';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Draw immunity visual
    if (player.immunity > 0) {
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 4;
        ctx.strokeRect(player.x - 2, player.y - 2, player.width + 4, player.height + 4);
    }

    // Restore context
    ctx.restore();

    // Draw UI
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.fillText(`Health: ${player.health}`, 10, 30);

    // Special attack cooldown UI
    const cooldownWidth = 160;
    const cooldownHeight = 18;
    const cooldownX = canvas.width - cooldownWidth - 20;
    const cooldownY = 20;
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

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFF';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
        ctx.font = '20px Arial';
        ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 50);
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
    cameraX = 0;
    gameOver = false;
    platforms = [];
    enemies = [];
    projectiles = [];
    healthPacks = [];
    // regenerate
    for (let i = 0; i < 10; i++) {
        generatePlatform(i * 300);
    }
    }

// Start game
// Initial platforms
for (let i = 0; i < 10; i++) {
    generatePlatform(i * 300);
}
gameLoop();