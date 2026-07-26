// SPDX-License-Identifier: MIT
//
// Canonical Combat Effectiveness Rating path for package review.
//
// This is a faithful port of the consumer implementation in the Dungeons on
// Automatic application (`src/modules/cer-calculator.ts`). The package and the
// app must agree on OR/PR/CER, because the app's public-package validator
// rejects any record whose stored CER is not `cerFromOrPr(OR, PR)`, and the
// bestiary re-derives ratings from stats when a record ships without them.
//
// The original conversion pass used a looser baseline that ceilinged the damage
// base before applying the damage-type multiplier. That inflates odd dice counts
// (3d impaling scores 22 instead of 21) and omits the ranged accuracy bonus, so
// review recomputes every record through this module instead.
//
// Formulas follow Pyramid #3-77 ("It's a Threat!") / Pyramid Dungeon Fantasy
// Collected. Only the arithmetic is implemented here; no rules prose is copied.

const DAMAGE_TYPE_MULTIPLIERS = {
  crushing: 1,
  burning: 1,
  toxic: 1,
  piercing: 1,
  small_piercing: 0.5,
  cutting: 1.5,
  large_piercing: 1.5,
  corrosion: 2,
  fatigue: 2,
  huge_piercing: 2,
  impaling: 2,
};

/** CER = OR + PR with a floor of 1. */
export function cerFromOrPr(offenseRating, protectionRating) {
  return Math.max(1, Math.round(offenseRating + protectionRating));
}

/** Absolute-CER threat banding shared with the app's enhancement layer. */
export function threatTierFromCer(cer) {
  if (typeof cer !== "number") return null;
  if (cer >= 100) return "severe";
  if (cer >= 60) return "major";
  if (cer >= 25) return "standard";
  return "minor";
}

export function inferDamageType(text) {
  if (/\bpi\+\+|huge piercing\b/.test(text)) return "huge_piercing";
  if (/\bpi\+|large piercing\b/.test(text)) return "large_piercing";
  if (/\bpi-|small piercing\b/.test(text)) return "small_piercing";
  if (/\bimp|\bimpaling\b/.test(text)) return "impaling";
  if (/\bcor|\bcorrosion\b/.test(text)) return "corrosion";
  if (/\bfat|\bfatigue\b/.test(text)) return "fatigue";
  if (/\bcut|\bcutting\b/.test(text)) return "cutting";
  if (/\bpi\b|\bpiercing\b/.test(text)) return "piercing";
  if (/\bburn|\bburning\b/.test(text)) return "burning";
  if (/\btox|\btoxic\b/.test(text)) return "toxic";
  return "crushing";
}

export function parseDamageExpression(raw) {
  if (!raw) return { damageDice: null, damageModifier: 0, damageType: "crushing" };
  const text = String(raw).trim().toLowerCase();
  const match = text.match(/(\d+)\s*d\s*([+-]\s*\d+)?/);
  const damageDice = match ? Number(match[1]) : null;
  const damageModifier = match?.[2] ? Number(match[2].replace(/\s+/g, "")) : 0;
  return {
    damageDice: Number.isFinite(damageDice) ? damageDice : null,
    damageModifier: Number.isFinite(damageModifier) ? damageModifier : 0,
    damageType: inferDamageType(text),
  };
}

/** Average-damage score used to pick a combatant's best attack for rating. */
export function attackDamageScore(damageDice, damageModifier, damageType) {
  if (damageDice === null) return 0;
  return roundHalfUp((damageDice * 3.5 + damageModifier) * (DAMAGE_TYPE_MULTIPLIERS[damageType] ?? 1));
}

export function isRangedReach(reach) {
  if (!reach) return false;
  return /ranged|missile|thrown|\d{2,}/i.test(String(reach));
}

export function pickBestAttack(attacks) {
  if (!Array.isArray(attacks) || attacks.length === 0) return null;
  let best = attacks[0];
  let bestScore = -Infinity;
  for (const attack of attacks) {
    const parsed = parseDamageExpression(attack.damage);
    const damageScore = attackDamageScore(parsed.damageDice, parsed.damageModifier, parsed.damageType);
    const skillScore = typeof attack.skill === "number" ? attack.skill : 0;
    const score = skillScore + damageScore;
    if (score > bestScore) {
      best = attack;
      bestScore = score;
    }
  }
  return best;
}

export function combatProfileFromStats(stats, label) {
  const bestAttack = pickBestAttack(stats.attacks);
  const attributes = stats.attributes ?? {};
  return {
    label,
    attackSkill: bestAttack
      ? { bestSkill: numberOrNull(bestAttack.skill), ranged: isRangedReach(bestAttack.reach) }
      : undefined,
    attack: bestAttack
      ? {
          name: bestAttack.name,
          skill: numberOrNull(bestAttack.skill),
          ...parseDamageExpression(bestAttack.damage),
          ranged: isRangedReach(bestAttack.reach),
          // Structured hazard mechanics declare their own rating inputs.
          autoHit: bestAttack.autoHit === true,
          cyclesWithin15Seconds: numberOrNull(bestAttack.cyclesWithin15Seconds) ?? undefined,
        }
      : null,
    fatiguePoints: numberOrNull(attributes.fp),
    move: numberOrNull(attributes.move),
    uniformDr: numberOrNull(attributes.dr),
    dodge: numberOrNull(attributes.dodge),
    ht: numberOrNull(attributes.ht),
    hitPoints: numberOrNull(attributes.hp),
    will: numberOrNull(attributes.will),
    highPainThreshold: hasTrait(stats.traits, "high pain threshold"),
    recovery: hasTrait(stats.traits, "recovery"),
    combatReflexes: hasTrait(stats.traits, "combat reflexes"),
    unfazeable: hasTrait(stats.traits, "unfazeable"),
  };
}

export function computeCerFromProfile(profile) {
  const offense = [
    attackSkillContribution(profile),
    afflictionContribution(profile),
    damageContribution(profile),
    fatigueContribution(profile),
    moveContribution(profile),
  ];
  const protection = [
    damageResistanceContribution(profile),
    activeDefenseContribution(profile),
    healthContribution(profile),
    hitPointsContribution(profile),
    willContribution(profile),
  ];
  const offenseRating = sum(offense);
  const protectionRating = sum(protection);
  return {
    offenseRating,
    protectionRating,
    combatEffectivenessRating: cerFromOrPr(offenseRating, protectionRating),
    offense,
    protection,
  };
}

/** Recompute a candidate record's effectiveness block from its reviewed stats. */
export function effectivenessFromStats(stats, label) {
  const breakdown = computeCerFromProfile(combatProfileFromStats(stats, label));
  return {
    offenseRating: breakdown.offenseRating,
    protectionRating: breakdown.protectionRating,
    combatEffectivenessRating: breakdown.combatEffectivenessRating,
    threatTier: threatTierFromCer(breakdown.combatEffectivenessRating),
    breakdown,
  };
}

function attackSkillContribution(profile) {
  const skillInfo = profile.attackSkill ?? (profile.attack
    ? {
        bestSkill: profile.attack.skill,
        ranged: profile.attack.ranged,
        accuracy: profile.attack.accuracy,
        innateRanged: profile.attack.innateRanged,
        autoHit: profile.attack.autoHit,
      }
    : null);
  const autoHit = profile.attack?.autoHit === true || skillInfo?.autoHit === true;
  if (!skillInfo || skillInfo.bestSkill === null || skillInfo.bestSkill === undefined) {
    // A hazard that cannot miss has no attack skill to rate. Score it from the
    // unmodified baseline (skill 10, contributing 0) plus the auto-hit credit,
    // rather than dropping the whole contribution to zero.
    if (autoHit) return { id: "attack_skill", label: "Attack Skill", value: 15, notes: ["no attack roll", "auto-hit +15"] };
    return { id: "attack_skill", label: "Attack Skill", value: 0, notes: ["missing attack skill"] };
  }
  let value = skillInfo.bestSkill - 10;
  const notes = [`skill ${skillInfo.bestSkill} - 10`];
  if (skillInfo.ranged) {
    const acc = skillInfo.accuracy ?? (skillInfo.innateRanged ? 3 : 0);
    value += acc + 2;
    notes.push(`ranged Acc ${acc} + 2`);
  }
  if (autoHit) {
    value += 15;
    notes.push("auto-hit +15");
  }
  return { id: "attack_skill", label: "Attack Skill", value, notes };
}

function afflictionContribution(profile) {
  const affliction = profile.affliction;
  if (!affliction) return { id: "affliction", label: "Affliction", value: 0 };
  let value = affliction.enhancementPercent / 5;
  const notes = [`enhancement ${affliction.enhancementPercent}% / 5`];
  if ((affliction.terrorOrTurningPoints ?? 0) > 0) {
    const terror = Math.ceil(affliction.terrorOrTurningPoints / 5);
    value += terror;
    notes.push(`terror/turning +${terror}`);
  }
  if ((affliction.bindingSt ?? 0) > 0) {
    value += affliction.bindingSt;
    notes.push(`binding ST +${affliction.bindingSt}`);
  }
  if (affliction.usesFatigueOrSpell) {
    value /= 2;
    notes.push("FP/spell halved");
  }
  return { id: "affliction", label: "Affliction", value: roundHalfUp(value), notes };
}

function damageContribution(profile) {
  const attack = profile.attack;
  if (!attack || attack.damageDice === null || attack.damageDice === undefined) {
    return { id: "damage", label: "Damage", value: 0, notes: ["missing damage"] };
  }
  // Keep the exact 3.5/die average through every multiplier and round once at
  // the end; ceilinging the base first inflates odd dice counts.
  let value = attack.damageDice * 3.5 + attack.damageModifier;
  const notes = [`${attack.damageDice}d${formatModifier(attack.damageModifier)} base ${value}`];
  const multiplier = DAMAGE_TYPE_MULTIPLIERS[attack.damageType] ?? 1;
  value *= multiplier;
  notes.push(`type ${attack.damageType} x${multiplier}`);
  if ((attack.cyclesWithin15Seconds ?? 0) > 1) {
    value *= attack.cyclesWithin15Seconds;
    notes.push(`cycles x${attack.cyclesWithin15Seconds}`);
  }
  if (attack.usesFatigueOrSpell) {
    value /= 2;
    notes.push("FP/spell halved");
  }
  return { id: "damage", label: "Damage", value: roundHalfUp(value), notes };
}

function fatigueContribution(profile) {
  if (profile.fatiguePoints === null || profile.fatiguePoints === undefined) {
    return { id: "fatigue_points", label: "Fatigue Points", value: 0, notes: ["FP N/A"] };
  }
  return {
    id: "fatigue_points",
    label: "Fatigue Points",
    value: profile.fatiguePoints - 10,
    notes: [`FP ${profile.fatiguePoints} - 10`],
  };
}

function moveContribution(profile) {
  if (profile.move === null || profile.move === undefined) {
    return { id: "move", label: "Move", value: 0, notes: ["missing Move"] };
  }
  return { id: "move", label: "Move", value: profile.move - 6, notes: [`Move ${profile.move} - 6`] };
}

function damageResistanceContribution(profile) {
  const notes = [];
  let locationSum = null;
  if (profile.uniformDr !== null && profile.uniformDr !== undefined) {
    locationSum = profile.uniformDr * 4;
    notes.push(`uniform DR ${profile.uniformDr} x4 locations`);
  }
  const value = locationSum === null ? 0 : Math.ceil(locationSum / 4);
  if (locationSum === null) notes.push("missing DR");
  return { id: "damage_resistance", label: "Damage Resistance", value, notes };
}

function activeDefenseContribution(profile) {
  const notes = [];
  const candidates = [];
  if (profile.dodge !== null && profile.dodge !== undefined) {
    const dodgeScore = 2 * (profile.dodge - 8);
    candidates.push(dodgeScore);
    notes.push(`dodge score ${dodgeScore}`);
  }
  if (profile.parry !== null && profile.parry !== undefined) {
    candidates.push(profile.parry - 8);
    notes.push(`parry score ${profile.parry - 8}`);
  }
  const value = candidates.length > 0 ? Math.max(...candidates) : 0;
  if (candidates.length === 0) notes.push("no active defense");
  return { id: "active_defense", label: "Active Defense", value, notes };
}

function healthContribution(profile) {
  if (profile.ht === null || profile.ht === undefined) {
    return { id: "health", label: "Health", value: 0, notes: ["missing HT"] };
  }
  let value = profile.ht - 10;
  const notes = [`HT ${profile.ht} - 10`];
  if (profile.highPainThreshold) {
    value += 2;
    notes.push("High Pain Threshold +2");
  }
  if (profile.recovery) {
    value += 2;
    notes.push("Recovery +2");
  }
  return { id: "health", label: "Health", value, notes };
}

function hitPointsContribution(profile) {
  if (profile.hitPoints === null || profile.hitPoints === undefined) {
    return { id: "hit_points", label: "Hit Points", value: 0, notes: ["missing HP"] };
  }
  return {
    id: "hit_points",
    label: "Hit Points",
    value: profile.hitPoints - 10,
    notes: [`HP ${profile.hitPoints} - 10`],
  };
}

function willContribution(profile) {
  if (profile.will === null || profile.will === undefined) {
    return { id: "will", label: "Will", value: 0, notes: ["missing Will"] };
  }
  let value = profile.will - 10;
  const notes = [`Will ${profile.will} - 10`];
  if (profile.combatReflexes) {
    value += 1;
    notes.push("Combat Reflexes +1");
  }
  if (profile.unfazeable) {
    value += 8;
    notes.push("Unfazeable +8");
  }
  return { id: "will", label: "Will", value, notes };
}

function hasTrait(traits, needle) {
  return Array.isArray(traits) && traits.some(trait => String(trait).toLowerCase().includes(needle));
}

function sum(parts) {
  return parts.reduce((total, part) => total + part.value, 0);
}

function roundHalfUp(value) {
  return Math.floor(value + 0.5);
}

function formatModifier(modifier) {
  if (modifier > 0) return `+${modifier}`;
  if (modifier < 0) return String(modifier);
  return "";
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
