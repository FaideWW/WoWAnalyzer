import React from 'react';
import PropTypes from 'prop-types';
import ChartistGraph from 'react-chartist';
import Chartist from 'chartist';
import 'chartist-plugin-legend';

import { formatDuration } from 'common/format';

import './IronfurGraph.css';

const baseConfig = {
  showArea: true,
  showPoint: false,
  fullWidth: true,
  height: '350px',
  lineSmooth: Chartist.Interpolation.step({
    fillHoles: true,
  }),
  axisX: {
    labelInterpolationFnc: function skipLabels(seconds) {
      if (seconds % 30 === 0) {
        return formatDuration(seconds);
      }
      return null;
    },
    offset: 15,
  },
  axisY: {
    onlyInteger: true,
    offset: 100,
  },
  plugins: [
    Chartist.plugins.legend({
      classNames: [
        'stacks',
      ],
    }),
  ],
};


function IronfurGraph({ start, end, stackData }) {
  const fightDurationSec = Math.ceil((end - start) / 1000);
  const labels = [0];
  const graphStacks = [0];
  let currentStack = -1;
  for (let i = 1; i < fightDurationSec; i += 1) {
    labels.push(i);
    // If the next stack change occurs in the next second, record it as occuring this second
    if (
      currentStack + 1 < stackData.length &&
      stackData[currentStack + 1].timestamp - start < (i + 1) * 1000
    ) {
      currentStack += 1;
      graphStacks.push(stackData[currentStack].stackCount);
    } else {
      graphStacks.push(null);
    }
  }

  console.log(graphStacks);

  const chartData = {
    labels: labels,
    series: [
      {
        className: 'stacks',
        name: 'Stacks',
        data: graphStacks,
      },
    ],
  };

  return (
    <div>
      <div className="flex">
        <div className="flex-main">
          Put IF description here.
        </div>
      </div>
      <div className="graph-container">
        <ChartistGraph
          data={chartData}
          options={baseConfig}
          type="Line"
        />
      </div>
    </div>
  );
}

IronfurGraph.propTypes = {
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  stackData: PropTypes.array.isRequired,
};

export default IronfurGraph;

