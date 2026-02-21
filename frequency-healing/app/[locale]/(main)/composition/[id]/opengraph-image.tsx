import { ImageResponse } from 'next/og';
import { compositionDescription, getCompositionSeoRecord } from '@/app/[locale]/(main)/composition/[id]/seo-data';

export const runtime = 'edge';
export const alt = 'Frequency Healing composition preview';
export const size = {
  width: 1200,
  height: 630
};
export const contentType = 'image/png';

type ParamsInput = { id: string } | Promise<{ id: string }>;

function safeFrequency(value: number) {
  if (!Number.isFinite(value)) {
    return '--- Hz';
  }
  return `${Math.round(value * 100) / 100} Hz`;
}

export default async function Image({ params }: { params: ParamsInput }) {
  const resolvedParams = await Promise.resolve(params);
  const record = await getCompositionSeoRecord(resolvedParams.id);

  const title = record?.title?.trim() || 'Healing Session';
  const description = compositionDescription(record);
  const frequencies = (record?.frequencies ?? []).slice(0, 6);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(circle at 16% 20%, rgba(143,122,219,0.78), transparent 38%), radial-gradient(circle at 86% 12%, rgba(106,146,194,0.54), transparent 36%), linear-gradient(145deg, #0f172a 0%, #1f2f4c 44%, #3b5593 100%)',
          color: '#f8fbff',
          padding: '58px 66px',
          fontFamily: 'Arial, sans-serif',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 800, gap: 20 }}>
          <div style={{ display: 'flex', fontSize: 21, letterSpacing: 3.2, textTransform: 'uppercase', opacity: 0.84 }}>
            Frequency Healing Studio
          </div>
          <div style={{ display: 'flex', fontSize: 60, lineHeight: 1.1, fontWeight: 700 }}>{title}</div>
          <div style={{ display: 'flex', fontSize: 26, lineHeight: 1.3, maxWidth: 780, opacity: 0.9 }}>
            {description.length > 180 ? `${description.slice(0, 177)}...` : description}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {frequencies.length > 0 ? (
              frequencies.map((frequency, index) => (
                <div
                  key={`${frequency}-${index}`}
                  style={{
                    display: 'flex',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.55)',
                    background: 'rgba(255,255,255,0.15)',
                    padding: '9px 16px',
                    fontSize: 24,
                    fontWeight: 600
                  }}
                >
                  {safeFrequency(frequency)}
                </div>
              ))
            ) : (
              <div
                style={{
                  display: 'flex',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.45)',
                  background: 'rgba(255,255,255,0.12)',
                  padding: '9px 16px',
                  fontSize: 22
                }}
              >
                Audio Session
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            width: 170,
            height: 170,
            borderRadius: 999,
            border: '4px solid rgba(255,255,255,0.58)',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 56,
            fontWeight: 700,
            marginTop: 6
          }}
        >
          FH
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
