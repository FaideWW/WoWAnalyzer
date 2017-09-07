import React from 'react';
import { formatPercentage, formatThousands } from 'common/format';
import SpellIcon from 'common/SpellIcon';
import SpellLink from 'common/SpellLink';
import StatisticBox, { STATISTIC_ORDER } from 'Main/StatisticBox';
import Tab from 'Main/Tab';
import Module from 'Parser/Core/Module';
import Combatants from 'Parser/Core/Modules/Combatants';
import SPELLS from 'common/SPELLS';

import IronfurGraph from './IronfurGraph';

const DURATION_PER_UE_RANK = 0.5;

class IronFur extends Module {
  static dependencies = {
    combatants: Combatants,
  };

  _stacksArray = [];
  ironfurDuration = 6;

  lastIronfurBuffApplied = 0;
  physicalHitsWithIronFur = 0;
  physicalDamageWithIronFur = 0;
  physicalHitsWithoutIronFur = 0;
  physicalDamageWithoutIronFur = 0;

  on_initialized() {
    const ueRank = this.combatants.selected.traitsBySpellId[SPELLS.URSOCS_ENDURANCE.id];
    this.ironfurDuration += (ueRank * DURATION_PER_UE_RANK);
  }

  on_byPlayer_cast(event) {
    if (event.ability.guid === SPELLS.IRONFUR.id) {
      const timestamp = event.timestamp;
      const hasGoE = this.combatants.selected.hasBuff(SPELLS.GUARDIAN_OF_ELUNE.id, timestamp);
      const duration = (this.ironfurDuration + (hasGoE ? 2 : 0)) * 1000;
      this.addStack(timestamp, timestamp + duration);
    }
  }

  on_byPlayer_applybuff(event) {
    const spellId = event.ability.guid;
    if (SPELLS.IRONFUR.id === spellId) {
      this.lastIronfurBuffApplied = event.timestamp;
    }
  }

  on_byPlayer_removebuff(event) {
    const spellId = event.ability.guid;
    if (SPELLS.IRONFUR.id === spellId) {
      this.lastIronfurBuffApplied = 0;
    }

    if (SPELLS.BEAR_FORM.id === spellId) {
      // Truncate the array and immediately cancel all stacks
      const index = this.getMostRecentStackIndex(event.timestamp);
      this._stacksArray.length = index + 1;
      this._stacksArray.push({ timestamp: event.timestamp, stackCount: 0 });
    }
  }

  on_toPlayer_damage(event) {
    // Physical
    if (event.ability.type === 1) {
      if (this.lastIronfurBuffApplied > 0) {
        this.physicalHitsWithIronFur++;
        this.physicalDamageWithIronFur += event.amount + (event.absorbed || 0) + (event.overkill || 0);
      }
      else {
        this.physicalHitsWithoutIronFur++;
        this.physicalDamageWithoutIronFur += event.amount + (event.absorbed || 0) + (event.overkill || 0);
      }
    }
  }

  on_finished() {
    console.log(this._stacksArray);
  }

  getMostRecentStackIndex(timestamp) {
    let i = this._stacksArray.length - 1;
    while (i >= 0 && this._stacksArray[i].timestamp > timestamp) {
      i--;
    }
    return i;
  }
  getStackCount(timestamp) {
    const index = this.getMostRecentStackIndex(timestamp);
    return this._stacksArray[index].stackCount;
  }

  addStack(stackStart, stackEnd) {
    const index = this.getMostRecentStackIndex(stackStart);
    if (index === -1) {
      this._stacksArray.push({ timestamp: stackStart, stackCount: 1 });
      this._stacksArray.push({ timestamp: stackEnd, stackCount: 0 });
      return;
    }

    const stackCount = this._stacksArray[index].stackCount;
    this._stacksArray.splice(index + 1, 0, { timestamp: stackStart, stackCount });
    let i = index + 1;
    let finalStackCount = stackCount;
    while (i < this._stacksArray.length && this._stacksArray[i].timestamp < stackEnd) {
      this._stacksArray[i].stackCount += 1;
      finalStackCount = this._stacksArray[i].stackCount;
      i += 1;
    }
    this._stacksArray.splice(i, 0, { timestamp: stackEnd, stackCount: finalStackCount - 1 });
  }

  suggestions(when) {
    const physicalDamageMitigatedPercent = this.physicalDamageWithIronFur/(this.physicalDamageWithIronFur+this.physicalDamageWithoutIronFur);

    when(physicalDamageMitigatedPercent).isLessThan(0.90)
      .addSuggestion((suggest, actual, recommended) => {
        return suggest(<span>You only had the <SpellLink id={SPELLS.IRONFUR.id} /> buff for {formatPercentage(actual)}% of physical damage taken. You should have the Ironfur buff up to mitigate as much physical damage as possible.</span>)
          .icon(SPELLS.IRONFUR.icon)
          .actual(`${formatPercentage(actual)}% was mitigated by Ironfur`)
          .recommended(`${Math.round(formatPercentage(recommended))}% or more is recommended`)
          .regular(recommended - 0.10).major(recommended - 0.2);
      });
  }

  statistic() {
    const totalIronFurTime = this.combatants.selected.getBuffUptime(SPELLS.IRONFUR.id);
    const physicalHitsMitigatedPercent = this.physicalHitsWithIronFur/(this.physicalHitsWithIronFur+this.physicalHitsWithoutIronFur);
    const physicalDamageMitigatedPercent = this.physicalDamageWithIronFur/(this.physicalDamageWithIronFur+this.physicalDamageWithoutIronFur);

    return (
      <StatisticBox
        icon={<SpellIcon id={SPELLS.IRONFUR.id} />}
        value={`${formatPercentage(totalIronFurTime/this.owner.fightDuration)}%`}
        label='Ironfur uptime'
        tooltip={`Ironfur usage breakdown:
            <ul>
                <li>You were hit <b>${this.physicalHitsWithIronFur}</b> times with your Ironfur buff (<b>${formatThousands(this.physicalDamageWithIronFur)}</b> damage).</li>
                <li>You were hit <b>${this.physicalHitsWithoutIronFur}</b> times <b><i>without</i></b> your Ironfur buff (<b>${formatThousands(this.physicalDamageWithoutIronFur)}</b> damage).</li>
            </ul>
            <b>${formatPercentage(physicalHitsMitigatedPercent)}%</b> of physical attacks were mitigated with Ironfur (<b>${formatPercentage(physicalDamageMitigatedPercent)}%</b> of physical damage taken).`}
      />
    );
  }

  tab() {
    return {
      title: 'Ironfur',
      url: 'ironfur',
      render: () => (
        <Tab title="Ironfur">
          <IronfurGraph
            start={this.owner.fight.start_time}
            end={this.owner.fight.end_time}
            stackData={this._stacksArray}
          />
        </Tab>
      ),
    };
  }

  statisticOrder = STATISTIC_ORDER.CORE(10);
}

export default IronFur;
