import * as React from 'react';
export function Input({ className='', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={className} {...props} />;
}
