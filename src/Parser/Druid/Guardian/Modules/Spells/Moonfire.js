import React from 'react';
import { formatPercentage } from 'common/format';
import SpellIcon from 'common/SpellIcon';
import SpellLink from 'common/SpellLink';
import Wrapper from 'common/Wrapper';
import StatisticBox, { STATISTIC_ORDER } from 'Main/StatisticBox';
import Analyzer from 'Parser/Core/Analyzer';
import Enemies from 'Parser/Core/Modules/Enemies';
import SPELLS from 'common/SPELLS';

class Moonfire extends Analyzer {
  static dependencies = {
    enemies: Enemies,
  };

  get moonfireUptime() {
    return this.enemies.getBuffUptime(SPELLS.MOONFIRE_BEAR.id) / this.owner.fightDuration;
  }

  get suggestionThresholds() {
    return {
      actual: this.moonfireUptime,
      isLessThan: {
        minor: 0.95,
        average: 0.9,
        major: 0.8,
      },
      style: 'percentage',
    };
  }

  suggestions(when) {
    when(this.suggestionThresholds)
      .addSuggestion((suggest, actual, recommended) => {
        return suggest(
          <Wrapper>
            Your <SpellLink id={SPELLS.MOONFIRE_BEAR.id} /> uptime was {formatPercentage(actual)}%, unless you have extended periods of downtime it should be near 100%. <br />Targets with Moonfire applied to them deal less damage to you due to <SpellLink id={SPELLS.SCINTILLATING_MOONLIGHT.id} />.
          </Wrapper>
        )
          .icon(SPELLS.MOONFIRE_BEAR.icon)
          .actual(`${formatPercentage(actual)}% uptime`)
          .recommended(`${Math.round(formatPercentage(recommended))}% is recommended`);
      });
  }

  statistic() {
    return (
      <StatisticBox
        icon={<SpellIcon id={SPELLS.MOONFIRE_BEAR.id} />}
        value={`${formatPercentage(this.moonfireUptime)}%`}
        label="Moonfire uptime"
      />
    );
  }
  statisticOrder = STATISTIC_ORDER.CORE(12);
}

export default Moonfire;
