import { ImageResponse } from 'next/og';
import { ShoppieAppIcon } from '@/lib/shoppie-app-icon';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<ShoppieAppIcon size={180} />, {
    width: 180,
    height: 180,
  });
}
