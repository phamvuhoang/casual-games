import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Frequency Healing Studio social preview';
export const size = {
  width: 1200,
  height: 600
};
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(circle at 16% 24%, rgba(143, 122, 219, 0.75), transparent 44%), radial-gradient(circle at 78% 14%, rgba(106, 146, 194, 0.55), transparent 44%), linear-gradient(140deg, #0f172a 0%, #1e293b 42%, #344a7a 100%)',
          color: '#f8fbff',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '56px 68px',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 730 }}>
          <div style={{ fontSize: 20, letterSpacing: 3.5, textTransform: 'uppercase', opacity: 0.82 }}>
            Frequency Healing Studio
          </div>
          <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1.12 }}>
            Build meditative audio journeys with dynamic, calming visuals
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            width: 154,
            height: 154,
            borderRadius: 999,
            border: '4px solid rgba(255,255,255,0.56)',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 52,
            fontWeight: 700
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
