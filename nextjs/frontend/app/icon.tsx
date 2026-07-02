import { ImageResponse } from 'next/og';
import { ShoppieAppIcon } from '@/lib/shoppie-app-icon';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<ShoppieAppIcon size={32} />, {
    width: 32,
    height: 32,
  });
}
