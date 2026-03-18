import { Application, Graphics, Container, Ticker } from 'pixi.js';

// ── Coordinate constants ───────────────────────────────────────────────────
const HOME_X = 300;
const HOME_Y = 420;

// ── Easing helpers ────────────────────────────────────────────────────────

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// ── Shadow helper ─────────────────────────────────────────────────────────

/**
 * Creates a shadow ellipse that sits on the ground beneath the ball.
 * Returned graphics node must be added to the parent container by the caller.
 */
function createShadow(container: Container): Graphics {
  const shadow = new Graphics();
  shadow.ellipse(0, 0, 5, 3);
  shadow.fill({ color: 0x000000, alpha: 0.4 });
  container.addChild(shadow);
  return shadow;
}

// ── Hop simulation (ground balls) ────────────────────────────────────────

/**
 * Returns a vertical "hop" offset for a ground ball based on the current
 * normalised progress `t` and exit velocity.
 * Faster balls = larger, fewer hops. Slower = more frequent small hops.
 */
function hopOffset(t: number, exitVelo: number): number {
  // exitVelo range: ~60–110 mph → normalise
  const speed = Math.min(1, Math.max(0, (exitVelo - 60) / 50));
  const hopCount = speed > 0.7 ? 1.5 : speed > 0.4 ? 2.5 : 3.5;
  const amplitude = speed > 0.7 ? 8 : speed > 0.4 ? 5 : 3;
  // Hops decay toward end of path
  const decay = 1 - t;
  return Math.max(0, Math.sin(t * Math.PI * hopCount) * amplitude * decay);
}

// ── Public animators ──────────────────────────────────────────────────────

/**
 * Ball rolls/bounces along the ground from home plate to a landing point.
 */
export function animateGroundBall(
  app: Application,
  parent: Container,
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
  exitVelo: number,
  onComplete?: () => void,
): void {
  // Slower ball = longer duration; 500ms at 110 mph → 750ms at 60 mph
  const durationMs = 750 - ((exitVelo - 60) / 50) * 250;

  const ball = new Graphics();
  ball.circle(0, 0, 3.5);
  ball.fill({ color: 0xffffff });
  ball.x = startPos.x;
  ball.y = startPos.y;
  parent.addChild(ball);

  const shadow = createShadow(parent);
  shadow.x = startPos.x;
  shadow.y = startPos.y + 3;

  let elapsed = 0;

  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / durationMs, 1);
    const ease = easeOutExpo(t);

    const bx = startPos.x + (endPos.x - startPos.x) * ease;
    const by = startPos.y + (endPos.y - startPos.y) * ease;
    const hop = hopOffset(t, exitVelo);

    ball.x = bx;
    ball.y = by - hop;

    shadow.x = bx;
    shadow.y = by + 3;
    shadow.alpha = 0.4 - hop * 0.02;

    if (t >= 1) {
      app.ticker.remove(onTick);
      ball.destroy();
      shadow.destroy();
      onComplete?.();
    }
  };

  app.ticker.add(onTick);
}

/**
 * Low, fast arc — line drive with minimal height.
 */
export function animateLineDrive(
  app: Application,
  parent: Container,
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
  exitVelo: number,
  onComplete?: () => void,
): void {
  // 350-500ms — line drives are fast
  const durationMs = 500 - ((exitVelo - 60) / 50) * 150;

  const ball = new Graphics();
  ball.circle(0, 0, 4);
  ball.fill({ color: 0xffffff });
  ball.x = startPos.x;
  ball.y = startPos.y;
  parent.addChild(ball);

  const shadow = createShadow(parent);

  // Control point: slight rise peaking at 1/3 of the way
  const dx = endPos.x - startPos.x;
  const dy = endPos.y - startPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const arcHeight = Math.min(25, dist * 0.08); // very shallow arc

  const ctrlX = startPos.x + (endPos.x - startPos.x) * 0.33;
  const ctrlY = startPos.y + (endPos.y - startPos.y) * 0.33 - arcHeight;

  let elapsed = 0;

  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / durationMs, 1);

    // Quadratic bezier
    const inv = 1 - t;
    const bx = inv * inv * startPos.x + 2 * inv * t * ctrlX + t * t * endPos.x;
    const by = inv * inv * startPos.y + 2 * inv * t * ctrlY + t * t * endPos.y;

    ball.x = bx;
    ball.y = by;

    // Shadow slightly offset below, fades as ball rises
    const heightAboveGround = startPos.y - by;
    shadow.x = bx;
    shadow.y = startPos.y + (endPos.y - startPos.y) * t + 3;
    shadow.alpha = Math.max(0, 0.4 - heightAboveGround * 0.005);

    if (t >= 1) {
      app.ticker.remove(onTick);
      ball.destroy();
      shadow.destroy();
      onComplete?.();
    }
  };

  app.ticker.add(onTick);
}

/**
 * High parabolic fly ball arc. Ball scales smaller at apex (looks farther away),
 * larger as it descends. Shadow grows/shrinks inversely.
 */
export function animateFlyBall(
  app: Application,
  parent: Container,
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
  distance: number,  // 0-1 normalized
  onComplete?: () => void,
): void {
  const durationMs = 800 + distance * 300;

  const ball = new Graphics();
  ball.circle(0, 0, 4);
  ball.fill({ color: 0xffffff });
  ball.x = startPos.x;
  ball.y = startPos.y;
  parent.addChild(ball);

  const shadow = createShadow(parent);

  const dx = endPos.x - startPos.x;
  const dy = endPos.y - startPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // High arc — control point well above the midpoint
  const arcHeight = 60 + dist * 0.35;

  const ctrlX = (startPos.x + endPos.x) / 2;
  const ctrlY = Math.min(startPos.y, endPos.y) - arcHeight;

  let elapsed = 0;

  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / durationMs, 1);

    const inv = 1 - t;
    const bx = inv * inv * startPos.x + 2 * inv * t * ctrlX + t * t * endPos.x;
    const by = inv * inv * startPos.y + 2 * inv * t * ctrlY + t * t * endPos.y;

    // Height above "ground level" based on quadratic curve
    const groundY = startPos.y + (endPos.y - startPos.y) * t;
    const heightAboveGround = Math.max(0, groundY - by);

    // Ball scales smaller as it rises (simulating z-depth)
    const maxHeight = startPos.y - ctrlY;
    const normalizedHeight = heightAboveGround / Math.max(1, maxHeight);
    const ballScale = 1 - normalizedHeight * 0.45;
    ball.scale.set(ballScale);
    ball.x = bx;
    ball.y = by;

    // Shadow at ground level — grows larger when ball is high
    shadow.x = bx;
    shadow.y = groundY + 3;
    shadow.scale.set(1 + normalizedHeight * 0.8);
    shadow.alpha = Math.max(0.1, 0.4 - normalizedHeight * 0.2);

    if (t >= 1) {
      app.ticker.remove(onTick);
      ball.destroy();
      shadow.destroy();
      onComplete?.();
    }
  };

  app.ticker.add(onTick);
}

/**
 * Home run arc — exits the playing field, sparkle at apex, screen flash at wall.
 */
export function animateHomeRun(
  app: Application,
  parent: Container,
  startPos: { x: number; y: number },
  angle: number,   // spray angle in degrees (0 = center, -45 = LF, +45 = RF)
  distance: number, // 0-1 normalized
  onComplete?: () => void,
): void {
  const durationMs = 1100 + distance * 300;

  const rad = ((angle - 90) * Math.PI) / 180;
  const travelDist = 280 + distance * 60;
  const endPos = {
    x: HOME_X + Math.cos(rad) * travelDist,
    y: HOME_Y + Math.sin(rad) * travelDist,
  };

  const ball = new Graphics();
  ball.circle(0, 0, 4);
  ball.fill({ color: 0xffffff });
  ball.x = startPos.x;
  ball.y = startPos.y;
  parent.addChild(ball);

  const shadow = createShadow(parent);

  const dx = endPos.x - startPos.x;
  const dy = endPos.y - startPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const arcHeight = 90 + dist * 0.4;

  const ctrlX = (startPos.x + endPos.x) / 2;
  const ctrlY = Math.min(startPos.y, endPos.y) - arcHeight;

  let elapsed = 0;
  let apexFlashDone = false;
  let wallFlashDone = false;

  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / durationMs, 1);

    const inv = 1 - t;
    const bx = inv * inv * startPos.x + 2 * inv * t * ctrlX + t * t * endPos.x;
    const by = inv * inv * startPos.y + 2 * inv * t * ctrlY + t * t * endPos.y;

    const groundY = startPos.y + (endPos.y - startPos.y) * t;
    const heightAboveGround = Math.max(0, groundY - by);
    const maxHeight = startPos.y - ctrlY;
    const normalizedHeight = heightAboveGround / Math.max(1, maxHeight);

    ball.scale.set(1 - normalizedHeight * 0.5);
    ball.x = bx;
    ball.y = by;

    shadow.x = bx;
    shadow.y = groundY + 3;
    shadow.scale.set(1 + normalizedHeight * 0.8);
    shadow.alpha = Math.max(0, 0.35 - normalizedHeight * 0.2);

    // Apex sparkle (near t=0.5 when ball is highest)
    if (!apexFlashDone && t >= 0.48 && t <= 0.52) {
      apexFlashDone = true;
      _spawnSparkle(parent, bx, by, 0xd4a843, 12);
    }

    // Wall flash (near t=0.82 — ball clears the fence)
    if (!wallFlashDone && t >= 0.80) {
      wallFlashDone = true;
      _showScreenFlash(parent);
    }

    if (t >= 1) {
      app.ticker.remove(onTick);
      ball.destroy();
      shadow.destroy();
      onComplete?.();
    }
  };

  app.ticker.add(onTick);
}

/**
 * Very short, very high popup that stays in the infield.
 */
export function animatePopup(
  app: Application,
  parent: Container,
  startPos: { x: number; y: number },
  onComplete?: () => void,
): void {
  const durationMs = 900;

  // Short lateral drift
  const endPos = {
    x: startPos.x + (Math.random() - 0.5) * 40,
    y: startPos.y - 30,
  };

  const ball = new Graphics();
  ball.circle(0, 0, 4);
  ball.fill({ color: 0xffffff });
  ball.x = startPos.x;
  ball.y = startPos.y;
  parent.addChild(ball);

  const shadow = createShadow(parent);

  const ctrlX = (startPos.x + endPos.x) / 2;
  const ctrlY = startPos.y - 95; // very high arc for popup

  let elapsed = 0;

  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / durationMs, 1);

    const inv = 1 - t;
    const bx = inv * inv * startPos.x + 2 * inv * t * ctrlX + t * t * endPos.x;
    const by = inv * inv * startPos.y + 2 * inv * t * ctrlY + t * t * endPos.y;

    const groundY = startPos.y + (endPos.y - startPos.y) * t;
    const heightAboveGround = Math.max(0, groundY - by);
    const maxHeight = startPos.y - ctrlY;
    const normalizedHeight = heightAboveGround / Math.max(1, maxHeight);

    // Ball shrinks dramatically on a popup (it goes very high)
    const ballScale = Math.max(0.3, 1 - normalizedHeight * 0.7);
    ball.scale.set(ballScale);
    ball.x = bx;
    ball.y = by;

    shadow.x = bx;
    shadow.y = groundY + 3;
    shadow.scale.set(1 + normalizedHeight * 0.5);
    shadow.alpha = Math.max(0.1, 0.4 - normalizedHeight * 0.15);

    if (t >= 1) {
      app.ticker.remove(onTick);
      ball.destroy();
      shadow.destroy();
      onComplete?.();
    }
  };

  app.ticker.add(onTick);
}

// ── Internal helpers ──────────────────────────────────────────────────────

/** Spawn small particle sparks around a point. */
function _spawnSparkle(
  parent: Container,
  cx: number,
  cy: number,
  color: number,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const spark = new Graphics();
    spark.circle(0, 0, 2);
    spark.fill({ color });
    spark.x = cx;
    spark.y = cy;
    parent.addChild(spark);

    const angle = (i / count) * Math.PI * 2;
    const speed = 1 + Math.random() * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    let life = 0;
    const lifetime = 350;

    const onTick = (ticker: Ticker) => {
      life += ticker.deltaMS;
      const tl = life / lifetime;
      spark.x += vx;
      spark.y += vy + tl * 0.5;  // slight gravity
      spark.alpha = 1 - tl;
      if (tl >= 1) {
        // Use the app ticker from parent — remove via closure
        spark.parent?.removeChild(spark);
        spark.destroy();
      }
    };

    // Attach to the global ticker via the Pixi singleton
    // We access the app indirectly via the container's renderer
    // Since we don't have app here, use a manual setTimeout-based loop
    _tickOnce(onTick, lifetime, spark);
  }
}

/** Minimal screen flash — a white semi-transparent rect that fades. */
function _showScreenFlash(parent: Container): void {
  const flash = new Graphics();
  flash.rect(-50, -50, 700, 600);
  flash.fill({ color: 0xffd700, alpha: 0.18 });
  parent.addChild(flash);

  let life = 0;
  const lifetime = 500;

  _tickOnce((ticker: Ticker) => {
    life += ticker.deltaMS;
    flash.alpha = 0.18 * (1 - life / lifetime);
    if (life >= lifetime) {
      if (flash.parent) flash.parent.removeChild(flash);
      flash.destroy();
    }
  }, lifetime, flash);
}

/**
 * Minimal ticker that works without a direct Application reference —
 * attaches to Pixi's shared ticker.
 */
function _tickOnce(
  fn: (t: Ticker) => void,
  _lifetimeMs: number,
  guard: { destroyed?: boolean },
): void {
  const ticker = Ticker.shared;

  const wrapper = (t: Ticker) => {
    if (guard.destroyed) {
      ticker.remove(wrapper);
      return;
    }
    fn(t);
  };

  ticker.add(wrapper);
}
