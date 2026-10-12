import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import MusicPlayer from '@/components/MusicPlayer';
export const metadata: Metadata = { title: "People's Market — Good food, delivered.", description: "Discover fresh local favourites and shop People's Market online." };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) { return <html lang="en"><body>{children}<MusicPlayer /></body></html>; }
