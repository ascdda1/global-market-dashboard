'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getAssetLogoPath, type AssetLogoKind } from './asset-logos';

export default function AssetLogo({ ticker, kind }: { ticker: string; kind: AssetLogoKind }) {
  const localPath = getAssetLogoPath(ticker, kind);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [localPath]);

  if (!localPath || imageFailed) {
    return <span aria-label={`${ticker} logo unavailable`} className="asset-logo asset-logo-fallback">{ticker}</span>;
  }

  return (
    <span className="asset-logo asset-logo-image">
      <Image
        alt={`${ticker} logo`}
        height={40}
        onError={() => setImageFailed(true)}
        src={localPath}
        width={40}
      />
    </span>
  );
}
