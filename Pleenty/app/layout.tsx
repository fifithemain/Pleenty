import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
export const metadata: Metadata = { title: 'FreshCart — Good food, delivered.', description: 'Fresh groceries, pantry essentials and family produce boxes delivered to your door.' };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
