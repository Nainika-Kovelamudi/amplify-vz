import { cn } from '../../utils/cn';

type CopyrightFooterProps = {
  className?: string;
};

export function CopyrightFooter({ className }: CopyrightFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        'border-t border-gray-200 bg-white px-4 py-6 md:px-8',
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-row flex-nowrap items-center justify-center gap-3 md:gap-4">
        <img
          src="/infovision_logo.png"
          alt="InfoVision"
          className="h-12 w-auto shrink-0 object-contain md:h-14"
          width={320}
          height={56}
        />
        <p className="min-w-0 text-xs text-gray-500 sm:text-sm">
          © {year} InfoVision, Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
