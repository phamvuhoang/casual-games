import { ImageResponse } from 'next/og';
import { getProfileSeoRecord, profileDescription } from '@/app/(main)/profile/[username]/seo-data';

export const runtime = 'edge';
export const alt = 'Frequency Healing creator profile preview';
export const size = {
  width: 1200,
  height: 630
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
            'radial-gradient(circle at 18% 20%, rgba(143,122,219,0.76), transparent 40%), radial-gradient(circle at 78% 12%, rgba(106,146,194,0.56), transparent 38%), linear-gradient(140deg, #0e1728 0%, #1c2b47 46%, #3f5894 100%)',
          color: '#f8fbff',
          padding: '58px 66px',
          fontFamily: 'Arial, sans-serif',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 800, gap: 18 }}>
          <div style={{ display: 'flex', fontSize: 21, letterSpacing: 3.2, textTransform: 'uppercase', opacity: 0.84 }}>
            Frequency Healing Studio
          </div>
          <div style={{ display: 'flex', fontSize: 58, lineHeight: 1.1, fontWeight: 700 }}>{displayName}</div>
          <div style={{ display: 'flex', fontSize: 27, opacity: 0.88 }}>@{username}</div>
          <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.3, maxWidth: 760, opacity: 0.9 }}>
            {description.length > 170 ? `${description.slice(0, 167)}...` : description}
          </div>
          <div
            style={{
              display: 'flex',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.54)',
              background: 'rgba(255,255,255,0.14)',
              padding: '8px 14px',
              fontSize: 21,
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
            width={170}
            height={170}
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
              width: 170,
              height: 170,
              borderRadius: 999,
              border: '4px solid rgba(255,255,255,0.58)',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 62,
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
