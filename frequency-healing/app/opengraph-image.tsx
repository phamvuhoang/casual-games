import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Frequency Healing Studio cover image';
export const size = {
  width: 1200,
  height: 630
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(circle at 20% 22%, rgba(143, 122, 219, 0.7), transparent 42%), radial-gradient(circle at 82% 12%, rgba(199, 155, 115, 0.52), transparent 40%), linear-gradient(135deg, #111827 0%, #22324f 48%, #8f7adb 100%)',
          color: '#f8fbff',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '64px 72px',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
          <div
            style={{
              display: 'inline-flex',
              fontSize: 22,
              letterSpacing: 4,
              textTransform: 'uppercase',
              opacity: 0.84
            }}
          >
            Frequency Healing Studio
          </div>
          <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.14 }}>
            Create calming healing frequency experiences with responsive visuals
          </div>
          <div style={{ fontSize: 30, opacity: 0.9 }}>
            Meditation • Binaural Beats • Sound Therapy
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            width: 180,
            height: 180,
            borderRadius: 999,
            border: '4px solid rgba(255,255,255,0.56)',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 60,
            fontWeight: 700,
            boxShadow: '0 24px 56px rgba(16, 13, 35, 0.4)'
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
