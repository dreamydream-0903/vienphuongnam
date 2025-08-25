import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className = '' }: ContainerProps) {
  return (
    <div className={`container ${className}`}>
      {children}
    </div>
  );
}
