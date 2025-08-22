import * as React from 'react';
export function Textarea({ className='', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={className} {...props} />;
}
