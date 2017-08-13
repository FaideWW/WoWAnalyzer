import Module from 'Parser/Core/Module';
import SPELLS from 'common/SPELLS';
import ITEMS from 'common/ITEMS';

const VERS_RATING_TO_PERCENT = 475;

const K_TABLE = {
  110: 7390,
  111: 7648,
  112: 7906,
  113: 8164,
};

const SCHOOLS = {
  PHYSICAL: 1,
  HOLY: 2,
  FIRE: 4,
  NATURE: 8,
  FROST: 16,
  SHADOW: 32,
  ARCANE: 64,
};

SCHOOLS.ALL = SCHOOLS.PHYSICAL | SCHOOLS.HOLY | SCHOOLS.FIRE | SCHOOLS.NATURE | SCHOOLS.FROST | SCHOOLS.SHADOW | SCHOOLS.ARCANE;

SCHOOLS.CHAOS = SCHOOLS.HOLY | SCHOOLS.FIRE | SCHOOLS.NATURE | SCHOOLS.FROST | SCHOOLS.SHADOW | SCHOOLS.ARCANE;


/**
 * Artifact traits that increase values by 3% round up to 10% on the third rank
 */
function getThreePercentTraitValue(rank) {
  return rank * 0.03 + (Math.floor(rank / 3) * 0.01);
}

function getArmorDR(targetArmor, attackerLevel = 113) {
  if (!K_TABLE[attackerLevel]) {
    // TODO: how should we handle this case? (will it ever come up?)
    return null;
  }

  return (targetArmor / (targetArmor + K_TABLE[attackerLevel]));
}

function getIronfurDuration(event, combatant) {
  const baseDuration = 6;
  const ursocsEnduranceLevel = combatant.traitsBySpellId[SPELLS.URSOC_ENDURANCE.id];
  const isGOEActive = combatant.hasBuff(SPELLS.GUARDIAN_OF_ELUNE.id);

  return baseDuration + (ursocsEnduranceLevel * 0.5) + (isGOEActive ? 2 : 0);
}

const guardianArmorModifier = {
  activeForSchools: SCHOOLS.PHYSICAL,
  state: {
    baseArmor: 0,
    ironfurPercentage: 0.65,
    ironfurs: [],
  },
  on_initialized(combatant) {
    // Establish static values (so we don't have to compute them constantly)
    this.state.baseArmor = combatant.armorRating;
    this.state.ironfurPercentage += (0.04 * combatant.traitsBySpellId[SPELLS.REINFORCED_FUR_TRAIT.id]);

    // Traits
    if (combatant.traitsBySpellId[SPELLS.IRON_CLAWS_TRAIT.id] > 0) {
      this.state.baseArmor *= 1.05;
    }

    if (combatant.traitsBySpellId[SPELLS.URSOCS_BOND_TRAIT.id] > 0) {
      this.state.baseArmor *= 1.06;
    }

    if (combatant.traitsBySpellId[SPELLS.FORTITUDE_OF_THE_CENARION_CIRCLE_TRAIT.id] > 0) {
      this.state.baseArmor *= 1.12;
    }
  },
  getOriginalDamage(damage, event, combatant) {
    let armor = this.state.baseArmor;

    // Form modifier
    if (combatant.hasBuff(SPELLS.BEAR_FORM.id) || combatant.hasBuff(SPELLS.MOONKIN_FORM.id)) {
      armor *= 3;
    }

    // Ironfur modifier
    const ifStacks = this.getActiveIronfurStacks(event.timestamp);
    if (ifStacks > 0) {
      armor += armor * (ifStacks * this.state.ironfurPercentage);
    }

    // Apply bonus armor
    // TODO

    return damage / (1 - getArmorDR(armor));

  },
  getActiveIronfurStacks(timestamp) {
    return this.state.ironfurs.filter(ironfur => (ironfur.start < timestamp && ironfur.end > timestamp)).length;
  },
  on_byPlayer_cast(event, combatant) {
    if (event.ability.guid === SPELLS.IRONFUR.id) {
      const start = event.timestamp;
      const end = start + getIronfurDuration(event, combatant) * 1000;
      this.state.ironfurs.push({ start, end });
    }
  },

  on_removebuff(event, combatant) {
    if (event.ability.guid === SPELLS.BEAR_FORM.id) {
      // Drop all ironfur stacks (occurs on leaving bearform)
      this.state.ironfurs = [];
    }
  },
};

const versatilityModifier = {
  activeForSchools: SCHOOLS.ALL,
  getOriginalDamage(damage, event, combatant) {
    let vers = combatant.versatilityRating;

    if (combatant.hasBuff(SPELLS.CONCORDANCE_VERSATILITY.id)) {
      vers += this.getVersatilityFromConcordance(combatant);
    }

    const modifier = (vers / (VERS_RATING_TO_PERCENT * 2)) / 100;
    return damage / (1 - modifier);
  },
  getVersatilityFromConcordance(combatant) {
    const concordanceRanks = combatant.traitsBySpellId[SPELLS.CONCORDANCE_TRAIT.id];
    if (concordanceRanks === 0) return 0;

    return 4000 + (300 * (concordanceRanks - 1));
  },
};

const guardianDRs = {
  activeForSchools: SCHOOLS.ALL,
  state: {
    survivalInstinctsDR: 0.5,
    thickHideDR: 0.06,
  },
  on_initialized(combatant) {
    this.state.survivalInstinctsDR += getThreePercentTraitValue(combatant.traitsBySpellId[SPELLS.SHARPENED_INSTINCTS_TRAIT.id]);
    if (combatant.hasChest(ITEMS.EKOWRAITH_CREATOR_OF_WORLDS.id)) {
      this.state.thickHideDR += 0.045;
    }
  },
  getOriginalDamage(damage, event, combatant) {
    let finalModifier = 1 - this.state.thickHideDR;

    if (combatant.hasBuff(SPELLS.SURVIVAL_INSTINCTS.id)) {
      finalModifier *= 1 - this.state.survivalInstinctsDR;
    }
    if (combatant.hasBuff(SPELLS.BARKSKIN.id)) {
      finalModifier *= 1 - 0.2;
    }
    if (combatant.hasBuff(SPELLS.RAGE_OF_THE_SLEEPER.id)) {
      finalModifier *= 1 - 0.25;
    }

    return damage / finalModifier;
  },
};


class Mitigation extends Module {
  damageEvents = [];
  damageReductions = [ guardianArmorModifier, versatilityModifier, guardianDRs ];
  on_initialized() {
    console.log(this.owner.selectedCombatant);
    this.damageReductions.forEach((dr) => {
      if (dr.on_initialized) {
        dr.on_initialized.apply(dr, [this.owner.selectedCombatant]);
      }
    });
  }

  on_byPlayer_cast(event) {
    this.damageReductions.forEach((dr) => {
      if (dr.on_byPlayer_cast) {
        dr.on_byPlayer_cast.apply(dr, [event, this.owner.selectedCombatant]);
      }
    });
  }

  on_removebuff(event) {
    this.damageReductions.forEach((dr) => {
      if (dr.on_removebuff) {
        dr.on_removebuff.apply(dr, [event, this.owner.selectedCombatant]);
      }
    });
  }

  on_toPlayer_damage(event) {
    // Bear Form
    // Thick Hide
    // Scintillating Moonlight
    // Pulverize
    // Rend and Tear
    // Ekowraith
    // Adaptive Fur
    // Ironfur (Reinforced Fur)
    // Barkskin
    // Rage of the Sleeper
    // Survival Instincts (Sharpened Instincts)
    // Incarnation
    // Earthwarden (?)
    // Brambles (?)

    const school = event.ability.type;

    const damageAfterDR = event.amount;
    // Pretty sure absorbs are applied after mitigation?
    let damageBeforeDR = damageAfterDR + event.absorbed;

    this.damageReductions.forEach((dr) => {
      if (school & dr.activeForSchools !== 0) {
        damageBeforeDR = dr.getOriginalDamage.call(dr, damageBeforeDR, event, this.owner.selectedCombatant);
      }
    });

    this.damageEvents.push({
      damageBeforeDR,
      absorbed: event.absorbed,
      damageAfterDR,
    });
  }

}

export default Mitigation;
