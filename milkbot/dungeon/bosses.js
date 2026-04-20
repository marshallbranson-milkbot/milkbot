// Boss definitions. Bosses are single-entity encounters with multi-phase behaviors.
// Phase triggers: HP thresholds. Each phase can have different behavior.

const BOSSES = {
  lactose_lich: {
    key: 'lactose_lich',
    name: 'The Lactose Lich',
    emoji: '☠️',
    isBoss: true,
    dungeon: 'spoiled_vault',
    // Base tuned for 4-player parties. Scaled by party size in combat.js.
    base: { hp: 350, atk: 18, def: 5, spd: 7 },
    floor: 5,
    // Phase 1 (>50% HP): single-target hit with Sour
    // Phase 2 (<=50% HP): AoE curse
    phases: [
      { threshold: 1.0, behavior: (ctx) => {
        const target = ctx.pickLivingPlayer();
        if (!target) return [];
        return [
          { kind: 'damage', target: target.userId, amount: ctx.atk },
          { kind: 'status', target: target.userId, status: 'sour', duration: 3 },
        ];
      }},
      { threshold: 0.5, behavior: (ctx) => {
        // AoE curse hits all party members
        const living = ctx.party.filter(p => !p.downed);
        return living.flatMap(p => [
          { kind: 'damage', target: p.userId, amount: Math.floor(ctx.atk * 0.7) },
          { kind: 'status', target: p.userId, status: 'sour', duration: 2 },
        ]);
      }},
    ],
    behavior: (ctx) => {
      const hpPct = ctx.self.hp / ctx.self.maxHp;
      // Phase 2 triggers at or below 50%. At exactly 50% we already enter AoE.
      const phase = hpPct > 0.5 ? 0 : 1;
      return BOSSES.lactose_lich.phases[phase].behavior(ctx);
    },
  },
  curdfather: {
    key: 'curdfather',
    name: 'The Curdfather',
    emoji: '🧀',
    isBoss: true,
    dungeon: 'spoiled_vault',
    // Base tuned for 4-player parties. Scaled by party size in combat.js.
    base: { hp: 650, atk: 24, def: 8, spd: 8 },
    floor: 10,
    // Phase 1 (>66% HP): single heavy hit
    // Phase 2 (33-66% HP): multi-hit (3 attacks)
    // Phase 3 (<33% HP): summons Curdling minions + attack
    phases: [
      { threshold: 1.0, behavior: (ctx) => {
        const target = ctx.pickLivingPlayer();
        if (!target) return [];
        return [{ kind: 'damage', target: target.userId, amount: Math.floor(ctx.atk * 1.3) }];
      }},
      { threshold: 0.66, behavior: (ctx) => {
        const effects = [];
        for (let i = 0; i < 3; i++) {
          const target = ctx.pickLivingPlayer();
          if (!target) break;
          effects.push({ kind: 'damage', target: target.userId, amount: Math.floor(ctx.atk * 0.6) });
        }
        return effects;
      }},
      { threshold: 0.33, behavior: (ctx) => {
        const effects = [];
        // 30% chance to summon (only if space available)
        if (ctx.enemies.length < 4 && ctx.rng.chance(0.3)) {
          effects.push({ kind: 'summon', enemyKey: 'curdling' });
        }
        // Always attack
        const target = ctx.pickLivingPlayer();
        if (target) {
          effects.push({ kind: 'damage', target: target.userId, amount: ctx.atk });
        }
        return effects;
      }},
    ],
    behavior: (ctx) => {
      const hpPct = ctx.self.hp / ctx.self.maxHp;
      let phaseIdx = 0;
      if (hpPct <= 0.33) phaseIdx = 2;
      else if (hpPct <= 0.66) phaseIdx = 1;
      return BOSSES.curdfather.phases[phaseIdx].behavior(ctx);
    },
  },

  // ── UDDER ABYSS BOSSES ─────────────────────────────────────────────────────
  great_maw: {
    key: 'great_maw',
    name: 'The Great Maw',
    emoji: '🕳️',
    isBoss: true,
    dungeon: 'udder_abyss',
    base: { hp: 430, atk: 22, def: 6, spd: 6 },
    floor: 5,
    phases: [
      { threshold: 1.0, behavior: (ctx) => {
        const t = ctx.pickLivingPlayer(); if (!t) return [];
        return [
          { kind: 'damage', target: t.userId, amount: ctx.atk },
          { kind: 'status', target: t.userId, status: 'curdled', duration: 2 },
        ];
      }},
      { threshold: 0.5, behavior: (ctx) => {
        const living = ctx.party.filter(p => !p.downed);
        return living.flatMap(p => [
          { kind: 'damage', target: p.userId, amount: Math.floor(ctx.atk * 0.8) },
          { kind: 'status', target: p.userId, status: 'sour', duration: 2 },
        ]);
      }},
    ],
    behavior: (ctx) => {
      const hpPct = ctx.self.hp / ctx.self.maxHp;
      return BOSSES.great_maw.phases[hpPct > 0.5 ? 0 : 1].behavior(ctx);
    },
  },
  udder_god: {
    key: 'udder_god',
    name: 'The Udder God',
    emoji: '👁️',
    isBoss: true,
    dungeon: 'udder_abyss',
    base: { hp: 780, atk: 28, def: 10, spd: 8 },
    floor: 10,
    // 4 phases: light hits → paired hits → AoE + summon → ultimate targeting low HP
    phases: [
      { threshold: 1.0, behavior: (ctx) => {
        const t = ctx.pickLivingPlayer(); if (!t) return [];
        return [{ kind: 'damage', target: t.userId, amount: Math.floor(ctx.atk * 1.2) }];
      }},
      { threshold: 0.75, behavior: (ctx) => {
        const effects = [];
        for (let i = 0; i < 2; i++) {
          const t = ctx.pickLivingPlayer(); if (!t) break;
          effects.push({ kind: 'damage', target: t.userId, amount: Math.floor(ctx.atk * 0.8) });
        }
        return effects;
      }},
      { threshold: 0.50, behavior: (ctx) => {
        const effects = [];
        if (ctx.enemies.length < 4 && ctx.rng.chance(0.35)) {
          effects.push({ kind: 'summon', enemyKey: 'ooze_calf' });
        }
        const living = ctx.party.filter(p => !p.downed);
        for (const p of living.slice(0, 2)) {
          effects.push({ kind: 'damage', target: p.userId, amount: Math.floor(ctx.atk * 0.7) });
        }
        return effects;
      }},
      { threshold: 0.25, behavior: (ctx) => {
        // Ultimate: target lowest-HP player for massive damage
        const lowest = ctx.party.filter(p => !p.downed).sort((a, b) => a.hp - b.hp)[0];
        if (!lowest) return [];
        return [{ kind: 'damage', target: lowest.userId, amount: Math.floor(ctx.atk * 1.6) }];
      }},
    ],
    behavior: (ctx) => {
      const hpPct = ctx.self.hp / ctx.self.maxHp;
      let idx = 0;
      if (hpPct <= 0.25) idx = 3;
      else if (hpPct <= 0.50) idx = 2;
      else if (hpPct <= 0.75) idx = 1;
      return BOSSES.udder_god.phases[idx].behavior(ctx);
    },
  },
};

function getBoss(key) { return BOSSES[key]; }
function getBossForFloor(floor, dungeonId = 'spoiled_vault') {
  return Object.values(BOSSES).find(b => b.floor === floor && (b.dungeon || 'spoiled_vault') === dungeonId);
}

module.exports = { BOSSES, getBoss, getBossForFloor };
