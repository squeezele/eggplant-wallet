import { makeUniversalApp } from '@electron/universal';
import path from 'path';

await makeUniversalApp({
  x64AppPath:  path.resolve( './out/EggplantWallet-darwin-x64/EggplantWallet.app' ) ,
  arm64AppPath: path.resolve( 'out/EggplantWallet-darwin-arm64/EggplantWallet.app' ),
  outAppPath: path.resolve( './out/Eggplant_osx_universal.app' ),
});
