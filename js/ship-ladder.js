// OBS-style telescopic structure, drawn with Moonlander's original fine-line style.
// Keep three rigid sliding stages and nine treads at the existing boarding height.
const STAGE_LENGTH = 0.88;
const STAGE_TRAVEL = 0.80;
const TREAD_HEIGHT = 0.065;
const FULL_LENGTH = STAGE_LENGTH + STAGE_TRAVEL * 2;

export function createShipLadder(scene, x, top, bottom, extension = 0) {
    let ladder = scene.shipLadder;
    if (!ladder?.active) {
        ladder = scene.add.graphics().setDepth(7);
        scene.shipLadder = ladder;
        // Carry the stowed ladder from the first descent, including ship rotation.
        const followShip = () => {
            const ship = scene.spaceship;
            if (!ship?.active) {
                ladder.setVisible(false);
                return;
            }
            const mount = ladder.getData('mount');
            const cos = Math.cos(ship.rotation), sin = Math.sin(ship.rotation);
            ladder.setPosition(ship.x + mount.x * cos - mount.y * sin,
                ship.y + mount.x * sin + mount.y * cos);
            ladder.setRotation(ship.rotation).setVisible(ship.visible).setAlpha(ship.alpha);
        };
        scene.events.on('postupdate', followShip);
        ladder.once('destroy', () => scene.events.off('postupdate', followShip));
    }
    ladder.setPosition(x, top);
    ladder.setData('deployment', { x, top, bottom });
    // Callers supply the upright mounting position, shared by descent and takeoff.
    ladder.setData('mount', { x: x - scene.spaceship.x, y: top - scene.spaceship.y });
    drawShipLadder(ladder, extension);
    return ladder;
}

export function drawShipLadder(ladder, extension) {
    const { top, bottom } = ladder.getData('deployment');
    const scale = (bottom - top) / FULL_LENGTH;
    const amount = Math.max(0, Math.min(1, extension));
    ladder.setData('extension', amount);
    ladder.clear();
    // Match the original game's six-pixel ladder and fine monochrome strokes.
    const line = (x1, y1, x2, y2, color = 0xbcbcbc, width = 0.75) => {
        ladder.lineStyle(width, color).lineBetween(x1, y1, x2, y2);
    };
    const storedLength = STAGE_LENGTH * scale;
    // A small open mounting frame, without solid side plates or bevels.
    line(-4, -0.5, 4, -0.5, 0xaaaaaa);
    for (const side of [-1, 1]) {
        line(side * 3.7, 0, side * 3.7, storedLength, 0x888888, 0.6);
        line(side * 3.2, storedLength, side * 4.2, storedLength, 0xaaaaaa);
    }
    for (let stage = 0; stage < 3; stage++) {
        const halfWidth = (6 - stage * 0.9) / 2;
        const offset = stage * STAGE_TRAVEL * amount * scale;
        for (const side of [-1, 1]) {
            line(side * halfWidth, offset, side * halfWidth, offset + storedLength);
            line(side * halfWidth - 0.45, offset + 1.5, side * halfWidth + 0.45, offset + 1.5, 0x999999);
        }
        for (let rung = 0; rung < 3; rung++) {
            const treadTop = offset + (0.15 + rung * 0.28 - TREAD_HEIGHT / 2) * scale;
            line(-halfWidth, treadTop + 0.375, halfWidth, treadTop + 0.375);
        }
    }
}

// Feet use the actual tread tops, including the gaps between sliding stages.
export function shipLadderRungYs(ladder) {
    const { top, bottom } = ladder.getData('deployment');
    const scale = (bottom - top) / FULL_LENGTH;
    return Array.from({ length: 9 }, (_, index) => ladder.y +
        (Math.floor(index / 3) * STAGE_TRAVEL + 0.15 + (index % 3) * 0.28 - TREAD_HEIGHT / 2) * scale);
}

export function stowShipLadder(scene, onComplete) {
    const ladder = scene.shipLadder;
    if (!ladder?.active) {
        onComplete();
        return;
    }
    const motion = { extension: ladder.getData('extension') };
    scene.tweens.add({
        targets: motion, extension: 0, duration: 1450, ease: 'Sine.easeInOut',
        onUpdate: () => drawShipLadder(ladder, motion.extension),
        onComplete: () => {
            drawShipLadder(ladder, 0);
            onComplete();
        }
    });
}
