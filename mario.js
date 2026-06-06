/* ============================================================
   SUPER PIXEL BROS — a classic-style 2D platformer
   Pure vanilla JS + Canvas. No assets, everything drawn by code.
   ============================================================ */
(() => {
  'use strict';

  // ---------- Canvas ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const VW = canvas.width;   // viewport width  (640)
  const VH = canvas.height;  // viewport height (360)
  const TILE = 32;           // tile size in px

  // ---------- Tunable physics ----------
  const GRAVITY      = 0.62;
  const MAX_FALL     = 13;
  const MOVE_ACCEL   = 0.55;
  const RUN_MAX      = 5.6;
  const WALK_MAX     = 3.4;
  const FRICTION     = 0.78;   // ground damping when no input
  const AIR_FRICTION = 0.94;
  const JUMP_VEL     = -12.4;
  const JUMP_CUT     = 0.42;   // velocity multiplier when jump released early
  const COYOTE       = 6;      // frames you can still jump after leaving ledge
  const JUMP_BUFFER  = 6;      // frames a jump press is remembered
  const ENEMY_SPEED  = 0.9;
  const SHELL_SPEED  = 7.0;
  const BOUNCE_VEL   = -8.2;   // upward bounce after stomping

  // ============================================================
  //  LEVEL DATA
  //  Legend:
  //   ' ' empty            'X' solid ground/brick
  //   'B' breakable brick  '?' question block (coin)
  //   'P' pipe top-left    'p' pipe body (decorative, solid)
  //   'C' coin (floating)  'g' goomba   'k' koopa
  //   '=' floating platform 'F' flag pole  '|' flag base
  //   'S' player start
  //  Rows are top -> bottom. Levels are 15 tiles tall.
  // ============================================================
  const LEVELS = [
    {
      name: 'World 1-1 · Grass Plains',
      sky: '#5c94fc', ground: '#c0581f', dirt: '#8a3b12', grass: '#3ea120',
      rows: [
        "                                                                                            ",
        "                                                                                            ",
        "                                                                                            ",
        "                                                                                            ",
        "              C C                          C C C                                            ",
        "                                                                          F                 ",
        "        ?   B?B?B          C                                              FFF                ",
        "                                       =  =  =                            FFF                ",
        "                          C C              k                              FFF                ",
        "                  g                                  g       g            FFF        |       ",
        "S          g            P                  ?     B?B                      FFF       |||      ",
        "          XXX          Xp     XXXX     XXXXXXXX        XXXXX  k  XXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "XXXXXXXXXXXXX   XXXXXXXXXpXXXXXXXXXX   XXXXXXXX  XXXX  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "XXXXXXXXXXXXX   XXXXXXXXXpXXXXXXXXXX   XXXXXXXX  XXXX  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "XXXXXXXXXXXXX   XXXXXXXXXpXXXXXXXXXX   XXXXXXXX  XXXX  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      ],
    },
    {
      name: 'World 1-2 · Koopa Causeway',
      sky: '#3a6fb0', ground: '#9a5a2a', dirt: '#5e3415', grass: '#2c8f3a',
      rows: [
        "                                                                                            ",
        "                                                                                            ",
        "             C C C                                                                          ",
        "          B?BB?B            C C C                                                            ",
        "                                       ?  ?  ?                                              ",
        "                      k                                       C C C            F            ",
        "                                  =   =   =        k    k                     FFF           ",
        "          C  C              k                                  B?B            FFF           ",
        "      g                                       =  =                            FFF           ",
        "                  =  =          k         g              g          g         FFF      |    ",
        "S    g       ?              g                    P              k              FFF     |||   ",
        "    XXXX           XXXX           XXXXX       XXXp    XXXXX           XXXXXXXXXXXXXXXXXXXXXXXX",
        "XXXXXXXXX   XXXXXXXXXXXX   XXXX   XXXXX  XXX  XXXp X  XXXXX   XXXX X  XXXXXXXXXXXXXXXXXXXXXXXX",
        "XXXXXXXXX   XXXXXXXXXXXX   XXXX   XXXXX  XXX  XXXpXX  XXXXX   XXXX X  XXXXXXXXXXXXXXXXXXXXXXXX",
        "XXXXXXXXX   XXXXXXXXXXXX   XXXX   XXXXX  XXX  XXXpXX  XXXXX   XXXX X  XXXXXXXXXXXXXXXXXXXXXXXX",
      ],
    },
    {
      name: 'World 1-3 · Sky Castle',
      sky: '#243a6e', ground: '#7a7a8c', dirt: '#3c3c52', grass: '#9a9ab0',
      rows: [
        "                                                                                            ",
        "          C C C                                  C C C                                      ",
        "        =======              =====                                                          ",
        "                                          k                                                 ",
        "                  C C           g                       ===  ===                            ",
        "             ===========                     ====                       C C       F         ",
        "    g                          k        C C            k      =====    ====      FFF        ",
        "          ?  ?         ==                       ===                              FFF         ",
        "  S                            ===     g                  k          g           FFF    |    ",
        "  XXXX        ===                             ===   ===          ===             FFF   |||   ",
        "                       ===          ===                    ===          XXXXXXXXXXXXXXXXXXXXX",
        "        ===                                         ===              ===XXXXXXXXXXXXXXXXXXXXX",
        "                  ===        ===          ===                          XXXXXXXXXXXXXXXXXXXXX",
        "XXXX                                                                   XXXXXXXXXXXXXXXXXXXXX",
        "XXXX        (pit — don't fall!)                                        XXXXXXXXXXXXXXXXXXXXX",
      ],
    },
  ];

  // ============================================================
  //  GAME STATE
  // ============================================================
  const State = { START: 0, PLAY: 1, DEAD: 2, CLEAR: 3, OVER: 4, WIN: 5, PAUSE: 6 };
  const game = {
    state: State.START,
    levelIndex: 0,
    score: 0,
    coins: 0,
    lives: 3,
    time: 0,
    camX: 0,
    tiles: [],        // 2D array of chars
    cols: 0, rows: 0,
    solids: null,     // collision lookup
    enemies: [],
    coinsList: [],
    blocks: [],       // interactive ? / brick blocks {col,row,type,used,bump}
    particles: [],
    flagX: 0,
    finishX: 0,
    levelW: 0, levelH: 0,
    stateTimer: 0,
  };

  // ---------- Player ----------
  const player = {
    x: 0, y: 0, w: 22, h: 28,
    vx: 0, vy: 0,
    dir: 1,
    onGround: false,
    coyote: 0, jumpBuf: 0, jumpHeld: false,
    walkPhase: 0,
    invuln: 0,
    dead: false, deadTimer: 0,
    winSlide: false,
  };

  // ============================================================
  //  INPUT
  // ============================================================
  const keys = { left: false, right: false, jump: false, run: false };
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
    ShiftLeft: 'run', ShiftRight: 'run',
  };
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') { togglePause(); return; }
    const a = KEYMAP[e.code];
    if (a) {
      if (a === 'jump' && !keys.jump) player.jumpBuf = JUMP_BUFFER;
      keys[a] = true;
      if (['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code)) e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) keys[a] = false;
  });

  // Touch controls
  function bindTouch(id, action) {
    const el = document.getElementById(id);
    const set = (v) => (e) => { e.preventDefault();
      if (action === 'jump' && v && !keys.jump) player.jumpBuf = JUMP_BUFFER;
      keys[action] = v; };
    el.addEventListener('touchstart', set(true), { passive: false });
    el.addEventListener('touchend', set(false), { passive: false });
    el.addEventListener('touchcancel', set(false), { passive: false });
    el.addEventListener('mousedown', set(true));
    addEventListener('mouseup', () => { keys[action] = false; });
  }
  bindTouch('t-left', 'left');
  bindTouch('t-right', 'right');
  bindTouch('t-jump', 'jump');

  // ============================================================
  //  LEVEL LOADING
  // ============================================================
  function loadLevel(idx) {
    const def = LEVELS[idx];
    const rows = def.rows.map((r) => r.split(''));
    game.tiles = rows;
    game.rows = rows.length;
    game.cols = Math.max(...rows.map((r) => r.length));
    // normalize ragged rows
    for (const r of rows) while (r.length < game.cols) r.push(' ');

    game.levelW = game.cols * TILE;
    game.levelH = game.rows * TILE;
    game.enemies = [];
    game.coinsList = [];
    game.blocks = [];
    game.particles = [];
    game.camX = 0;
    game.flagX = 0;
    game.def = def;

    // Build a solids grid + spawn entities
    game.solids = [];
    for (let r = 0; r < game.rows; r++) {
      game.solids[r] = [];
      for (let c = 0; c < game.cols; c++) {
        const ch = rows[r][c];
        let solid = false;
        switch (ch) {
          case 'X': case 'B': case '?': case '=': case 'p':
            solid = true; break;
          case 'P':
            solid = true; break; // pipe top
          case 'S':
            player.x = c * TILE + 4; player.y = r * TILE; break;
          case 'g':
            game.enemies.push(makeEnemy(c * TILE, r * TILE, 'goomba')); break;
          case 'k':
            game.enemies.push(makeEnemy(c * TILE, r * TILE, 'koopa')); break;
          case 'C':
            game.coinsList.push({ x: c * TILE + 8, y: r * TILE + 6, t: 0, got: false }); break;
          case 'F': case '|':
            game.flagX = Math.max(game.flagX, c * TILE);
            if (!game.finishX || c * TILE < game.finishX) {} // handled below
            break;
        }
        if (ch === 'B' || ch === '?') {
          game.blocks.push({ col: c, row: r, type: ch, used: false, bump: 0 });
        }
        game.solids[r][c] = solid;
      }
    }

    // finish line = first flag column
    let flagCol = game.cols;
    for (let r = 0; r < game.rows; r++)
      for (let c = 0; c < game.cols; c++)
        if (rows[r][c] === 'F' || rows[r][c] === '|') flagCol = Math.min(flagCol, c);
    game.finishX = flagCol * TILE;

    // Reset player kinematics
    player.vx = 0; player.vy = 0; player.dir = 1;
    player.onGround = false; player.dead = false; player.deadTimer = 0;
    player.invuln = 90; player.winSlide = false;
    game.time = 400;
    game.timeAcc = 0;
  }

  function makeEnemy(x, y, type) {
    return {
      type, x, y,
      w: type === 'koopa' ? 24 : 26,
      h: type === 'koopa' ? 30 : 24,
      vx: -ENEMY_SPEED, vy: 0,
      dir: -1,
      onGround: false,
      dead: false, deadTimer: 0,
      shell: false,           // koopa retracted
      shellMoving: false,
      stomped: false,
      phase: Math.random() * 6,
    };
  }

  // ---------- Collision helpers ----------
  function solidAt(px, py) {
    const c = Math.floor(px / TILE);
    const r = Math.floor(py / TILE);
    if (r < 0 || r >= game.rows) return false;
    if (c < 0) return true;          // invisible wall on the left
    if (c >= game.cols) return false;
    return game.solids[r][c];
  }

  // Move an AABB body with tile collision. Returns collision flags.
  function moveBody(b) {
    const flags = { left: false, right: false, top: false, bottom: false };

    // Horizontal
    b.x += b.vx;
    if (b.vx > 0) {
      if (solidAt(b.x + b.w, b.y + 2) || solidAt(b.x + b.w, b.y + b.h - 2)) {
        b.x = Math.floor((b.x + b.w) / TILE) * TILE - b.w - 0.01;
        b.vx = 0; flags.right = true;
      }
    } else if (b.vx < 0) {
      if (solidAt(b.x, b.y + 2) || solidAt(b.x, b.y + b.h - 2)) {
        b.x = (Math.floor(b.x / TILE) + 1) * TILE + 0.01;
        b.vx = 0; flags.left = true;
      }
    }

    // Vertical
    b.y += b.vy;
    if (b.vy > 0) {
      if (solidAt(b.x + 2, b.y + b.h) || solidAt(b.x + b.w - 2, b.y + b.h)) {
        b.y = Math.floor((b.y + b.h) / TILE) * TILE - b.h - 0.01;
        b.vy = 0; flags.bottom = true;
      }
    } else if (b.vy < 0) {
      if (solidAt(b.x + 2, b.y) || solidAt(b.x + b.w - 2, b.y)) {
        b.y = (Math.floor(b.y / TILE) + 1) * TILE + 0.01;
        b.vy = 0; flags.top = true;
      }
    }
    return flags;
  }

  // ============================================================
  //  UPDATE
  // ============================================================
  function update() {
    if (game.state !== State.PLAY) return;

    // --- Timer ---
    game.timeAcc += 1;
    if (game.timeAcc >= 40) { game.timeAcc = 0; game.time = Math.max(0, game.time - 1);
      if (game.time === 0) killPlayer('Out of time!'); }

    if (player.dead) { updateDeath(); return; }
    if (player.winSlide) { updateWinSlide(); return; }

    updatePlayer();
    updateEnemies();
    updateCoins();
    updateBlocks();
    updateParticles();
    updateCamera();

    // Win check — reached flag
    if (player.x + player.w > game.finishX && !player.winSlide) {
      startWinSlide();
    }
    // Fell in a pit
    if (player.y > game.levelH + 40) killPlayer('You fell into the abyss!');
  }

  function updatePlayer() {
    const max = keys.run ? RUN_MAX : WALK_MAX;

    if (keys.left && !keys.right) { player.vx -= MOVE_ACCEL; player.dir = -1; }
    else if (keys.right && !keys.left) { player.vx += MOVE_ACCEL; player.dir = 1; }
    else { player.vx *= player.onGround ? FRICTION : AIR_FRICTION; if (Math.abs(player.vx) < 0.05) player.vx = 0; }

    player.vx = clamp(player.vx, -max, max);

    // Gravity
    player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);

    // Coyote + buffered jump
    if (player.onGround) player.coyote = COYOTE; else if (player.coyote > 0) player.coyote--;
    if (player.jumpBuf > 0) player.jumpBuf--;

    if (player.jumpBuf > 0 && player.coyote > 0) {
      player.vy = JUMP_VEL;
      player.onGround = false; player.coyote = 0; player.jumpBuf = 0;
      player.jumpHeld = true;
      sfx('jump');
    }
    // Variable jump height
    if (!keys.jump && player.jumpHeld && player.vy < 0) { player.vy *= JUMP_CUT; player.jumpHeld = false; }
    if (player.vy >= 0) player.jumpHeld = false;

    const f = moveBody(player);
    player.onGround = f.bottom;
    if (f.top) headBump();      // hit a block from below

    if (player.invuln > 0) player.invuln--;

    // walk animation
    if (player.onGround && Math.abs(player.vx) > 0.4) player.walkPhase += Math.abs(player.vx) * 0.08;
    else player.walkPhase = 0;
  }

  // Hitting a block from below
  function headBump() {
    const headC = Math.floor((player.x + player.w / 2) / TILE);
    const headR = Math.floor((player.y - 2) / TILE);
    for (const blk of game.blocks) {
      if (blk.col === headC && blk.row === headR) {
        if (blk.type === '?' && !blk.used) {
          blk.used = true; blk.bump = 8;
          game.solids[blk.row][blk.col] = true;
          collectCoin(true);
          spawnCoinPop(blk.col * TILE + TILE / 2, blk.row * TILE);
          sfx('coin');
        } else if (blk.type === 'B') {
          // breakable: if running/big just shake; here we break it
          blk.bump = 8;
          breakBrick(blk);
          sfx('bump');
        } else {
          blk.bump = 6; sfx('bump');
        }
      }
    }
  }

  function breakBrick(blk) {
    // remove brick from world
    game.tiles[blk.row][blk.col] = ' ';
    game.solids[blk.row][blk.col] = false;
    blk.used = true;
    const cx = blk.col * TILE + TILE / 2, cy = blk.row * TILE + TILE / 2;
    for (let i = 0; i < 6; i++) {
      game.particles.push({
        x: cx, y: cy, vx: (Math.random() - 0.5) * 5, vy: -3 - Math.random() * 4,
        life: 40, color: '#b5651d', size: 6,
      });
    }
    game.score += 50;
    blk.gone = true;
  }

  // ---------- Enemies ----------
  function updateEnemies() {
    for (const e of game.enemies) {
      if (e.dead) { e.deadTimer++; continue; }

      // gravity
      e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);

      // Shell that's been kicked moves fast; otherwise patrol
      if (e.shell && !e.shellMoving) {
        e.vx *= 0.8;
        if (Math.abs(e.vx) < 0.05) e.vx = 0;
      }

      // Turn at ledges (only when patrolling, not a moving shell)
      if (e.onGround && !(e.shell && e.shellMoving)) {
        const aheadX = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
        const footY = e.y + e.h + 2;
        if (!solidAt(aheadX, footY)) { e.dir *= -1; e.vx = e.dir * Math.abs(e.vx || ENEMY_SPEED); }
      }

      const f = moveBody(e);
      e.onGround = f.bottom;
      if (f.left || f.right) { e.dir *= -1; e.vx = -e.vx; }

      // Shell hits another enemy
      if (e.shell && e.shellMoving) {
        for (const o of game.enemies) {
          if (o !== e && !o.dead && aabb(e, o)) {
            o.dead = true; o.vy = -6; o.stomped = true;
            game.score += 100; sfx('stomp');
            spawnPoints(o.x, o.y, 100);
          }
        }
      }
      e.phase += 0.1;
    }
    // cull dead enemies that fell away
    game.enemies = game.enemies.filter((e) => !(e.dead && (e.deadTimer > 60 || e.y > game.levelH + 60)));

    if (player.invuln <= 0 || true) checkEnemyCollisions();
  }

  function checkEnemyCollisions() {
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (!aabb(player, e)) continue;

      const stomping = player.vy > 1.2 && (player.y + player.h) - e.y < 18;

      if (stomping) {
        player.vy = BOUNCE_VEL;
        player.jumpBuf = 0;
        if (e.type === 'koopa' && !e.shell) {
          // retract into shell
          e.shell = true; e.shellMoving = false; e.vx = 0; e.h = 22;
          e.y += 8;
          game.score += 100; sfx('stomp'); spawnPoints(e.x, e.y, 100);
        } else if (e.shell) {
          // kick the shell (or stop it)
          if (e.shellMoving) { e.shellMoving = false; e.vx = 0; }
          else {
            e.shellMoving = true;
            e.vx = (player.x + player.w / 2 < e.x + e.w / 2) ? SHELL_SPEED : -SHELL_SPEED;
          }
          sfx('kick');
        } else {
          // goomba squashed
          e.dead = true; e.stomped = true; e.vx = 0; e.deadTimer = 0;
          game.score += 100; sfx('stomp'); spawnPoints(e.x, e.y, 100);
        }
      } else if (e.shell && !e.shellMoving) {
        // touching a still shell from the side -> kick it
        e.shellMoving = true;
        e.vx = (player.x + player.w / 2 < e.x + e.w / 2) ? SHELL_SPEED : -SHELL_SPEED;
        sfx('kick');
      } else {
        // got hurt
        if (player.invuln <= 0) hurtPlayer();
      }
    }
  }

  function hurtPlayer() {
    game.lives--;
    if (game.lives <= 0) { killPlayer('The Koopas got the better of you!'); }
    else {
      player.invuln = 120;
      player.vy = -6; player.vx = -player.dir * 3;
      sfx('hurt');
      // small respawn nudge handled by invuln flashing; player keeps position
    }
  }

  function killPlayer(msg) {
    if (player.dead) return;
    player.dead = true; player.deadTimer = 0; player.vy = -11; player.vx = 0;
    game.deathMsg = msg || 'You lost a life.';
    game.lives--;
    sfx('die');
  }

  function updateDeath() {
    player.deadTimer++;
    player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
    player.y += player.vy;
    if (player.deadTimer > 80) {
      if (game.lives <= 0) showOver(game.deathMsg);
      else { loadLevel(game.levelIndex); game.state = State.PLAY; }
    }
  }

  // ---------- Win slide down flagpole ----------
  function startWinSlide() {
    player.winSlide = true;
    player.vx = 0; player.vy = 0;
    player.x = game.finishX - 2;
    sfx('flag');
    game.score += Math.max(0, game.time) * 10 + 400;
  }
  function updateWinSlide() {
    // slide down then walk a touch
    const poleBottom = (() => {
      // find lowest flag/solid under finish col
      let r = 0;
      const col = Math.floor(game.finishX / TILE);
      for (r = 0; r < game.rows; r++) if (game.solids[r] && game.solids[r][col]) break;
      return r * TILE - player.h;
    })();
    if (player.y < poleBottom - 4) { player.y += 4; }
    else {
      player.slideDone = (player.slideDone || 0) + 1;
      player.x += 1.5;
      if (player.slideDone > 60) {
        // advance
        if (game.levelIndex < LEVELS.length - 1) {
          showClear();
        } else {
          showWin();
        }
      }
    }
    updateCamera();
  }

  // ---------- Coins / blocks / particles ----------
  function updateCoins() {
    for (const c of game.coinsList) {
      if (c.got) continue;
      c.t += 0.15;
      if (rectOverlap(player.x, player.y, player.w, player.h, c.x - 4, c.y - 4, 16, 22)) {
        c.got = true; collectCoin(false); spawnCoinPop(c.x + 4, c.y); sfx('coin');
      }
    }
  }
  function collectCoin(fromBlock) {
    game.coins++; game.score += 200;
    if (game.coins >= 100) { game.coins = 0; game.lives++; sfx('1up'); }
  }
  function updateBlocks() {
    for (const b of game.blocks) if (b.bump > 0) b.bump -= 1;
  }
  function updateParticles() {
    for (const p of game.particles) {
      p.vy += 0.3; p.x += p.vx; p.y += p.vy; p.life--;
      if (p.text) p.y -= 0.6;
    }
    game.particles = game.particles.filter((p) => p.life > 0);
  }
  function spawnCoinPop(x, y) {
    game.particles.push({ x, y, vx: 0, vy: -6, life: 26, coin: true, size: 14 });
  }
  function spawnPoints(x, y, n) {
    game.particles.push({ x: x + 6, y: y - 4, vx: 0, vy: -1, life: 40, text: '' + n, color: '#fff' });
  }

  function updateCamera() {
    const target = clamp(player.x - VW * 0.38, 0, Math.max(0, game.levelW - VW));
    game.camX += (target - game.camX) * 0.16;
    if (game.camX < 0) game.camX = 0;
  }

  // ============================================================
  //  RENDER
  // ============================================================
  function render() {
    const def = game.def || LEVELS[0];
    // sky
    const grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, shade(def.sky, 12));
    grad.addColorStop(1, def.sky);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    drawClouds();
    drawHills(def);

    ctx.save();
    ctx.translate(-Math.round(game.camX), 0);

    drawTiles(def);
    drawCoins();
    drawBlocksOverlay();
    drawEnemies();
    drawPlayer();
    drawParticles();

    ctx.restore();

    drawHUD();
  }

  function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const off = (game.camX * 0.3) % 400;
    for (let i = -1; i < 4; i++) {
      const cx = i * 320 - off + 80;
      cloud(cx, 60); cloud(cx + 160, 110);
    }
  }
  function cloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, 7); ctx.arc(x + 18, y + 4, 20, 0, 7);
    ctx.arc(x + 40, y, 16, 0, 7); ctx.rect(x, y, 40, 18);
    ctx.fill();
  }
  function drawHills(def) {
    ctx.fillStyle = shade(def.grass, -18);
    const off = (game.camX * 0.5) % 480;
    for (let i = -1; i < 4; i++) {
      const hx = i * 360 - off + 40;
      ctx.beginPath();
      ctx.moveTo(hx - 70, VH); ctx.quadraticCurveTo(hx, VH - 90, hx + 70, VH);
      ctx.fill();
    }
  }

  function drawTiles(def) {
    const startC = Math.max(0, Math.floor(game.camX / TILE) - 1);
    const endC = Math.min(game.cols, Math.ceil((game.camX + VW) / TILE) + 1);
    for (let r = 0; r < game.rows; r++) {
      for (let c = startC; c < endC; c++) {
        const ch = game.tiles[r][c];
        const x = c * TILE, y = r * TILE;
        switch (ch) {
          case 'X': drawGround(x, y, def, r, c); break;
          case '=': drawPlatform(x, y, def); break;
          case 'p': drawPipeBody(x, y); break;
          case 'P': drawPipeTop(x, y); break;
          case 'F': drawPoleSeg(x, y); break;
          case '|': drawFlag(x, y); break;
        }
      }
    }
  }

  function drawGround(x, y, def, r, c) {
    // grass top if nothing solid above
    const top = r === 0 || !game.solids[r - 1] || !game.solids[r - 1][c];
    ctx.fillStyle = def.dirt; ctx.fillRect(x, y, TILE, TILE);
    // texture specks
    ctx.fillStyle = shade(def.dirt, -14);
    ctx.fillRect(x + 6, y + 10, 4, 4); ctx.fillRect(x + 20, y + 20, 4, 4);
    ctx.fillRect(x + 14, y + 6, 3, 3);
    if (top) {
      ctx.fillStyle = def.grass; ctx.fillRect(x, y, TILE, 9);
      ctx.fillStyle = shade(def.grass, 16); ctx.fillRect(x, y, TILE, 3);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
  }

  function drawPlatform(x, y, def) {
    ctx.fillStyle = '#c98a3a'; ctx.fillRect(x, y, TILE, TILE - 8);
    ctx.fillStyle = '#7a4f1c'; ctx.fillRect(x, y + TILE - 12, TILE, 4);
    ctx.fillStyle = shade(def.grass, 10); ctx.fillRect(x, y, TILE, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 9);
  }

  function drawPipeTop(x, y) {
    ctx.fillStyle = '#2fae3e'; ctx.fillRect(x - 4, y, TILE + 8, 12);
    ctx.fillStyle = '#1e7a2c'; ctx.fillRect(x - 4, y + 10, TILE + 8, 4);
    ctx.fillStyle = '#7be08a'; ctx.fillRect(x - 2, y + 2, 6, 8);
    ctx.fillStyle = '#2fae3e'; ctx.fillRect(x, y + 14, TILE, 0);
  }
  function drawPipeBody(x, y) {
    ctx.fillStyle = '#2fae3e'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#1e7a2c'; ctx.fillRect(x, y, 5, TILE);
    ctx.fillStyle = '#7be08a'; ctx.fillRect(x + 6, y, 5, TILE);
    ctx.fillStyle = '#1e7a2c'; ctx.fillRect(x + TILE - 5, y, 5, TILE);
  }

  function drawPoleSeg(x, y) {
    ctx.fillStyle = '#bdbdbd'; ctx.fillRect(x + TILE / 2 - 3, y, 6, TILE);
    ctx.fillStyle = '#fff'; ctx.fillRect(x + TILE / 2 - 3, y, 2, TILE);
    if (y < TILE * 2) { ctx.fillStyle = '#2fae3e'; ctx.beginPath(); ctx.arc(x + TILE/2, y, 7, 0, 7); ctx.fill(); }
  }
  function drawFlag(x, y) {
    ctx.fillStyle = '#9e6b2f'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#7a4f1c'; ctx.fillRect(x, y, 4, TILE);
  }

  function drawBlocksOverlay() {
    for (const b of game.blocks) {
      if (b.gone) continue;
      const x = b.col * TILE, y = b.row * TILE - (b.bump > 0 ? Math.sin((8 - b.bump) / 8 * Math.PI) * 8 : 0);
      if (b.type === '?') {
        if (b.used) {
          ctx.fillStyle = '#9a6b25'; ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#7a4f1c'; ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        } else {
          ctx.fillStyle = '#f2a629'; ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#c47e10'; ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#ffcf52'; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = '#c47e10'; ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
          // rivets + question mark
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('?', x + TILE / 2, y + TILE / 2 + 1);
          ctx.fillStyle = '#fff2b0'; ctx.fillRect(x + 3, y + 3, 3, 3); ctx.fillRect(x + TILE - 6, y + 3, 3, 3);
          ctx.fillRect(x + 3, y + TILE - 6, 3, 3); ctx.fillRect(x + TILE - 6, y + TILE - 6, 3, 3);
        }
      } else if (b.type === 'B' && !b.used) {
        ctx.fillStyle = '#b5651d'; ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#7a4310'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y + TILE/2); ctx.lineTo(x + TILE, y + TILE/2);
        ctx.moveTo(x + TILE/2, y); ctx.lineTo(x + TILE/2, y + TILE/2);
        ctx.moveTo(x + TILE/4, y + TILE/2); ctx.lineTo(x + TILE/4, y + TILE);
        ctx.moveTo(x + 3*TILE/4, y + TILE/2); ctx.lineTo(x + 3*TILE/4, y + TILE);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.strokeRect(x+.5,y+.5,TILE-1,TILE-1);
      }
    }
  }

  function drawCoins() {
    for (const c of game.coinsList) {
      if (c.got) continue;
      const w = Math.abs(Math.cos(c.t)) * 9 + 3;
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(c.x + (9 - w) / 2 + 4, c.y, w, 16);
      ctx.fillStyle = '#c9920e';
      ctx.fillRect(c.x + (9 - w) / 2 + 4 + w/2 - 1, c.y + 3, 2, 10);
    }
  }

  function drawEnemies() {
    for (const e of game.enemies) {
      if (e.dead && e.stomped && e.type === 'goomba') {
        // squashed
        ctx.fillStyle = '#9a5a2a';
        ctx.fillRect(e.x, e.y + e.h - 8, e.w, 8);
        continue;
      }
      if (e.dead) {
        ctx.save();
        ctx.translate(e.x + e.w/2, e.y + e.h/2);
        ctx.scale(1, -1);
        ctx.translate(-e.w/2, -e.h/2);
        e.type === 'koopa' ? drawKoopa(0, 0, e) : drawGoomba(0, 0, e);
        ctx.restore();
        continue;
      }
      e.type === 'koopa' ? drawKoopa(e.x, e.y, e) : drawGoomba(e.x, e.y, e);
    }
  }

  function drawGoomba(x, y, e) {
    const wob = Math.sin(e.phase) * 1.5;
    // body
    ctx.fillStyle = '#9a5a2a';
    ctx.beginPath(); ctx.ellipse(x + e.w/2, y + e.h/2 + 2, e.w/2, e.h/2 - 2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#c98a52';
    ctx.beginPath(); ctx.ellipse(x + e.w/2, y + 9, e.w/2 - 1, 8, 0, 0, 7); ctx.fill();
    // feet
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(x + 2, y + e.h - 5 + wob, 8, 5);
    ctx.fillRect(x + e.w - 10, y + e.h - 5 - wob, 8, 5);
    // eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 5, y + 6, 6, 7); ctx.fillRect(x + e.w - 11, y + 6, 6, 7);
    ctx.fillStyle = '#000';
    const ed = e.dir > 0 ? 2 : 0;
    ctx.fillRect(x + 7 + ed, y + 8, 3, 4); ctx.fillRect(x + e.w - 9 + ed, y + 8, 3, 4);
    // angry brows
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(x + 4, y + 4, 7, 2); ctx.fillRect(x + e.w - 11, y + 4, 7, 2);
  }

  function drawKoopa(x, y, e) {
    if (e.shell) {
      // shell
      ctx.fillStyle = '#2fae3e';
      ctx.beginPath(); ctx.ellipse(x + e.w/2, y + e.h/2, e.w/2, e.h/2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#1e7a2c';
      ctx.beginPath(); ctx.ellipse(x + e.w/2, y + e.h/2, e.w/2 - 4, e.h/2 - 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#bfe8c4';
      for (let i=0;i<5;i++){ ctx.fillRect(x + 4 + (i%3)*6, y + 6 + Math.floor(i/3)*8, 4, 4); }
      ctx.strokeStyle = '#15521e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x + e.w/2, y + e.h/2, e.w/2 - 2, e.h/2 - 2, 0, 0, 7); ctx.stroke();
      if (e.shellMoving) { // motion lines
        ctx.strokeStyle = 'rgba(255,255,255,.6)';
        const s = e.vx > 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(x + e.w/2 + s*16, y+8); ctx.lineTo(x+e.w/2+s*22, y+8);
        ctx.moveTo(x + e.w/2 + s*16, y+16); ctx.lineTo(x+e.w/2+s*24, y+16);
        ctx.stroke();
      }
      return;
    }
    const wob = Math.sin(e.phase) * 1.5;
    const fl = e.dir < 0;
    // shell on back
    ctx.fillStyle = '#2fae3e';
    ctx.beginPath(); ctx.ellipse(x + e.w/2, y + 18, e.w/2, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1e7a2c';
    ctx.beginPath(); ctx.ellipse(x + e.w/2, y + 18, e.w/2 - 3, 8, 0, 0, 7); ctx.fill();
    // body / belly
    ctx.fillStyle = '#f4d03f';
    ctx.fillRect(x + 4, y + 22, e.w - 8, 6);
    // head
    ctx.fillStyle = '#f4d03f';
    const hx = fl ? x + 1 : x + e.w - 11;
    ctx.beginPath(); ctx.ellipse(hx + 5, y + 8, 7, 7, 0, 0, 7); ctx.fill();
    // beak
    ctx.fillStyle = '#e8843a';
    ctx.fillRect(fl ? hx - 3 : hx + 9, y + 8, 5, 4);
    // eye
    ctx.fillStyle = '#fff'; ctx.fillRect(hx + 3, y + 4, 5, 6);
    ctx.fillStyle = '#000'; ctx.fillRect(hx + (fl ? 3 : 5), y + 6, 2, 3);
    // feet
    ctx.fillStyle = '#e8843a';
    ctx.fillRect(x + 4, y + e.h - 4 + wob, 7, 4);
    ctx.fillRect(x + e.w - 11, y + e.h - 4 - wob, 7, 4);
  }

  function drawPlayer() {
    const p = player;
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0 && !p.dead) return; // blink

    const x = p.x, y = p.y;
    const fl = p.dir < 0;
    const step = Math.floor(p.walkPhase) % 2;
    const legSwing = (p.onGround && Math.abs(p.vx) > 0.4) ? (step ? 3 : -3) : 0;
    const jumping = !p.onGround;

    ctx.save();
    // shadow
    if (!p.dead) {
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      ctx.beginPath(); ctx.ellipse(x + p.w/2, y + p.h + 2, p.w/2, 3, 0, 0, 7); ctx.fill();
    }

    // legs (overalls blue)
    ctx.fillStyle = '#2a5db0';
    if (jumping) {
      ctx.fillRect(x + 3, y + 18, 7, 9);
      ctx.fillRect(x + p.w - 12, y + 16, 8, 8);
    } else {
      ctx.fillRect(x + 3 + (fl?legSwing:-legSwing), y + 20, 7, 8);
      ctx.fillRect(x + p.w - 11 - (fl?legSwing:-legSwing), y + 20, 7, 8);
    }
    // shoes
    ctx.fillStyle = '#5a2d0c';
    if (jumping) {
      ctx.fillRect(x + 1, y + 25, 10, 4); ctx.fillRect(x + p.w - 13, y + 22, 11, 4);
    } else {
      ctx.fillRect(x + 1 + (fl?legSwing:-legSwing), y + 26, 10, 4);
      ctx.fillRect(x + p.w - 12 - (fl?legSwing:-legSwing), y + 26, 10, 4);
    }

    // torso — red shirt + blue overalls
    ctx.fillStyle = '#e52521';
    ctx.fillRect(x + 2, y + 11, p.w - 4, 11);
    ctx.fillStyle = '#2a5db0';
    ctx.fillRect(x + 5, y + 15, p.w - 10, 8);
    // overall straps + button
    ctx.fillStyle = '#f5d020'; ctx.fillRect(x + 8, y + 14, 2, 2); ctx.fillRect(x + p.w - 10, y + 14, 2, 2);

    // arm
    ctx.fillStyle = '#e52521';
    if (jumping) ctx.fillRect(fl ? x : x + p.w - 5, y + 9, 5, 7);
    else ctx.fillRect(fl ? x + 1 : x + p.w - 6, y + 13, 5, 7);
    // glove
    ctx.fillStyle = '#fff';
    ctx.fillRect(fl ? x : x + p.w - 5, jumping ? y + 7 : y + 18, 5, 4);

    // head — skin
    ctx.fillStyle = '#f1a96a';
    ctx.fillRect(x + 4, y + 2, p.w - 8, 11);
    // hat — red
    ctx.fillStyle = '#e52521';
    ctx.fillRect(x + 2, y, p.w - 4, 5);
    ctx.fillRect(fl ? x : x + p.w - 10, y + 3, 10, 3); // brim
    ctx.fillStyle = '#fff'; // emblem
    ctx.beginPath(); ctx.arc(x + p.w/2, y + 2, 2.4, 0, 7); ctx.fill();
    // hair / sideburn
    ctx.fillStyle = '#3a1e0c';
    ctx.fillRect(fl ? x + p.w - 6 : x + 4, y + 6, 3, 5);
    // mustache
    ctx.fillStyle = '#3a1e0c';
    ctx.fillRect(fl ? x + 4 : x + p.w - 11, y + 9, 7, 3);
    // eye
    ctx.fillStyle = '#000';
    ctx.fillRect(fl ? x + 5 : x + p.w - 8, y + 5, 2, 4);
    // nose
    ctx.fillStyle = '#e08a55';
    ctx.fillRect(fl ? x + 3 : x + p.w - 6, y + 8, 4, 3);

    ctx.restore();
  }

  function drawParticles() {
    for (const p of game.particles) {
      if (p.coin) {
        ctx.fillStyle = '#ffd34d';
        const w = Math.abs(Math.cos(p.life * 0.4)) * 9 + 3;
        ctx.fillRect(p.x - w/2, p.y, w, 14);
      } else if (p.text) {
        ctx.fillStyle = p.color; ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = Math.min(1, p.life / 20);
        ctx.fillText(p.text, p.x, p.y);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
      }
    }
  }

  // ---------- HUD ----------
  function drawHUD() {
    ctx.save();
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0, 0, VW, 26);

    ctx.fillStyle = '#fff';
    ctx.fillText('SCORE ' + pad(game.score, 6), 14, 6);

    // coin icon
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(184, 7, 9, 13);
    ctx.fillStyle = '#c9920e'; ctx.fillRect(187, 10, 3, 7);
    ctx.fillStyle = '#fff';
    ctx.fillText('×' + pad(game.coins, 2), 198, 6);

    ctx.textAlign = 'center';
    ctx.fillText((game.def ? game.def.name : ''), VW / 2, 6);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText('LIVES ' + game.lives + '   TIME ' + pad(game.time, 3), VW - 14, 6);
    ctx.restore();
  }

  // ============================================================
  //  AUDIO  (tiny WebAudio blips — no files)
  // ============================================================
  let actx = null;
  function audio() { if (!actx) try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} return actx; }
  function tone(freq, dur, type, vol, slideTo) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
    g.gain.value = vol || 0.06;
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  }
  function sfx(name) {
    switch (name) {
      case 'jump':  tone(420, 0.16, 'square', 0.05, 720); break;
      case 'coin':  tone(988, 0.07, 'square', 0.05); setTimeout(() => tone(1319, 0.12, 'square', 0.05), 70); break;
      case 'stomp': tone(180, 0.12, 'square', 0.06, 90); break;
      case 'kick':  tone(300, 0.08, 'square', 0.05, 140); break;
      case 'bump':  tone(120, 0.1, 'square', 0.05); break;
      case 'hurt':  tone(440, 0.2, 'sawtooth', 0.06, 110); break;
      case 'die':   tone(523, 0.15, 'square', 0.06); setTimeout(()=>tone(330,0.3,'square',0.06,110),150); break;
      case 'flag':  [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.16,'square',0.05),i*120)); break;
      case '1up':   [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>tone(f,0.12,'square',0.05),i*80)); break;
    }
  }

  // ============================================================
  //  SCREENS / FLOW
  // ============================================================
  const screens = {
    start: document.getElementById('screen-start'),
    over: document.getElementById('screen-over'),
    win: document.getElementById('screen-win'),
    clear: document.getElementById('screen-clear'),
  };
  function hideAll() { Object.values(screens).forEach((s) => s.classList.add('hidden')); }

  function startGame() {
    audio(); if (actx && actx.state === 'suspended') actx.resume();
    game.score = 0; game.coins = 0; game.lives = 3; game.levelIndex = 0;
    hideAll();
    loadLevel(0);
    game.state = State.PLAY;
  }
  function showOver(msg) {
    game.state = State.OVER;
    document.getElementById('over-msg').textContent = msg + ' Final score: ' + game.score + '.';
    hideAll(); screens.over.classList.remove('hidden');
  }
  function showWin() {
    game.state = State.WIN;
    document.getElementById('win-msg').textContent =
      'You cleared all ' + LEVELS.length + ' worlds with ' + game.score + ' points and ' + game.lives + ' lives to spare. A true plumbing legend!';
    hideAll(); screens.win.classList.remove('hidden');
    sfx('1up');
  }
  function showClear() {
    game.state = State.CLEAR;
    game.stateTimer = 0;
    document.getElementById('clear-msg').textContent =
      (game.def ? game.def.name : '') + ' complete!  Score: ' + game.score;
    hideAll(); screens.clear.classList.remove('hidden');
  }
  function togglePause() {
    if (game.state === State.PLAY) { game.state = State.PAUSE; flashPause(true); }
    else if (game.state === State.PAUSE) { game.state = State.PLAY; flashPause(false); }
  }
  let pauseEl = null;
  function flashPause(on) {
    if (on) {
      pauseEl = document.createElement('div');
      pauseEl.className = 'overlay'; pauseEl.id = 'screen-pause';
      pauseEl.innerHTML = '<h2 style="color:#9fd">PAUSED</h2><p>Press <b>P</b> to resume.</p>';
      document.getElementById('stage').appendChild(pauseEl);
    } else if (pauseEl) { pauseEl.remove(); pauseEl = null; }
  }

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-retry').addEventListener('click', startGame);
  document.getElementById('btn-replay').addEventListener('click', startGame);

  // ============================================================
  //  HELPERS
  // ============================================================
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad(n, len) { n = Math.max(0, Math.floor(n)); let s = '' + n; while (s.length < len) s = '0' + s; return s; }
  function aabb(a, b) { return rectOverlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h); }
  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function shade(hex, amt) {
    const c = hex.replace('#', '');
    let r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    r = clamp(r + amt, 0, 255); g = clamp(g + amt, 0, 255); b = clamp(b + amt, 0, 255);
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  // ============================================================
  //  MAIN LOOP  (fixed timestep)
  // ============================================================
  let acc = 0, last = performance.now();
  const STEP = 1000 / 60;
  function loop(now) {
    acc += Math.min(now - last, 100); last = now;
    while (acc >= STEP) {
      if (game.state === State.CLEAR) {
        game.stateTimer++;
        if (game.stateTimer > 90) { game.levelIndex++; hideAll(); loadLevel(game.levelIndex); game.state = State.PLAY; }
      } else {
        update();
      }
      acc -= STEP;
    }
    if (game.tiles.length) render();
    else { ctx.fillStyle = LEVELS[0].sky; ctx.fillRect(0,0,VW,VH); }
    requestAnimationFrame(loop);
  }

  // Pre-load first level so the start screen has a backdrop
  loadLevel(0);
  game.state = State.START;
  requestAnimationFrame(loop);
})();
