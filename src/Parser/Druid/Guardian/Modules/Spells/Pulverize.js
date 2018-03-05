import React from 'react';
import { formatPercentage } from 'common/format';
import SpellIcon from 'common/SpellIcon';
import SpellLink from 'common/SpellLink';
import Wrapper from 'common/Wrapper';
import StatisticBox, { STATISTIC_ORDER } from 'Main/StatisticBox';
import Analyzer from 'Parser/Core/Analyzer';
import Combatants from 'Parser/Core/Modules/Combatants';
import SPELLS from 'common/SPELLS';

class Pulverize extends Analyzer {
  static dependencies = {
    combatants: Combatants,
  };

  on_initialized() {
    this.active = this.combatants.selected.hasTalent(SPELLS.PULVERIZE_TALENT.id);
  }

  get pulverizeUptime() {
    return this.combatants.selected.getBuffUptime(SPELLS.PULVERIZE_BUFF.id) / this.owner.fightDuration;
  }

  get suggestionThresholds() {
    return {
      actual: this.pulverizeUptime,
      isLessThan: {
        minor: 0.9,
        average: 0.8,
        major: 0.7,
      },
      style: 'percentage',
    };
  }

  suggestions(when) {
    when(this.suggestionThresholds).isLessThan(0.9)
      .addSuggestion((suggest, actual, recommended) => {
        return suggest(
          <Wrapper>
            Your <SpellLink id={SPELLS.PULVERIZE_TALENT.id} /> uptime was {formatPercentage(actual)}%, unless there are extended periods of downtime it should be over should be near 100%. <br />All targets deal less damage to you due to the <SpellLink id={SPELLS.PULVERIZE_BUFF.id} /> buff.
          </Wrapper>
        )
          .icon(SPELLS.PULVERIZE_TALENT.icon)
          .actual(`${formatPercentage(actual)}% uptime`)
          .recommended(`${Math.round(formatPercentage(recommended))}% is recommended`);
      });
  }

  statistic() {
    return (
      <StatisticBox
        icon={<SpellIcon id={SPELLS.PULVERIZE_TALENT.id} />}
        value={`${formatPercentage(this.pulverizeUptime)}%`}
        label="Pulverize uptime"
      />
    );
  }
  statisticOrder = STATISTIC_ORDER.CORE(13);
}

export default Pulverize;
