import React from 'react';
import { formatPercentage } from 'common/format';
import SpellIcon from 'common/SpellIcon';
import SpellLink from 'common/SpellLink';
import Wrapper from 'common/Wrapper';
import StatisticBox, { STATISTIC_ORDER } from 'Main/StatisticBox';
import Analyzer from 'Parser/Core/Analyzer';
import SPELLS from 'common/SPELLS';
import Combatants from 'Parser/Core/Modules/Combatants';

const GoE_DURATION = 15000;
const debug = false;

class GuardianOfElune extends Analyzer {
  static dependencies = {
    combatants: Combatants,
  };

  GoEProcsTotal = 0;
  lastGoEProcTime = 0;
  consumedGoEProc = 0;
  overwrittenGoEProc = 0;
  nonGoEIronFur = 0;
  GoEIronFur = 0;
  nonGoEFRegen = 0;
  GoEFRegen = 0;

  on_initialized() {
    this.active = this.combatants.selected.hasTalent(SPELLS.GUARDIAN_OF_ELUNE_TALENT.id);
  }

  on_byPlayer_applybuff(event) {
    const spellId = event.ability.guid;
    if (SPELLS.GUARDIAN_OF_ELUNE.id === spellId) {
      this.lastGoEProcTime = event.timestamp;
      debug && console.log('Guardian of Elune applied');
      this.GoEProcsTotal += 1;
    }
  }

  on_byPlayer_refreshbuff(event) {
    const spellId = event.ability.guid;
    if (SPELLS.GUARDIAN_OF_ELUNE.id === spellId) {
      // Captured Overwritten GoE Buffs for use in wasted buff calculations
      this.lastGoEProcTime = event.timestamp;
      debug && console.log('Guardian of Elune Overwritten');
      this.GoEProcsTotal += 1;
      this.overwrittenGoEProc += 1;
    }
  }

  on_byPlayer_cast(event) {
    const spellId = event.ability.guid;
    if (SPELLS.IRONFUR.id !== spellId && SPELLS.FRENZIED_REGENERATION.id !== spellId) {
      return;
    }
    if (SPELLS.IRONFUR.id === spellId) {
      if (this.lastGoEProcTime !== event.timestamp) {
        if (this.lastGoEProcTime === null) {
          this.nonGoEIronFur += 1;
          return;
        }
        const GoETimeframe = this.lastGoEProcTime + GoE_DURATION;
        if (event.timestamp > GoETimeframe) {
          this.nonGoEIronFur += 1;
        } else {
          this.consumedGoEProc += 1;
          this.GoEIronFur += 1;
          debug && console.log(`Guardian of Elune Proc Consumed / Timestamp: ${event.timestamp}`);
          this.lastGoEProcTime = null;
        }
      }
    }
    if (SPELLS.FRENZIED_REGENERATION.id === spellId) {
      if (this.lastGoEProcTime !== event.timestamp) {
        if (this.lastGoEProcTime === null) {
          this.nonGoEFRegen += 1;
          return;
        }
        const GoETimeframe = this.lastGoEProcTime + GoE_DURATION;
        if (event.timestamp > GoETimeframe) {
          this.nonGoEFRegen += 1;
        } else {
          this.consumedGoEProc += 1;
          this.GoEFRegen += 1;
          debug && console.log(`Guardian of Elune Proc Consumed / Timestamp: ${event.timestamp}`);
          this.lastGoEProcTime = null;
        }
      }
    }
  }

  get unusedGoEProcsPercentage() {
    return 1 - (this.consumedGoEProc / this.GoEProcsTotal);
  }

  get suggestionThresholds() {
    return {
      actual: this.unusedGoEProcsPercentage,
      isGreaterThan: {
        minor: 0.3,
        average: 0.45,
        major: 0.6,
      },
      style: 'percentage',
    };
  }

  suggestions(when) {
    when(this.suggestionThresholds)
      .addSuggestion((suggest, actual, recommended) => {
        return suggest(
          <Wrapper>
            You wasted {formatPercentage(actual)}% of your <SpellLink id={SPELLS.GUARDIAN_OF_ELUNE.id} /> procs. Try to use the procs as soon as you get them so they are not overwritten.
          </Wrapper>
        )
          .icon(SPELLS.GUARDIAN_OF_ELUNE.icon)
          .actual(`${formatPercentage(actual)}% unused`)
          .recommended(`${Math.round(formatPercentage(recommended))}% or less is recommended`);
      });
  }

  statistic() {
    return (
      <StatisticBox
        icon={<SpellIcon id={SPELLS.GUARDIAN_OF_ELUNE.id} />}
        value={`${formatPercentage(this.unusedGoEProcsPercentage)}%`}
        label="Unused Guardian of Elune"
        tooltip={`You got total <b>${this.GoEProcsTotal}</b> guardian of elune procs and <b>used ${this.consumedGoEProc}</b> of them.`}
      />
    );
  }
  statisticOrder = STATISTIC_ORDER.CORE(7);
}

export default GuardianOfElune;
