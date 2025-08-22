import * as React from 'react';
type Props = React.InputHTMLAttributes<HTMLInputElement>;
export function Switch(props: Props) {
  return <input type="checkbox" {...props} />;
}
