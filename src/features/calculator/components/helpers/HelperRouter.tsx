/**
 * Routes a HelperId to its component. Single switch lives here so every
 * helper file stays self-contained and the router is the only thing that
 * imports them all.
 */

import { useTranslation } from 'react-i18next';
import type { HelperId } from './registry';
import { AreaHelper } from './AreaHelper';
import { VolumeHelper } from './VolumeHelper';
import { LinearFtHelper } from './LinearFtHelper';
import { SlopeHelper } from './SlopeHelper';
import { PythagoreanHelper } from './PythagoreanHelper';
import { ConverterHelper } from './ConverterHelper';
import { TileOrderHelper } from './TileOrderHelper';
import { GroutHelper } from './GroutHelper';
import { ThinsetHelper } from './ThinsetHelper';
import { SealerHelper } from './SealerHelper';
import { LevelerHelper } from './LevelerHelper';
import { BackerBoardHelper } from './BackerBoardHelper';
import { CaulkHelper } from './CaulkHelper';
import { ShowerPanHelper } from './ShowerPanHelper';
import { UncouplingHelper } from './UncouplingHelper';
import { StairTileHelper } from './StairTileHelper';
import { HoursBetweenHelper } from './HoursBetweenHelper';
import { HelperShell } from '../shared/HelperShell';

interface HelperRouterProps {
  helperId: HelperId;
  onBack: () => void;
}

export function HelperRouter({ helperId, onBack }: HelperRouterProps) {
  const { t } = useTranslation();
  const title = t(`calculator.helpers.${helperId}`);

  return (
    <HelperShell title={title} onBack={onBack}>
      {renderHelperBody(helperId)}
    </HelperShell>
  );
}

function renderHelperBody(id: HelperId) {
  switch (id) {
    case 'area':          return <AreaHelper />;
    case 'volume':        return <VolumeHelper />;
    case 'linear_ft':     return <LinearFtHelper />;
    case 'slope':         return <SlopeHelper />;
    case 'pythagorean':   return <PythagoreanHelper />;
    case 'converter':     return <ConverterHelper />;
    case 'tile_order':    return <TileOrderHelper />;
    case 'grout':         return <GroutHelper />;
    case 'thinset':       return <ThinsetHelper />;
    case 'sealer':        return <SealerHelper />;
    case 'leveler':       return <LevelerHelper />;
    case 'backer_board':  return <BackerBoardHelper />;
    case 'caulk':         return <CaulkHelper />;
    case 'shower_pan':    return <ShowerPanHelper />;
    case 'uncoupling':    return <UncouplingHelper />;
    case 'stair_tile':    return <StairTileHelper />;
    case 'hours_between': return <HoursBetweenHelper />;
  }
}
