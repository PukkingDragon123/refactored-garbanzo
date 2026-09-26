// Species-specific behaviours layered on the generic brain (animal.ts).

import { ACTS, Animal, HOOKS, SPECIALS, catchPrey } from './animal';
import { rand } from '../../core/math';

const sp = (id: string, acts: Record<string, (a: Animal, dt: number) => boolean | void>) => {
  SPECIALS[id] = { ...(SPECIALS[id] ?? {}), ...acts };
};

// ------------------------------------------------------------------ Tunnel Delver: colony, sentinels, burrows
sp('delver', {
  burrow(a, dt) {
    const b = a.findPOI('burrow', 400);
    if (!a.mem.in) {
      if (!b) return ACTS.flee(a, dt);
      a.anim = 'run';
      if (a.groundTo(b.x, a.eco.run, dt) || a.mem.blocked) {
        a.mem.in = 1;
        a.anim = 'burrow';
        a.host.sfx('dig', a.x, 0.3, 1.4);
      }
      return;
    }
    a.vx = 0;
    // vanish into the burrow, then peek out after the danger passes
    a.hidden = Math.min(1, a.hidden + dt * 3);
    a.anim = 'burrow';
    if (a.fear < 0.12 && a.actT > 5) {
      a.hidden = 0.45;
      a.setAct('sentinel', rand.range(3, 6));
      a.showEmote('question', 1.2);
    }
  },
  sentinel(a) {
    a.vx = 0;
    a.anim = 'peek';
    a.hidden = Math.max(0, a.hidden - 0.02);
    const k = Math.floor(a.actT / 1.4);
    if (k !== a.mem.k) { a.mem.k = k; a.facing = -a.facing; }
    // a sentinel that spots danger raises the alarm for everyone
    if (a.noticed && a.aw > 0.9 && !a.mem.alarmed && a.habit < 0.5) {
      a.mem.alarmed = 1;
      a.call('alarm');
      a.fear = Math.max(a.fear, 0.6);
    }
  },
});
HOOKS.delver = {
  onThreat(a) {
    a.setAct('burrow', rand.range(6, 11));
    return true;
  },
};

// ------------------------------------------------------------------ Shieldback: roll into an armoured ball
sp('shieldback', {
  ball(a) {
    a.vx = 0;
    a.anim = a.actT < 0.3 ? 'alert' : 'ball';
    if (a.actT > 0.3 && !a.mem.rolled) { a.mem.rolled = 1; a.host.sfx('callGrunt', a.x, 0.3, 1.3); }
    if (a.fear < 0.15 && a.actT > 5) {
      a.showEmote('sweat', 1);
      return false;
    }
  },
});

// ------------------------------------------------------------------ Quillhog: rattle quills, then charge backwards
sp('quillhog', {
  threat(a) {
    const t = a.threat;
    a.vx = 0;
    if (t) a.facing = t.x > a.x ? -1 : 1; // turns its back (quills) toward the threat
    a.anim = a.actT < 1.2 ? 'quills' : 'threat';
    if (Math.floor(a.actT * 3) !== a.mem.r) { a.mem.r = Math.floor(a.actT * 3); a.host.sfx('callRattle', a.x, 0.45, 0.9 + rand.next() * 0.2); }
    if (!a.mem.shown) { a.mem.shown = 1; a.showEmote('anger', 1.4, true); }
    const p = a.host.player;
    if (t?.kind === 'player' && Math.abs(p.x - a.x) < 36 && a.actT > 1) {
      a.setAct('attack', 1.2);
    } else if (a.actT > 3.2) return false;
  },
  attack(a, dt) {
    const p = a.host.player;
    a.anim = 'threat';
    a.groundTo(p.x, a.eco.run, dt);
    a.facing = p.x > a.x ? -1 : 1;
    if (Math.abs(p.x - a.x) < 12) {
      a.host.caught(a, 1);
      a.setAct('flee', 3);
    }
    if (a.actT > 1.2) return false;
  },
});

// ------------------------------------------------------------------ Sprint Viper: prowl, crest display, sprint
sp('sprinter', {
  prowl(a, dt) {
    if (a.mem.tx === undefined || a.mem.blocked) { a.mem.tx = a.home[0] + rand.next() * (a.home[1] - a.home[0]); a.mem.blocked = 0; }
    a.anim = 'walk';
    a.jaw = Math.sin(a.actT * 9) > 0.8 ? 0.2 : 0;
    if (a.groundTo(a.mem.tx, a.eco.walk, dt)) a.mem.tx = a.home[0] + rand.next() * (a.home[1] - a.home[0]);
  },
});

// ------------------------------------------------------------------ Flicker Marten: serpent fighter
sp('flicker', {
  prowl(a, dt) {
    if (a.mem.tx === undefined || a.mem.blocked) { a.mem.tx = a.x + rand.range(-120, 120); a.mem.blocked = 0; a.mem.stop = rand.range(1, 2.5); }
    if (a.mem.stop > 0 && Math.abs(a.x - a.mem.tx) < 30) { a.mem.stop -= dt; a.anim = 'alert'; a.vx = 0; return; }
    a.anim = 'walk';
    if (a.groundTo(a.mem.tx, a.eco.walk * 2, dt)) { a.mem.tx = a.x + rand.range(-120, 120); a.mem.stop = rand.range(0.6, 2); }
  },
  leap(a, dt) {
    if (!a.mem.h) { a.mem.h = 1; a.mem.vy = -150; a.mem.y0 = a.y; a.mem.dx = a.facing * 90; }
    a.mem.vy += 460 * dt;
    a.y += a.mem.vy * dt;
    a.x += a.mem.dx * dt;
    a.anim = 'leap';
    if (a.y >= a.mem.y0 && a.mem.vy > 0) { a.y = a.mem.y0; a.settle(); return false; }
  },
  hunt(a, dt) {
    const prey = a.prey;
    if (!prey || prey.dead || prey.gone) return false;
    const d = prey.x - a.x;
    if (Math.abs(d) > 34) {
      a.anim = 'run';
      a.groundTo(prey.x - Math.sign(d) * 26, a.eco.run * 0.8, dt);
      if (a.mem.blocked) return false;
      return;
    }
    // the fight: dodge strikes, dart in to bite
    a.face(prey.x);
    if (!a.mem.fight) {
      a.mem.fight = 1;
      a.mem.round = 0;
      a.showEmote('anger', 1.2, true);
      a.host.sounds.push({ x: a.x, y: a.y, kind: 'fight', src: a, species: a.species, radius: 280, t: a.host.time + 0.0001 });
      prey.fear = 1;
      prey.anger = 1;
      prey.setAct('threat', 6);
      prey.threat = { kind: 'animal', x: a.x, y: a.y, a };
    }
    a.act = 'fight';
    const ph = (a.actT * 2.2) % 1;
    a.anim = ph < 0.5 ? 'fight' : 'leap';
    a.x += Math.sin(a.actT * 13) * 18 * dt;
    if (Math.floor(a.actT * 2.2) !== a.mem.round) {
      a.mem.round = Math.floor(a.actT * 2.2);
      a.host.sfx(a.mem.round % 2 ? 'callHiss' : 'callGrowl', a.x, 0.45, 1.1);
      prey.jaw = 1;
    }
    if (a.actT > 5.5) {
      if (rand.next() < 0.55) catchPrey(a, prey);
      else { prey.fear = 1; prey.setAct('flee', 6); a.hunger *= 0.6; }
      return false;
    }
  },
});
SPECIALS.flicker.fight = SPECIALS.flicker.hunt;
HOOKS.flicker = {
  decide(a) {
    // bold and curious: sometimes darts right up to a still photographer, sniffs, and bolts
    if (a.noticed && a.habit > 0.4 && a.curio > 0.5 && rand.next() < 0.3) { a.setAct('investigate', 4); return true; }
    return false;
  },
};

// ------------------------------------------------------------------ Forest Boneface: herd, calves at play, protective charge
sp('boneface', {
  threat(a) {
    const t = a.threat;
    a.vx = 0;
    if (t) a.face(t.x);
    a.anim = 'alert';
    if (!a.mem.done) {
      a.mem.done = 1;
      a.call('threat');
      a.showEmote('anger', 1.6, true);
      // calves hurry behind the adults
      for (const m of a.herd?.members ?? []) if (m.juvenile) { m.fear = Math.max(m.fear, 0.7); m.threat = t; m.setAct('flee', 3); }
    }
    if (a.actT > 1.6 && t?.kind === 'player' && Math.abs(a.host.player.x - a.x) < 110) a.setAct('attack', 2);
    else if (a.actT > 3) return false;
  },
  attack(a, dt) {
    const p = a.host.player;
    a.anim = 'charge';
    a.face(p.x);
    a.groundTo(p.x, a.eco.run, dt);
    if (Math.floor(a.actT * 4) !== a.mem.s) { a.mem.s = Math.floor(a.actT * 4); a.host.sfx('stepLeaves', a.x, 0.7, 0.6); }
    if (Math.abs(p.x - a.x) < 20 && Math.abs(p.y - a.y) < 30) { a.host.caught(a, 2); a.anger = 0; a.setAct('rest', 3); return false; }
    if (a.actT > 2 || a.mem.blocked) { a.anger = 0.2; return false; }
  },
  play(a, dt) {
    if (!a.juvenile) return ACTS.wander(a, dt);
    const mates = a.herd?.members.filter(m => m !== a && m.juvenile) ?? [];
    const m = mates[0] ?? a.herd?.leader;
    if (!m) return false;
    if (a.mem.tx === undefined || rand.next() < dt * 0.9) a.mem.tx = m.x + rand.range(-30, 30);
    a.anim = Math.abs(a.mem.tx - a.x) > 5 ? 'run' : 'play';
    a.groundTo(a.mem.tx, a.eco.walk * 3, dt);
    if (rand.next() < dt * 0.3) { a.showEmote(rand.next() < 0.5 ? 'music' : 'heart', 1); a.host.sfx('callGrunt', a.x, 0.25, 1.8); }
  },
});

// ------------------------------------------------------------------ Nutcracker: flock with a sentinel
sp('nutcracker', {
  sentinel(a, dt) {
    const pr = a.findPOI('perch', 260);
    if (pr && !a.mem.there) {
      a.anim = 'fly';
      if (a.medium !== 'air') { a.medium = 'air'; a.vy = -60; }
      if (a.flyTo(pr.x, pr.y, a.eco.run * 0.5, dt)) { a.mem.there = 1; a.x = pr.x; a.y = pr.y; a.medium = 'ground'; a.vx = a.vy = 0; }
      return;
    }
    a.vx = 0;
    a.anim = 'alert';
    const k = Math.floor(a.actT / 1.2);
    if (k !== a.mem.k) { a.mem.k = k; a.facing = -a.facing; }
    if ((a.noticed && a.habit < 0.4) || a.fear > 0.3) {
      if (!a.mem.alarmed) { a.mem.alarmed = 1; a.call('alarm'); }
    }
  },
  hop(a, dt) {
    if (a.mem.tx === undefined) a.mem.tx = a.x + rand.range(-40, 40);
    a.anim = 'hop';
    if (a.groundTo(a.mem.tx, a.eco.walk, dt) || a.mem.blocked) return false;
  },
  forage(a, dt) {
    if (a.medium === 'air') { a.medium = 'ground'; a.settle(); }
    return ACTS.forage(a, dt);
  },
});

// ------------------------------------------------------------------ Crag Auk: nests, fishing dives, mobbing
sp('cragauk', {
  nest(a, dt) {
    const n = a.goal?.poi ?? a.findPOI('nest', 500);
    if (!n) return ACTS.fly(a, dt);
    if (!a.mem.there) {
      if (a.medium !== 'air') { a.medium = 'air'; a.vy = -60; }
      a.anim = 'fly';
      if (a.flyTo(n.x, n.y, a.eco.run * 0.55, dt)) { a.mem.there = 1; a.x = n.x; a.y = n.y; a.medium = 'ground'; a.vx = a.vy = 0; a.poi = n; }
      return;
    }
    a.anim = a.actT % 6 < 4 ? 'idle' : 'preen';
  },
  fish(a, dt) {
    const w = a.goal?.poi ?? a.findPOI('water', 600);
    const wy = a.host.waterY;
    if (!w || wy === null) return ACTS.fly(a, dt);
    if (!a.mem.stage) {
      if (a.medium !== 'air') { a.medium = 'air'; a.vy = -70; }
      a.anim = 'fly';
      if (a.flyTo(w.x, wy - 50, a.eco.run * 0.6, dt)) a.mem.stage = 1;
      return;
    }
    if (a.mem.stage === 1) {
      a.anim = 'dive';
      a.flyTo(w.x + a.facing * 10, wy + 20, a.eco.run * 1.3, dt, 600);
      if (a.y > wy) { a.mem.stage = 2; a.medium = 'water'; a.host.splash(a.x, wy, 0.6); }
      return;
    }
    if (a.mem.stage === 2) {
      a.anim = 'swim';
      a.swimTo(a.x + a.facing * 60, wy + 40, a.eco.walk * 3, dt);
      if (a.actT > 3.5) { a.mem.stage = 3; a.hunger = Math.max(0, a.hunger - 0.4); }
      return;
    }
    a.anim = 'fly';
    if (a.y < wy - 2 && a.medium === 'water') { a.medium = 'air'; a.host.splash(a.x, wy, 0.4); }
    a.flyTo(a.x + a.facing * 30, wy - 120, a.eco.run * 0.6, dt, 300);
    if (a.y < wy - 100) return false;
  },
  mob(a, dt) {
    const t = a.threat?.a;
    if (!t || t.dead || t.gone) return false;
    if (a.medium !== 'air') { a.medium = 'air'; a.vy = -80; }
    const ang = a.actT * 3 + a.uid;
    a.anim = 'fly';
    a.flyTo(t.x + Math.cos(ang) * 30, t.y - 24 + Math.sin(ang) * 14, a.eco.run, dt, 500);
    if (Math.floor(a.actT * 1.5) !== a.mem.c) { a.mem.c = Math.floor(a.actT * 1.5); a.call('alarm'); }
    // enough mobbing drives the viper off
    t.fear = Math.min(1, t.fear + dt * 0.08);
    if (t.fear > 0.6 && t.act !== 'flee') { t.threat = { kind: 'animal', x: a.x, y: a.y, a }; t.setAct('flee', 5); }
    if (a.actT > a.actDur) return false;
  },
});

// ------------------------------------------------------------------ Torrent Dipper: bobbing and underwater walks
sp('torrentdipper', {
  bob(a, dt) {
    const r = a.goal?.poi ?? a.findPOI('rock', 300);
    if (r && !a.mem.there) {
      if (a.medium !== 'air') { a.medium = 'air'; a.vy = -40; }
      a.anim = 'fly';
      if (a.flyTo(r.x, r.y, a.eco.run * 0.5, dt)) { a.mem.there = 1; a.x = r.x; a.y = r.y; a.medium = 'ground'; a.vx = a.vy = 0; }
      return;
    }
    a.anim = 'bob';
    a.vx = 0;
  },
  fish(a, dt) {
    const wy = a.host.waterY;
    if (wy === null) return false;
    if (a.medium !== 'water') {
      a.anim = 'fly';
      if (a.medium !== 'air') { a.medium = 'air'; a.vy = -30; }
      if (a.flyTo(a.x + a.facing * 20, wy + 6, a.eco.run * 0.4, dt, 300) || a.y > wy) { a.medium = 'water'; a.host.splash(a.x, wy, 0.3); }
      return;
    }
    a.anim = 'swim';
    const floor = a.host.terrain.groundY(a.x) - 2;
    a.swimTo(a.x + a.facing * 40, floor, a.eco.walk, dt);
    if (rand.next() < dt * 0.4) a.facing = -a.facing;
    if (a.actT > 5) { a.medium = 'air'; a.vy = -90; a.host.splash(a.x, wy, 0.3); return false; }
  },
});

// ------------------------------------------------------------------ Thunder Stork: stalk the shallows, strike at serpents
sp('snakestork', {
  stalk(a, dt) {
    const prey = a.prey;
    if (prey && !prey.dead && Math.abs(prey.x - a.x) < 40 && a.hunger > 0.25) {
      a.face(prey.x);
      a.anim = 'strike';
      a.act = 'attack';
      if (a.actT % 1.2 < dt) {
        if (rand.next() < 0.5) catchPrey(a, prey);
        else { prey.fear = 1; prey.setAct('flee', 4); }
      }
      return;
    }
    if (a.mem.tx === undefined || a.mem.blocked) { a.mem.tx = a.home[0] + rand.next() * (a.home[1] - a.home[0]); a.mem.blocked = 0; }
    if (a.mem.pause > 0) { a.mem.pause -= dt; a.anim = 'idle'; a.vx = 0; return; }
    a.anim = 'stalk';
    if (a.groundTo(a.mem.tx, a.eco.walk * 0.5, dt)) { a.mem.pause = rand.range(1.5, 4); a.mem.tx = a.x + rand.range(-80, 80); }
  },
  display(a) {
    a.vx = 0;
    a.anim = 'clatter';
    if (Math.floor(a.actT * 5) !== a.mem.c) { a.mem.c = Math.floor(a.actT * 5); a.host.sfx('callHonk', a.x, 0.35, 1.2 + rand.next() * 0.2); }
    if (a.actT > 3) return false;
  },
  threat(a) {
    a.vx = 0;
    a.anim = 'clatter';
    if (a.threat) a.face(a.threat.x);
    if (Math.floor(a.actT * 5) !== a.mem.c) { a.mem.c = Math.floor(a.actT * 5); a.host.sfx('callHonk', a.x, 0.45, 1.1); }
    if (a.actT > 2.5) return false;
  },
});
HOOKS.snakestork = {
  tick(a) {
    // rival storks answer each other's displays
    if (a.act === 'display' && a.actT < 0.05) for (const o of a.host.animals) if (o !== a && o.species === 'snakestork' && !o.busy && Math.abs(o.x - a.x) < 220) o.setAct('display', 3);
  },
};

// ------------------------------------------------------------------ Monarch: soaring scavenger
sp('monarch', {
  feed(a, dt) {
    const c = a.goal?.poi ?? a.findPOI('carrion', 900);
    if (!c) return ACTS.soar(a, dt);
    if (!a.mem.there) {
      if (a.medium !== 'air') { a.medium = 'air'; a.vy = -50; }
      a.anim = a.y < c.y - 60 ? 'soar' : 'land';
      if (a.flyTo(c.x - a.facing * 20, c.y, a.eco.run * 0.45, dt, 80)) { a.mem.there = 1; a.medium = 'ground'; a.vx = a.vy = 0; a.settle(); }
      return;
    }
    a.anim = 'feed';
    a.face(c.x);
  },
});

// ------------------------------------------------------------------ Hunter Bat: roost, hawk insects, walk-hunt frogs
sp('hunterbat', {
  hang(a, dt) {
    const b = a.goal?.poi ?? a.findPOI('branch', 400);
    if (!b) return ACTS.fly(a, dt);
    if (!a.mem.there) {
      if (a.medium !== 'air') { a.medium = 'air'; a.vy = -50; }
      a.anim = 'fly';
      if (a.flyTo(b.x, b.y + 4, a.eco.run * 0.5, dt)) { a.mem.there = 1; a.x = b.x; a.y = b.y + 4; a.vx = a.vy = 0; a.medium = 'trunk'; }
      return;
    }
    a.anim = 'hang';
  },
  hunt(a, dt) {
    const prey = a.prey;
    if (prey && !prey.dead && prey.medium === 'ground' && Math.abs(prey.x - a.x) < 200) {
      // land and stalk on folded wings
      if (a.medium === 'air' || a.medium === 'trunk') {
        a.medium = 'air';
        a.anim = 'fly';
        if (a.flyTo(prey.x - a.facing * 30, prey.y - 2, a.eco.run * 0.6, dt)) { a.medium = 'ground'; a.settle(); }
        return;
      }
      a.anim = 'walk';
      a.groundTo(prey.x, a.eco.walk * 2.5, dt);
      if (Math.abs(prey.x - a.x) < 10) { a.anim = 'grab'; catchPrey(a, prey); }
      return;
    }
    // hawking insects in the air
    if (a.medium !== 'air') { a.medium = 'air'; a.vy = -60; }
    if (a.mem.tx === undefined || rand.next() < dt * 0.7) {
      a.mem.tx = a.x + rand.range(-120, 120);
      a.mem.ty = a.host.terrain.groundY(a.x) - rand.range(40, 130);
      a.host.sfx('callClick', a.x, 0.2, 1.4);
    }
    a.anim = 'fly';
    a.flyTo(a.mem.tx, a.mem.ty, a.eco.run * 0.8, dt, 500);
    if (a.host.catchInsect?.(a.x, a.y, 14)) { a.hunger = Math.max(0, a.hunger - 0.15); a.jaw = 1; }
    if (a.actT > a.actDur) return false;
  },
});

// ------------------------------------------------------------------ Moss Frog: chorus, tongue, camouflage
sp('mossfrog', {
  sit(a) {
    a.vx = 0;
    a.anim = 'idle';
    a.hidden = 0.25; // camouflage makes it hard to pick out
  },
  hunt(a, dt) {
    a.vx = 0;
    a.anim = a.actT % 2.5 < 0.35 ? 'tongue' : 'idle';
    if (a.actT % 2.5 < dt && a.host.catchInsect?.(a.x + a.facing * 10, a.y - 4, 16)) { a.hunger = Math.max(0, a.hunger - 0.2); a.showEmote('heart', 0.8); }
    if (a.actT > a.actDur) return false;
  },
  hop(a, dt) {
    if (!a.mem.h) { a.mem.h = 1; a.mem.vy = -90; a.mem.y0 = a.y; a.mem.dx = a.facing * rand.range(30, 55); if (rand.next() < 0.4) a.facing = -a.facing; }
    a.mem.vy += 420 * dt;
    a.x += a.mem.dx * dt;
    a.y += a.mem.vy * dt;
    a.anim = 'hop';
    const g = a.host.terrain.groundY(a.x);
    if (a.y >= g && a.mem.vy > 0) { a.y = g; a.settle(); return false; }
  },
  hide(a) {
    a.vx = 0;
    a.anim = 'hide';
    a.hidden = 0.6;
    if (a.fear < 0.1 && a.actT > 3) { a.hidden = 0.25; return false; }
  },
  call(a) {
    a.vx = 0;
    a.anim = 'call';
    a.hidden = 0.1;
    if (Math.floor(a.actT * 1.6) !== a.mem.c && a.actT < 4) { a.mem.c = Math.floor(a.actT * 1.6); a.call('song'); }
    if (a.actT > 4.5) return false;
  },
});
HOOKS.mossfrog = {
  onThreat(a) {
    a.setAct(a.fear > 0.8 ? 'hop' : 'hide', 4);
    return true;
  },
};

// ------------------------------------------------------------------ Bark Gecko: trunk life, dewlap duels
sp('barkgecko', {
  display(a) {
    a.vx = a.vy = 0;
    a.anim = 'display';
    a.mem.dew = Math.min(1, (a.mem.dew ?? 0) + 0.08);
    if (!a.mem.shown) { a.mem.shown = 1; a.host.sfx('callClick', a.x, 0.3, 1.6); }
    if (a.actT > 3) return false;
  },
  hunt(a, dt) {
    if (a.medium !== 'trunk') return ACTS.climb(a, dt);
    a.anim = 'cling';
    const tr = a.poi;
    if (tr && (a.mem.ty === undefined || rand.next() < dt * 0.4)) a.mem.ty = rand.range(tr.y1 ?? tr.y - 120, tr.y - 10);
    if (a.mem.ty !== undefined && !a.climbTo(a.mem.ty, a.eco.walk, dt)) a.anim = 'climb';
    if (a.host.catchInsect?.(a.x, a.y, 20)) { a.jaw = 1; a.hunger = Math.max(0, a.hunger - 0.2); }
    if (a.actT > a.actDur) return false;
  },
});
HOOKS.barkgecko = {
  tick(a) {
    // rival on the same trunk -> dewlap duel
    if (a.act !== 'display' && a.medium === 'trunk' && !a.busy && a.actT > 1 && rand.next() < 0.004) {
      const r = a.host.animals.find(o => o !== a && o.species === 'barkgecko' && o.poi === a.poi);
      if (r) { a.setAct('display', 3); r.setAct('display', 3); a.face(r.x); r.face(a.x); }
    }
  },
  onThreat(a) {
    if (a.medium === 'trunk') { a.setAct('flee', 3); return true; }
    return false;
  },
};

// ------------------------------------------------------------------ Skyribbon: coil, snatch insects, glide
sp('skyribbon', {
  coil(a, dt) {
    if (a.medium === 'ground') return ACTS.climb(a, dt);
    a.vx = a.vy = 0;
    a.anim = 'coil';
  },
  hunt(a, dt) {
    a.anim = 'coil';
    if (a.actT % 1.5 < dt && a.host.catchInsect?.(a.x + a.facing * 12, a.y, 26)) { a.jaw = 1; a.hunger = Math.max(0, a.hunger - 0.25); a.showEmote('heart', 0.8); }
    if (a.actT > a.actDur) return false;
    void dt;
  },
});

// ------------------------------------------------------------------ Lantern Lure-Viper: bait with a glowing tail
sp('lurevip', {
  lure(a) {
    a.vx = a.vy = 0;
    a.anim = 'lure';
    const prey = a.prey;
    if (prey && !prey.dead && Math.hypot(prey.x - a.x, prey.y - a.y) < 36) {
      a.jaw = 1;
      a.act = 'attack';
      catchPrey(a, prey);
    }
  },
});
HOOKS.lurevip = {
  tick(a) {
    // curious sail possums drift toward the light
    if (a.act !== 'lure') return;
    for (const o of a.host.animals) {
      if (o.species === 'sailglider' && !o.busy && o.fear < 0.2 && Math.abs(o.x - a.x) < 200 && rand.next() < 0.002) {
        o.goal = { kind: 'point', x: a.x + a.facing * 20, y: a.y };
        o.setAct('glide', 6);
      }
    }
  },
};

// ------------------------------------------------------------------ Titan: ambush, constrict, digest
sp('titan', {
  ambush(a) {
    a.vx = a.vy = 0;
    a.anim = 'ambush';
    a.hidden = 0.55;
    const prey = a.prey;
    if (prey && !prey.dead && Math.abs(prey.x - a.x) < 70) {
      a.hidden = 0;
      a.setAct('constrict', 8);
      prey.held = true;
      a.mem.px = prey.x;
      a.host.sfx('roar', a.x, 0.7, 0.6);
      a.host.sounds.push({ x: a.x, y: a.y, kind: 'roar', src: a, species: a.species, radius: 500, t: a.host.time + 0.0001 });
      (a as Animal & { victim?: Animal }).victim = prey;
    }
  },
  constrict(a) {
    const v = (a as Animal & { victim?: Animal }).victim;
    a.anim = 'constrict';
    a.jaw = 0.5;
    if (v) { v.x += (a.x - v.x) * 0.02; v.alpha = Math.max(0, 1 - a.actT / 8); }
    if (a.actT > a.actDur) {
      if (v) v.dead = true;
      a.hunger = 0;
      a.setAct('digest', 40);
    }
  },
  digest(a) {
    a.vx = 0;
    a.anim = 'digest';
    a.mem.swell = 1;
  },
});
HOOKS.titan = {
  decide(a) {
    if (a.act === 'digest' && a.actT < a.actDur) return true;
    return false;
  },
};

// ------------------------------------------------------------------ Ironjaw: lurk, bask with jaws open, lunge
sp('ironjaw', {
  lurk(a, dt) {
    const wy = a.host.waterY;
    if (wy !== null && a.medium === 'water') { a.swimTo(a.x + Math.sin(a.actT * 0.3) * 10, wy + 2, 6, dt); }
    a.anim = 'lurk';
    a.hidden = 0.7;
    const prey = a.prey;
    const p = a.host.player;
    const edge = (x: number) => wy !== null && Math.abs(a.host.terrain.groundY(x) - wy) < 12;
    if (prey && !prey.dead && Math.abs(prey.x - a.x) < 60 && (prey.medium === 'water' || edge(prey.x))) { a.hidden = 0; a.setAct('attack', 1.5); a.threat = { kind: 'animal', x: prey.x, y: prey.y, a: prey }; }
    else if (Math.abs(p.x - a.x) < 50 && edge(p.x) && a.noticed) { a.hidden = 0; a.anger = 1; a.threat = { kind: 'player', x: p.x, y: p.y }; a.setAct('attack', 1.4); }
  },
  bask(a, dt) {
    const b = a.goal?.poi ?? a.findPOI('bank', 400);
    if (b && !a.mem.there) {
      a.anim = a.medium === 'water' ? 'swim' : 'walk';
      if (a.medium === 'water') { if (a.swimTo(b.x, a.host.waterY ?? b.y, a.eco.walk, dt)) { a.medium = 'ground'; a.y = b.y; a.settle(); } }
      else if (a.groundTo(b.x, a.eco.walk, dt)) a.mem.there = 1;
      return;
    }
    a.vx = 0;
    a.hidden = 0;
    a.anim = 'bask';
    a.jaw = 0.9;
  },
  attack(a, dt) {
    const t = a.threat;
    if (!t) return false;
    a.anim = 'attack';
    a.jaw = 1;
    a.face(t.x);
    if (a.medium === 'water') a.swimTo(t.x, a.host.waterY ?? t.y, a.eco.run, dt);
    else a.groundTo(t.x, a.eco.run, dt);
    if (a.actT < dt * 1.5) { a.host.splash(a.x, a.host.waterY ?? a.y, 1.2); a.host.sfx('croc', a.x, 0.8); }
    if (t.a && Math.abs(t.a.x - a.x) < 16) { catchPrey(a, t.a); return false; }
    if (t.kind === 'player' && Math.abs(a.host.player.x - a.x) < 18) { a.host.caught(a, 3); a.anger = 0; a.setAct('lurk', 8); return false; }
    if (a.actT > a.actDur) { a.setAct('lurk', 10); return false; }
  },
});

// ------------------------------------------------------------------ Leviathan: slow loops, surfacing, curious about divers
sp('leviathan', {
  surface(a, dt) {
    const wy = a.host.waterY ?? 0;
    a.anim = 'swim';
    a.flyTo(a.x + a.facing * 40, wy + 6, a.eco.walk, dt, 60);
    if (a.actT > 1 && !a.mem.b) { a.mem.b = 1; a.host.sfx('callWhale', a.x, 0.6, 0.8); a.host.splash(a.x, wy, 1.6); }
  },
  investigate(a, dt) {
    const p = a.host.player;
    const ang = a.actT * 0.4;
    a.anim = 'swim';
    a.flyTo(p.x + Math.cos(ang) * 140, p.y + Math.sin(ang) * 50, a.eco.walk, dt, 60);
    a.face(p.x);
    if (a.actT > 10) return false;
  },
});

// ------------------------------------------------------------------ Mudribbon: channel fishing
sp('mudribbon', {
  fish(a, dt) {
    a.anim = 'swim';
    a.swimTo(a.x + a.facing * 20, (a.host.waterY ?? a.y) + 12, a.eco.walk * 0.5, dt);
    if (a.actT % 2 < dt) { a.jaw = 1; if (rand.next() < 0.3) a.hunger = Math.max(0, a.hunger - 0.3); }
    if (a.actT > a.actDur) return false;
  },
});

// ------------------------------------------------------------------ Crag Viper: climbs rock, raids auk nests
sp('cragviper', {
  raid(a, dt) {
    const n = a.goal?.poi ?? a.findPOI('nest', 400);
    if (!n || (n.amount ?? 1) <= 0) return false;
    if (!a.mem.there) {
      a.anim = 'walk';
      a.x += Math.sign(n.x - a.x) * Math.min(Math.abs(n.x - a.x), a.eco.walk * dt);
      a.y += Math.sign(n.y - a.y) * Math.min(Math.abs(n.y - a.y), a.eco.walk * dt);
      a.face(n.x);
      if (Math.abs(n.x - a.x) < 3 && Math.abs(n.y - a.y) < 3) {
        a.mem.there = 1;
        // the colony notices a thief at the nest
        a.host.sounds.push({ x: a.x, y: a.y, kind: 'alarm', src: a, species: 'cragauk', radius: 400, t: a.host.time + 0.0001 });
        for (const o of a.host.animals) if (o.species === 'cragauk' && Math.abs(o.x - a.x) < 400) { o.threat = { kind: 'animal', x: a.x, y: a.y, a }; o.fear = 0.6; o.setAct('mob', 8); }
      }
      return;
    }
    a.anim = 'eat';
    a.jaw = 0.8;
    if (a.actT % 3 < dt) n.amount = Math.max(0, (n.amount ?? 3) - 1);
  },
});

export {};
