import React from 'react';

import SPELLS from 'common/SPELLS';
import HIT_TYPES from 'Parser/Core/HIT_TYPES';
import Analyzer from 'Parser/Core/Analyzer';
import Combatants from 'Parser/Core/Modules/Combatants';
import AbilityTracker from 'Parser/Core/Modules/AbilityTracker';
import DamageTaken from 'Parser/Core/Modules/DamageTaken';

import StatisticBox from 'Main/StatisticBox';
import SpellIcon from 'common/SpellIcon';
import SpellLink from 'common/SpellLink';
import Wrapper from 'common/Wrapper';

import { formatNumber, formatPercentage } from 'common/format';

const EARTHWARDEN_REDUCTION_MODIFIER = 0.3;

const ABILITIES_THAT_CONSUME_EW = [
  SPELLS.MELEE.id,
  SPELLS.MAGIC_MELEE.id,
  SPELLS.RECURSIVE_STRIKES_ENEMY.id,
];

class Earthwarden extends Analyzer {
  static dependencies = {
    combatants: Combatants,
    abilityTracker: AbilityTracker,
    damageTaken: DamageTaken,
  };

  damageFromMelees = 0;
  swingsMitigated = 0;
  totalSwings = 0;

  on_initialized() {
    this.active = this.combatants.selected.hasTalent(SPELLS.EARTHWARDEN_TALENT.id);
  }

  on_toPlayer_damage(event) {
    if (ABILITIES_THAT_CONSUME_EW.includes(event.ability.guid)) {
      this.damageFromMelees += event.amount + event.absorbed;

      // Dodged swings and fully absorbed swings should not count towards total swings,
      // since we only care about attacks that EW would have mitigated
      if (event.hitType !== HIT_TYPES.DODGE || event.amount > 0) {
        this.totalSwings += 1;
      }
    }
  }

  on_byPlayer_absorbed(event) {
    if (event.ability.guid === SPELLS.EARTHWARDEN_BUFF.id) {
      this.swingsMitigated += 1;
    }
  }

  get hps() {
    const healingDone = this.abilityTracker.getAbility(SPELLS.EARTHWARDEN_BUFF.id).healingEffective;
    const fightLengthSec = this.owner.fightDuration / 1000;
    return healingDone / fightLengthSec;
  }

  get percentOfSwingsMitigated() {
    return this.swingsMitigated / this.totalSwings;
  }

  get meleeDamageContribution() {
    const totalDamageTaken = this.damageTaken.total.effective;
    return this.damageFromMelees / totalDamageTaken;
  }

  get totalMitigation() {
    return this.percentOfSwingsMitigated * this.meleeDamageContribution * EARTHWARDEN_REDUCTION_MODIFIER;
  }

  get suggestionThresholdsStackGeneration() {
    return {
      actual: this.percentOfSwingsMitigated,
      isLessThan: {
        minor: 0.6,
        average: 0.5,
        major: 0.4,
      },
      style: 'percentage',
    };
  }

  get suggestionThresholdsMitigationEffectiveness() {
    return {
      actual: this.meleeDamageContribution,
      isLessThan: {
        minor: 0.4,
        average: 0.35,
        major: 0.3,
      },
      style: 'percentage',
    };
  }

  suggestions(when) {
    // Suggestion 1: EW stacks are not being generated fast enough
    when(this.suggestionThresholdsStackGeneration)
      .addSuggestion((suggest, actual, recommended) => {
        return suggest(
          <Wrapper>
            <SpellLink id={SPELLS.EARTHWARDEN_TALENT.id} /> is not mitigating enough potential damage to be effective.  This is often caused by stacks being consumed too quickly due to tanking multiple mobs and/or low <SpellLink id={SPELLS.THRASH_BEAR.id} /> casts.  Consider using a different talent if you cannot get better usage from Earthwarden.
          </Wrapper>
        )
          .icon(SPELLS.EARTHWARDEN_TALENT.icon)
          .actual(`${formatPercentage(actual)}% of potential damage was mitigated by Earthwarden`)
          .recommended(`${formatPercentage(recommended, 0)}% or more is recommended`);
      });

    // Suggestion 2: Melee damage is not relevant enough for EW to be effective
    when(this.suggestionThresholdsMitigationEffectiveness)
      .addSuggestion((suggest, actual, recommended) => {
        return suggest(
          <Wrapper>
            The damage pattern of this encounter makes <SpellLink id={SPELLS.EARTHWARDEN_TALENT.id} /> less effective. Consider using a different talent that will provide more value against non-melee damage.
          </Wrapper>
        )
          .icon(SPELLS.EARTHWARDEN_TALENT.icon)
          .actual(`${formatPercentage(actual)}% of total damage is melee attacks`)
          .recommended(`${formatPercentage(recommended, 0)}% or more is recommended`);
      });
  }

  statistic() {
    return (
      <StatisticBox
        icon={<SpellIcon id={SPELLS.EARTHWARDEN_BUFF.id} />}
        label="Earthwarden HPS"
        value={`${formatNumber(this.hps)} HPS`}
        tooltip={`You mitigated ${this.swingsMitigated} out of ${this.totalSwings} total melee attacks (${formatPercentage(this.percentOfSwingsMitigated)}%) with Earthwarden. <br /><br />Earthwarden mitigated ${formatPercentage(this.totalMitigation)}% of all damage, for ${formatNumber(this.hps)} HPS.`}
      />
    );
  }

}

export default Earthwarden;
