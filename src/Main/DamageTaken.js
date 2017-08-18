import React from 'react';
import PropTypes from 'prop-types';

import ChartistGraph from 'react-chartist';
import Chartist from 'chartist';
import 'chartist-plugin-legend';

import './DamageTaken.css';

const formatDuration = (duration) => {
  const seconds = Math.floor(duration % 60);
  return `${Math.floor(duration / 60)}:${seconds < 10 ? `0${seconds}` : seconds}`;
};

export default function DamageTaken({ damageEvents, start, end }) {
  const fightDurationSec = Math.ceil((end - start) / 1000);
  const labels = [];
  const unmitigatedDamageAverages = [];
  const mitigatedDamageAverages = [];
  let currentEventIndex = 0;
  let maxDamageTaken = 0;
  for (let i = 0; i < fightDurationSec; i += 1) {
    labels.push[i];

    let unmitigatedAverage = 0;
    let mitigatedAverage = 0;
    let eventsCount = 0;
    // Average out the damage intake for the fight slice we're looking at
    while (
      currentEventIndex < damageEvents.length &&
      damageEvents[currentEventIndex].timestamp - start < (i + 1) * 1000
    ) {
      eventsCount += 1;
      unmitigatedAverage += damageEvents[currentEventIndex].damageBeforeDR / eventsCount;
      mitigatedAverage += damageEvents[currentEventIndex].damageAfterDR / eventsCount;
      currentEventIndex += 1;
    }

    if (unmitigatedAverage > maxDamageTaken) {
      maxDamageTaken = unmitigatedAverage;
    }

    unmitigatedDamageAverages.push(unmitigatedAverage);
    mitigatedDamageAverages.push(mitigatedAverage);
  }

  console.log('[unmitigated]', unmitigatedDamageAverages);
  console.log('[mitigated]', mitigatedDamageAverages);
  const chartData = {
    labels,
    series: [
      {
        className: 'unmitigated',
        name: 'Damage before Mitigation',
        data: unmitigatedDamageAverages,
      },
      {
        className: 'mitigated',
        name: 'Damage after Mitigation',
        data: mitigatedDamageAverages,
      },
    ],
  };

  let step = 0;

  return (
    <div>
      <ChartistGraph
        data={chartData}
        options={{
          low: 0,
          high: maxDamageTaken,
          showArea: true,
          showPoint: false,
          fullWidth: true,
          height: '300px',
          lineSmooth: Chartist.Interpolation.none({
            fillHoles: true,
          }),
          axisX: {
            labelInterpolationFnc: (seconds) => {
              if (seconds < ((step - 1) * 30)) {
                step = 0;
              }
              if (step === 0 || seconds >= (step * 30)) {
                step += 1;
                return formatDuration(seconds);
              }
              return null;
            },
            offset: 20,
          },
          axisY: {
            onlyInteger: true,
            offset: 35,
          },
          plugins: [
            Chartist.plugins.legend({
              classNames: [
                'unmitigated',
                'mitigated',
              ]
            }),
          ],
        }}
        type="Line"
      />
    </div>
  );
}

DamageTaken.propTypes = {
  damageEvents: PropTypes.array.isRequired,
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
};
