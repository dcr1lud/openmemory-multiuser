'use client';

import { Toaster } from 'sonner';

export function SonnerProvider() {
  return (
    <Toaster 
      position="top-right" 
      expand={true} 
      richColors 
      toastOptions={{
        style: {
          zIndex: 999999999
        }
      }} 
    />
  );
}
