import * as React from 'react';
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string; };
export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button({ className='', ...props }, ref) {
  return <button ref={ref} className={className} {...props} />;
});
export default Button;
