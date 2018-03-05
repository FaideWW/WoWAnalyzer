import React from 'react';
import { formatPercentage } from 'common/format';
import SpellIcon from 'common/SpellIcon';
import SpellLink from 'common/SpellLink';
import Wrapper from 'common/Wrapper';
import StatisticBox, { STATISTIC_ORDER } from 'Main/StatisticBox';
import Analyzer from 'Parser/Core/Analyzer';
import Enemies from 'Parser/Core/Modules/Enemies';
import SPELLS from 'common/SPELLS';

class Thrash extends Analyzer {
  static dependencies = {
    enemies: Enemies,
  };

  get thrashUptime() {
    return this.enemies.getBuffUptime(SPELLS.THRASH_BEAR_DOT.id) / this.owner.fightDuration;
  }

  get suggestionThresholds() {
    return {
      actual: this.thrashUptime,
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
            Your <SpellLink id={SPELLS.THRASH_BEAR_DOT.id} /> uptime was {formatPercentage(actual)}%, unless you have extended periods of downtime it should be near 100%. <br />Thrash applies a bleed which buffs the damage of <SpellLink id={SPELLS.MANGLE_BEAR.id} /> by 20%.  Thrash uptime is especially important if you are talented into <SpellLink id={SPELLS.REND_AND_TEAR_TALENT.id} />, since it buffs the rest of your damage and gives you extra damage reduction.
          </Wrapper>
        )
          .icon(SPELLS.THRASH_BEAR.icon)
          .actual(`${formatPercentage(actual)}% uptime`)
          .recommended(`${Math.round(formatPercentage(recommended))}% is recommended`);
      });
  }

  statistic() {
    return (
      <StatisticBox
        icon={<SpellIcon id={SPELLS.THRASH_BEAR.id} />}
        value={`${formatPercentage(this.thrashUptime)}%`}
        label="Thrash uptime"
      />
    );
  }
  statisticOrder = STATISTIC_ORDER.CORE(11);
}

export default Thrash;
