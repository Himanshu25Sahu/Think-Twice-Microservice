'use client';

import { BookIcon } from '@/components/icons';
import { Button } from './Button';

export function EmptyState({ icon: Icon = BookIcon, title, description, buttonText, onButtonClick }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-indigo-600/10 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-indigo-400" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-200 mb-1">{title}</h3>
      <p className="text-sm text-zinc-400 text-center max-w-sm mb-6">{description}</p>
      {buttonText && (
        <Button onClick={onButtonClick} size="md">
          {buttonText}
        </Button>
      )}
    </div>
  );
}
