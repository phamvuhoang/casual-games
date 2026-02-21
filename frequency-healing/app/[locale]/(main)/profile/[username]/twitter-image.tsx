import { ImageResponse } from 'next/og';
import { getProfileSeoRecord, profileDescription } from '@/app/[locale]/(main)/profile/[username]/seo-data';

export const runtime = 'edge';
export const alt = 'Frequency Healing creator profile social preview';
export const size = {
  width: 1200,
  height: 600
};
export const contentType = 'image/png';

type ParamsInput = { username: string } | Promise<{ username: string }>;

export default async function Image({ params }: { params: ParamsInput }) {
  const resolvedParams = await Promise.resolve(params);
  const record = await getProfileSeoRecord(resolvedParams.username);

  const displayName = record?.display_name?.trim() || record?.username || 'Creator Profile';
  const username = record?.username || resolvedParams.username;
  const description = profileDescription(record);

  const avatarInitial = (displayName || 'F').charAt(0).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(circle at 14% 22%, rgba(143,122,219,0.8), transparent 42%), radial-gradient(circle at 80% 16%, rgba(106,146,194,0.58), transparent 40%), linear-gradient(141deg, #0e1728 0%, #1f3153 45%, #4563a3 100%)',
          color: '#f8fbff',
          padding: '50px 58px',
          fontFamily: 'Arial, sans-serif',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 760, gap: 14 }}>
          <div style={{ display: 'flex', fontSize: 18, letterSpacing: 2.9, textTransform: 'uppercase', opacity: 0.84 }}>
            Frequency Healing Studio
          </div>
          <div style={{ display: 'flex', fontSize: 50, lineHeight: 1.1, fontWeight: 700 }}>{displayName}</div>
          <div style={{ display: 'flex', fontSize: 24, opacity: 0.88 }}>@{username}</div>
          <div style={{ display: 'flex', fontSize: 21, lineHeight: 1.3, maxWidth: 740, opacity: 0.9 }}>
            {description.length > 145 ? `${description.slice(0, 142)}...` : description}
          </div>
          <div
            style={{
              display: 'flex',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.52)',
              background: 'rgba(255,255,255,0.14)',
              padding: '7px 14px',
              fontSize: 20,
              fontWeight: 600,
              width: 'fit-content'
            }}
          >
            Creator Profile
          </div>
        </div>

        {record?.avatar_url ? (
          <img
            src={record.avatar_url}
            alt={displayName}
            width={150}
            height={150}
            style={{
              borderRadius: 999,
              objectFit: 'cover',
              border: '4px solid rgba(255,255,255,0.58)'
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              width: 150,
              height: 150,
              borderRadius: 999,
              border: '4px solid rgba(255,255,255,0.58)',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 56,
              fontWeight: 700
            }}
          >
            {avatarInitial}
          </div>
        )}
      </div>
    ),
    {
      ...size
    }
  );
}
