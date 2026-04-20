// Boss definitions. Bosses are single-entity encounters with multi-phase behaviors.
// Phase triggers: HP thresholds. Each phase can have different behavior.

const BOSSES = {
  lactose_lich: {
    key: 'lactose_lich',
    name: 'The Lactose Lich',
    emoji: '☠️',
    isBoss: true,
    base: { hp: 350, atk: 22, def: 6, spd: 7 },
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
      const phase = hpPct > 0.5 ? 0 : 1;
      return BOSSES.lactose_lich.phases[phase].behavior(ctx);
    },
  },
  curdfather: {
    key: 'curdfather',
    name: 'The Curdfather',
    emoji: '🧀',
    isBoss: true,
    base: { hp: 650, atk: 28, def: 10, spd: 8 },
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
};

function getBoss(key) { return BOSSES[key]; }
function getBossForFloor(floor) {
  return Object.values(BOSSES).find(b => b.floor === floor);
}

module.exports = { BOSSES, getBoss, getBossForFloor };
